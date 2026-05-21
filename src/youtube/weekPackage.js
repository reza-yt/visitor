'use strict';

/**
 * 1-WEEK PACKAGE RUNNER
 * Optimized for: 1000 proxy + 500 akun + 1 TB bandwidth + 4000 jam target
 * Concurrent 40+ browsers with RAM optimization + low quality mode
 * 
 * Usage:
 *   node src/youtube/weekPackage.js
 *   node src/youtube/weekPackage.js --concurrent=40 --ram=32
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// YouTube modules
const CookieLogin = require('./modules/cookieLogin');
const WatchRetention = require('./modules/watchRetention');
const MediaEngagement = require('./modules/mediaEngagement');
const PlaybackTelemetry = require('./modules/playbackTelemetry');
const MuteDetection = require('./modules/muteDetection');
const WatchHistoryBypass = require('./modules/watchHistoryBypass');
const WatchHoursDashboard = require('./modules/watchHoursDashboard');
const AccountTrust = require('./modules/accountTrust');
const RamOptimizer = require('./modules/ramOptimizer');
const LowQualityMode = require('./modules/lowQualityMode');
const IpAccountBinding = require('./modules/ipAccountBinding');
const MultiDayScheduler = require('./modules/multiDayScheduler');

// Shared modules
const ProxyRotator = require('../modules/proxyRotator');
const UserAgentRotator = require('../modules/userAgentRotator');
const TimezoneSpoofer = require('../modules/timezoneSpoofer');
const FingerprintRandomizer = require('../modules/fingerprintRandomizer');
const RetryHandler = require('../modules/retryHandler');
const EnvConfig = require('../envConfig');

puppeteer.use(StealthPlugin());

class WeekPackageRunner {
  constructor(options = {}) {
    const envConfig = new EnvConfig();
    envConfig.loadEnv().parseCli();

    // Config
    this.config = {
      concurrent: parseInt(envConfig.get('CONCURRENT', '30'), 10),
      totalRAM: parseInt(envConfig.get('RAM', '32'), 10),
      targetHours: parseInt(envConfig.get('TARGET_HOURS', '4200'), 10),
      quality: envConfig.get('QUALITY', '144p'),
      cookiesDir: envConfig.get('COOKIES_DIR', './cookies'),
      proxyFile: envConfig.get('PROXY_FILE', ''),
      videos: envConfig.getArray('YOUTUBE_VIDEOS', []),
      dailyMax: parseInt(envConfig.get('DAILY_MAX_HOURS', '700'), 10),
      safetyMargin: 200, // Extra 200 hours over 4000
      ...options,
    };

    // Modules
    this.ramOptimizer = new RamOptimizer({ blockImages: true, blockFonts: true });
    this.lowQuality = new LowQualityMode({ targetQuality: this.config.quality });
    this.cookieLogin = new CookieLogin({ cookiesDir: this.config.cookiesDir });
    this.proxyRotator = new ProxyRotator();
    this.userAgentRotator = new UserAgentRotator({ mobileRatio: 0.3 });
    this.timezoneSpoofer = new TimezoneSpoofer();
    this.fingerprintRandomizer = new FingerprintRandomizer();
    this.retryHandler = new RetryHandler({ maxRetries: 2, baseDelay: 3000 });
    this.watchRetention = new WatchRetention({ targetRetention: 0.7 });
    this.mediaEngagement = new MediaEngagement({ likeChance: 0.1, subscribeChance: 0.03 });
    this.muteDetection = new MuteDetection();
    this.watchHistory = new WatchHistoryBypass({ maxRepeats: 2, cooldownHours: 12 });
    this.dashboard = new WatchHoursDashboard({ targetHours: this.config.targetHours });
    this.accountTrust = new AccountTrust();
    this.ipBinding = new IpAccountBinding();
    this.scheduler = new MultiDayScheduler({
      dailyTargetHours: this.config.dailyMax,
      activeHours: { start: 0, end: 24 }, // 24/7 mode
    });

    // State
    this.activeBrowsers = 0;
    this.totalWatchTime = 0;
    this.sessionsCompleted = 0;
    this.sessionsFailed = 0;
    this.startTime = null;
    this.isRunning = false;
  }


  /**
   * Initialize everything
   */
  async init() {
    this.startTime = Date.now();
    this.isRunning = true;

    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║   YOUTUBE WEEK PACKAGE - 4000 Watch Hours Bot     ║');
    console.log('║   RAM Optimized | Low Quality | 40+ Concurrent    ║');
    console.log('╠═══════════════════════════════════════════════════╣');

    // RAM report
    const maxConcurrent = this.ramOptimizer.getMaxConcurrent(this.config.totalRAM);
    this.config.concurrent = Math.min(this.config.concurrent, maxConcurrent);
    this.ramOptimizer.printReport(this.config.totalRAM);

    // Bandwidth report
    this.lowQuality.printReport(this.config.targetHours, 1000); // 1 TB

    console.log(`║ Concurrent:    ${this.config.concurrent} browsers`);
    console.log(`║ Target:        ${this.config.targetHours} hours (4000 + safety)`);
    console.log(`║ Quality:       ${this.config.quality}`);
    console.log(`║ RAM:           ${this.config.totalRAM} GB`);

    // Load accounts
    this.cookieLogin.loadAllAccounts();
    const accStats = this.cookieLogin.getStats();
    console.log(`║ Accounts:      ${accStats.total}`);

    // Load proxies
    if (this.config.proxyFile) {
      const fs = require('fs');
      if (fs.existsSync(this.config.proxyFile)) {
        const proxyList = fs.readFileSync(this.config.proxyFile, 'utf8');
        this.proxyRotator.loadFromText(proxyList);
      }
    }
    const proxyStats = this.proxyRotator.getStats();
    console.log(`║ Proxies:       ${proxyStats.total}`);

    // Videos
    console.log(`║ Videos:        ${this.config.videos.length}`);
    console.log('╚═══════════════════════════════════════════════════╝\n');

    if (accStats.total === 0) {
      console.log('❌ No accounts found! Add cookie files to ./cookies/');
      process.exit(1);
    }
    if (this.config.videos.length === 0) {
      console.log('❌ No videos configured! Set YOUTUBE_VIDEOS in .env');
      process.exit(1);
    }
  }

  /**
   * Single watch session (one browser, one account, one video)
   */
  async watchSession(account, videoUrl, proxy) {
    this.activeBrowsers++;
    const sessionStart = Date.now();
    let browser;
    let watchTime = 0;

    try {
      // Launch optimized browser
      const launchArgs = [
        ...this.ramOptimizer.getLaunchArgs(),
        '--autoplay-policy=no-user-gesture-required',
      ];
      if (proxy) {
        launchArgs.push(`--proxy-server=${this.proxyRotator.formatForPuppeteer(proxy)}`);
      }

      browser = await puppeteer.launch({
        headless: 'new',
        args: launchArgs,
        ignoreHTTPSErrors: true,
      });

      const page = await browser.newPage();

      // Apply RAM optimizations (block images, fonts, etc)
      await this.ramOptimizer.applyToPage(page);

      // Set user agent
      const agentInfo = this.userAgentRotator.getRandomDesktop();
      await page.setUserAgent(agentInfo.userAgent);

      // Apply fingerprint
      await this.fingerprintRandomizer.apply(page);

      // Proxy auth
      if (proxy) {
        const auth = this.proxyRotator.extractAuth(proxy);
        if (auth) await page.authenticate(auth);
      }

      // Login with cookies
      const loggedIn = await this.cookieLogin.login(page, account);
      if (!loggedIn) {
        throw new Error('Login failed');
      }

      // Navigate to video
      await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);

      // Force low quality (SAVE BANDWIDTH)
      await this.lowQuality.forceQuality(page);
      await this.lowQuality.throttleBandwidth(page);

      // Ensure not muted (CRITICAL for watch hours!)
      await this.muteDetection.setInitialVolume(page);

      // Handle ads
      await this.mediaEngagement.handleAd(page, { min: 3, max: 8 });

      // Get video duration
      const duration = await page.evaluate(() => {
        const v = document.querySelector('video');
        return v ? Math.floor(v.duration) : 600;
      }).catch(() => 600);

      // Calculate watch time (60-90% of video)
      const watchPercent = 0.6 + Math.random() * 0.3;
      const targetWatch = Math.min(Math.floor(duration * watchPercent), 1800); // Max 30min

      // Start watching
      await page.evaluate(() => {
        const v = document.querySelector('video');
        if (v && v.paused) v.play();
      });

      // Watch loop with periodic checks
      const checkInterval = 15; // Check every 15 seconds
      let watched = 0;

      while (watched < targetWatch) {
        const segment = Math.min(checkInterval, targetWatch - watched);
        await page.waitForTimeout(segment * 1000);
        watched += segment;

        // Verify still playing & not muted
        const state = await page.evaluate(() => {
          const v = document.querySelector('video');
          if (!v) return { playing: false };
          if (v.paused) v.play();
          if (v.volume < 0.05) v.volume = 0.3;
          return { playing: !v.paused, time: v.currentTime, volume: v.volume };
        }).catch(() => ({ playing: false }));

        if (!state.playing) {
          await page.evaluate(() => { const v = document.querySelector('video'); if (v) v.play(); });
        }

        // Re-enforce quality every 2 minutes
        if (watched % 120 < checkInterval) {
          await this.lowQuality.forceQuality(page);
        }
      }

      watchTime = watched;

      // Maybe like (low chance)
      if (Math.random() < 0.08) {
        await this.mediaEngagement.maybeLike(page);
      }

      // Save updated cookies
      await this.cookieLogin.saveCookies(page, account);

      // Record
      this.sessionsCompleted++;
      this.totalWatchTime += watchTime;
      this.dashboard.record({ watchTime, videosWatched: 1 });
      this.watchHistory.recordWatch(account.name, this._extractVideoId(videoUrl));
      this.accountTrust.recordActivity(account.name, { watchTime, videosWatched: 1 });

      const dur = ((Date.now() - sessionStart) / 1000).toFixed(0);
      console.log(`  ✓ ${account.name} | ${(watchTime/60).toFixed(1)}min | ${dur}s total | active:${this.activeBrowsers}`);

    } catch (error) {
      this.sessionsFailed++;
      console.log(`  ✗ ${account.name} | ${error.message} | active:${this.activeBrowsers}`);
      if (proxy) this.proxyRotator.markFailed(proxy);
    } finally {
      if (browser) {
        try { await browser.close(); } catch (e) {}
      }
      this.activeBrowsers--;
    }

    return watchTime;
  }


  /**
   * Main run loop - manages concurrent sessions
   */
  async run() {
    await this.init();

    const targetSeconds = this.config.targetHours * 3600;
    let batchNum = 0;

    console.log(`\n🚀 Starting... Target: ${this.config.targetHours} hours\n`);

    while (this.totalWatchTime < targetSeconds && this.isRunning) {
      batchNum++;
      const batchSize = this.config.concurrent;

      // Prepare batch
      const sessions = [];
      for (let i = 0; i < batchSize; i++) {
        const account = this.cookieLogin.getNextAccount(20); // 20min cooldown
        if (!account) continue;

        const video = this.watchHistory.getBestVideo(account.name, this.config.videos);
        const proxy = this.ipBinding.getProxyForAccount(
          account.name,
          this.proxyRotator.proxies.filter(p => !this.proxyRotator.failedProxies.has(p))
        );

        sessions.push({ account, video, proxy });
      }

      if (sessions.length === 0) {
        console.log('[Runner] No available accounts, waiting 60s...');
        await this._sleep(60000);
        continue;
      }

      // Launch batch concurrently
      const batchStart = Date.now();
      console.log(`\n── Batch #${batchNum} | ${sessions.length} sessions | Total: ${(this.totalWatchTime/3600).toFixed(2)}h / ${this.config.targetHours}h ──`);

      const promises = sessions.map(s =>
        this.retryHandler.execute(
          () => this.watchSession(s.account, s.video, s.proxy),
          `${s.account.name}`
        ).catch(() => 0)
      );

      await Promise.all(promises);

      // Batch stats
      const batchDuration = ((Date.now() - batchStart) / 1000).toFixed(0);
      const hoursTotal = (this.totalWatchTime / 3600).toFixed(2);
      const progress = ((this.totalWatchTime / targetSeconds) * 100).toFixed(1);
      const eta = this._calculateETA();

      console.log(`── Batch done (${batchDuration}s) | Progress: ${hoursTotal}h (${progress}%) | ETA: ${eta} ──`);

      // Print dashboard every 10 batches
      if (batchNum % 10 === 0) {
        this.dashboard.printDashboard();
        this._printStats();
      }

      // Small delay between batches (5-15s)
      const gap = Math.floor(Math.random() * 10000) + 5000;
      await this._sleep(gap);

      // Check if daily limit reached
      const todayStatus = this.scheduler.getTodayStatus();
      if (todayStatus.isComplete) {
        const nextRun = this.scheduler.getNextRunTime();
        console.log(`\n[Runner] Daily target reached! Next run: ${nextRun.toLocaleString()}`);
        const waitMs = nextRun.getTime() - Date.now();
        if (waitMs > 0) await this._sleep(waitMs);
      }
    }

    await this._finish();
  }

  /**
   * Calculate ETA to target
   */
  _calculateETA() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    if (this.totalWatchTime === 0) return 'calculating...';

    const rate = this.totalWatchTime / elapsed; // seconds watched per second real time
    const remaining = (this.config.targetHours * 3600) - this.totalWatchTime;
    const etaSeconds = remaining / rate;

    if (etaSeconds < 3600) return `${(etaSeconds / 60).toFixed(0)} min`;
    if (etaSeconds < 86400) return `${(etaSeconds / 3600).toFixed(1)} hours`;
    return `${(etaSeconds / 86400).toFixed(1)} days`;
  }

  /**
   * Print running stats
   */
  _printStats() {
    const elapsed = ((Date.now() - this.startTime) / 1000 / 3600).toFixed(2);
    const rate = this.sessionsCompleted > 0 ? (this.totalWatchTime / this.sessionsCompleted / 60).toFixed(1) : '0';
    const successRate = this.sessionsCompleted + this.sessionsFailed > 0
      ? ((this.sessionsCompleted / (this.sessionsCompleted + this.sessionsFailed)) * 100).toFixed(1) : '0';

    console.log(`\n📊 Stats: ${(this.totalWatchTime/3600).toFixed(2)}h watched | ${this.sessionsCompleted} sessions | ${rate}min avg | ${successRate}% success | ${elapsed}h elapsed\n`);
  }

  /**
   * Finish and report
   */
  async _finish() {
    this.isRunning = false;
    const totalHours = (this.totalWatchTime / 3600).toFixed(2);
    const elapsed = ((Date.now() - this.startTime) / 1000 / 3600).toFixed(2);

    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('║             WEEK PACKAGE - FINAL REPORT            ║');
    console.log('╠═══════════════════════════════════════════════════╣');
    console.log(`║ Total Watch Hours:   ${totalHours}h`);
    console.log(`║ Target:              ${this.config.targetHours}h`);
    console.log(`║ Status:              ${parseFloat(totalHours) >= 4000 ? '✅ TARGET REACHED!' : '⚠️ IN PROGRESS'}`);
    console.log(`║ Sessions Completed:  ${this.sessionsCompleted}`);
    console.log(`║ Sessions Failed:     ${this.sessionsFailed}`);
    console.log(`║ Real Time Elapsed:   ${elapsed}h`);
    console.log(`║ Efficiency:          ${(parseFloat(totalHours) / parseFloat(elapsed)).toFixed(1)}x`);
    console.log(`║ Proxy Stats:         ${JSON.stringify(this.proxyRotator.getStats())}`);
    console.log(`║ Account Stats:       ${JSON.stringify(this.cookieLogin.getStats())}`);
    console.log('╚═══════════════════════════════════════════════════╝\n');

    this.dashboard.printDashboard();
    this.dashboard.exportCSV();

    // Save final stats
    const fs = require('fs');
    const statsPath = './logs/week_package_report.json';
    fs.mkdirSync('./logs', { recursive: true });
    fs.writeFileSync(statsPath, JSON.stringify({
      totalWatchHours: totalHours,
      target: this.config.targetHours,
      sessions: this.sessionsCompleted,
      failed: this.sessionsFailed,
      elapsedHours: elapsed,
      completedAt: new Date().toISOString(),
    }, null, 2));
    console.log(`📄 Report saved: ${statsPath}`);
  }

  _extractVideoId(url) {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : url;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════
// CLI Entry Point
// ═══════════════════════════════════════════
if (require.main === module) {
  const runner = new WeekPackageRunner();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n⚠️  Shutting down gracefully...');
    runner.isRunning = false;
    await runner._finish();
    process.exit(0);
  });

  runner.run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = WeekPackageRunner;
