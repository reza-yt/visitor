'use strict';

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// YouTube-specific modules
const CookieLogin = require('./modules/cookieLogin');
const WatchRetention = require('./modules/watchRetention');
const PlaybackTelemetry = require('./modules/playbackTelemetry');
const MediaEngagement = require('./modules/mediaEngagement');
const CodecFingerprint = require('./modules/codecFingerprint');
const AccountTrust = require('./modules/accountTrust');
const DeviceAttestation = require('./modules/deviceAttestation');
const BehaviorHistory = require('./modules/behaviorHistory');

// Shared modules from main visitor
const ProxyRotator = require('../modules/proxyRotator');
const UserAgentRotator = require('../modules/userAgentRotator');
const ViewportRandomizer = require('../modules/viewportRandomizer');
const TimezoneSpoofer = require('../modules/timezoneSpoofer');
const FingerprintRandomizer = require('../modules/fingerprintRandomizer');
const BandwidthThrottle = require('../modules/bandwidthThrottle');
const RetryHandler = require('../modules/retryHandler');
const EnvConfig = require('../envConfig');
const defaultConfig = require('./config');

puppeteer.use(StealthPlugin());

class YouTubeViewer {
  constructor(customConfig = {}) {
    const envConfig = new EnvConfig();
    envConfig.loadEnv().parseCli();

    this.config = { ...defaultConfig, ...customConfig };

    // Initialize modules
    this.cookieLogin = new CookieLogin({ cookiesDir: this.config.cookiesDir });
    this.watchRetention = new WatchRetention(this.config.retention);
    this.telemetry = new PlaybackTelemetry();
    this.mediaEngagement = new MediaEngagement(this.config.engagement);
    this.codecFingerprint = new CodecFingerprint();
    this.accountTrust = new AccountTrust();
    this.deviceAttestation = new DeviceAttestation();
    this.behaviorHistory = new BehaviorHistory();

    this.proxyRotator = new ProxyRotator();
    this.userAgentRotator = new UserAgentRotator({ mobileRatio: this.config.browser.mobileRatio });
    this.viewportRandomizer = new ViewportRandomizer();
    this.timezoneSpoofer = new TimezoneSpoofer();
    this.fingerprintRandomizer = new FingerprintRandomizer();
    this.bandwidthThrottle = new BandwidthThrottle();
    this.retryHandler = new RetryHandler({ maxRetries: 2 });

    this.stats = {
      totalWatchTime: 0, sessions: 0,
      success: 0, failed: 0, videosWatched: 0,
    };
  }


  /**
   * Initialize YouTube viewer
   */
  async init() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   YOUTUBE AUTO VIEWER - Watch Hours Bot   ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║ Videos:      ${this.config.videos.length}`);
    console.log(`║ Daily Target:${this.config.watch.totalDailyHours}h`);
    console.log(`║ Sessions/Day:${this.config.watch.sessionsPerDay}`);
    console.log(`║ Retention:   ${this.config.retention.targetRetention * 100}%`);
    console.log('╚══════════════════════════════════════════╝');

    // Load accounts
    this.cookieLogin.loadAllAccounts();
    const accountStats = this.cookieLogin.getStats();
    console.log(`[Init] Accounts: ${accountStats.total} loaded`);

    // Load proxies
    if (this.config.proxies.length > 0) {
      this.proxyRotator.loadProxies(this.config.proxies);
    }

    console.log('[Init] Ready!\n');
  }

  /**
   * Watch a single video with full human simulation
   */
  async watchVideo(videoUrl, account) {
    const startTime = Date.now();
    const agentInfo = this.userAgentRotator.getRandom();
    const viewport = this.viewportRandomizer.getRandom(agentInfo.isMobile);
    const proxy = this.proxyRotator.getRandom();
    const tzData = this.timezoneSpoofer.getRandom();
    const device = this.deviceAttestation.getDeviceForAccount(account.name, agentInfo.isMobile);

    console.log(`\n[Watch] ${videoUrl}`);
    console.log(`[Watch] Account: ${account.name} | ${agentInfo.isMobile ? 'Mobile' : 'Desktop'} | ${tzData.city}`);

    let browser;
    try {
      // Launch browser
      const launchArgs = [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled',
        '--autoplay-policy=no-user-gesture-required', // Allow autoplay
        `--window-size=${viewport.width},${viewport.height}`,
      ];
      if (proxy) launchArgs.push(`--proxy-server=${this.proxyRotator.formatForPuppeteer(proxy)}`);

      browser = await puppeteer.launch({
        headless: this.config.browser.headless,
        args: launchArgs,
        ignoreHTTPSErrors: true,
      });

      const page = await browser.newPage();
      await page.setViewport(this.viewportRandomizer.toPuppeteerConfig(viewport));
      await page.setUserAgent(agentInfo.userAgent);

      // Apply device attestation (persistent identity)
      await this.deviceAttestation.apply(page, device);

      // Apply timezone
      await this.timezoneSpoofer.applyToPage(page, tzData);

      // Apply codec fingerprint
      await this.codecFingerprint.apply(page, agentInfo.userAgent);

      // Apply fingerprint randomization
      await this.fingerprintRandomizer.apply(page);

      // Apply bandwidth (mobile = slower)
      const network = this.bandwidthThrottle.getProfile(agentInfo.isMobile);
      await this.bandwidthThrottle.apply(page, network);

      // Proxy auth
      if (proxy) {
        const auth = this.proxyRotator.extractAuth(proxy);
        if (auth) await page.authenticate(auth);
      }

      // Login with cookies
      const loginSuccess = await this.cookieLogin.login(page, account);
      if (!loginSuccess) {
        console.log('[Watch] Login failed, continuing anyway...');
      }

      // Organic browsing before target video
      await this.behaviorHistory.simulateOrganicBrowsing(page, account.name);

      // Navigate to video
      await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(this._randomBetween(3000, 6000));

      // Initialize telemetry
      await this.telemetry.initSession(page, this._extractVideoId(videoUrl));

      // Handle ads
      await this.mediaEngagement.handleAd(page, this.config.behavior.adSkipDelay);

      // Set volume
      await this.mediaEngagement.setRandomVolume(page);

      // Maybe enter theater/fullscreen
      await this.mediaEngagement.maybeTheaterMode(page);

      // Get video duration
      const duration = await this._getVideoDuration(page);
      console.log(`[Watch] Video duration: ${duration}s (${(duration/60).toFixed(1)}min)`);

      // Generate and execute watch plan
      const watchPlan = this.watchRetention.generateWatchPlan(duration);
      console.log(`[Watch] Plan: watch ${(watchPlan.watchPercent*100).toFixed(0)}% (${watchPlan.watchDuration}s)`);

      // Start watching with periodic telemetry
      await this._executeWatch(page, watchPlan, duration);

      // Post-watch engagement
      await this.mediaEngagement.maybeLike(page);
      if (this.config.behavior.readComments) {
        await this.mediaEngagement.browseComments(page);
      }
      if (this.config.behavior.readDescription) {
        await this.mediaEngagement.readDescription(page);
      }
      await this.mediaEngagement.maybeSubscribe(page);

      // Click recommended (organic behavior)
      if (this.config.behavior.browseRecommended && Math.random() < 0.4) {
        await this._watchRecommended(page, account);
      }

      // Save updated cookies
      await this.cookieLogin.saveCookies(page, account);

      // Record stats
      const watchTime = watchPlan.watchDuration;
      this.stats.totalWatchTime += watchTime;
      this.stats.videosWatched++;
      this.stats.success++;
      this.cookieLogin.recordWatchTime(account, watchTime);

      // Record to history & trust
      this.behaviorHistory.recordWatch(account.name, {
        videoId: this._extractVideoId(videoUrl),
        duration, watchTime,
        watchPercent: watchPlan.watchPercent,
        device: agentInfo.isMobile ? 'mobile' : 'desktop',
        engaged: true,
      });
      this.accountTrust.recordActivity(account.name, {
        watchTime, videosWatched: 1,
        device: agentInfo.isMobile ? 'mobile' : 'desktop',
        engaged: true,
      });

      console.log(`[Watch] ✓ Done! Watched ${(watchTime/60).toFixed(1)}min (${(watchPlan.watchPercent*100).toFixed(0)}%)`);
      return { success: true, watchTime };

    } catch (error) {
      this.stats.failed++;
      console.log(`[Watch] ✗ Failed: ${error.message}`);
      if (proxy) this.proxyRotator.markFailed(proxy);
      return { success: false, error: error.message };
    } finally {
      if (browser) await browser.close();
    }
  }


  /**
   * Execute watch with telemetry heartbeats
   */
  async _executeWatch(page, watchPlan, duration) {
    const watchSeconds = watchPlan.watchDuration;
    const heartbeatInterval = 10; // Send heartbeat every 10s
    let watched = 0;

    // Ensure video is playing
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video && video.paused) video.play();
    });

    while (watched < watchSeconds) {
      const segment = Math.min(heartbeatInterval, watchSeconds - watched);
      await page.waitForTimeout(segment * 1000);
      watched += segment;

      // Send telemetry heartbeat
      await this.telemetry.sendHeartbeat(page, watched, duration, 'playing');

      // Simulate buffering (rare)
      await this.telemetry.simulateBuffering(page, watched);

      // Random micro-interactions (mouse move, hover controls)
      if (Math.random() < 0.15) {
        await this.mediaEngagement.hoverPlayerControls(page);
      }

      // Handle mid-roll ads
      if (Math.random() < 0.05) {
        await this.mediaEngagement.handleAd(page, this.config.behavior.adSkipDelay);
      }

      // Progress log every 60s
      if (watched % 60 < heartbeatInterval) {
        const percent = ((watched / duration) * 100).toFixed(0);
        console.log(`[Watch] Progress: ${(watched/60).toFixed(1)}min / ${(duration/60).toFixed(1)}min (${percent}%)`);
      }
    }
  }

  /**
   * Watch a recommended video (organic chain viewing)
   */
  async _watchRecommended(page, account) {
    try {
      // Click on a recommended video
      const recommendations = await page.$$('ytd-compact-video-renderer a#thumbnail, ytd-video-renderer a#thumbnail');
      if (recommendations.length > 0) {
        const pick = recommendations[Math.floor(Math.random() * Math.min(5, recommendations.length))];
        await pick.click();
        await page.waitForTimeout(5000);

        // Watch for 30-180 seconds
        const shortWatch = this._randomBetween(30, 180);
        console.log(`[Watch] Watching recommended for ${shortWatch}s`);
        await this.watchRetention.watchFor(page, shortWatch);
        this.stats.totalWatchTime += shortWatch;
      }
    } catch (e) {}
  }

  /**
   * Run full session (multiple videos)
   */
  async run() {
    await this.init();

    if (this.config.videos.length === 0) {
      console.log('[Error] No videos configured! Add videos to config.');
      return;
    }

    const accounts = this.cookieLogin.accounts;
    if (accounts.length === 0) {
      console.log('[Error] No cookie files found! Add cookies to ./cookies/ dir');
      return;
    }

    const totalVideos = this.config.videos.length;
    const sessions = this.config.watch.sessionsPerDay;

    for (let s = 0; s < sessions; s++) {
      console.log(`\n====== SESSION ${s + 1}/${sessions} ======`);

      // Get next account
      const account = this.cookieLogin.getNextAccount(this.config.accounts.cooldownMinutes);
      if (!account) { console.log('[Session] No available account'); continue; }

      // Check trust score
      if (!this.accountTrust.shouldUseNow(account.name)) {
        console.log(`[Session] Account ${account.name} should rest, skipping`);
        continue;
      }

      // Pick random videos for this session
      const videosThisSession = this._randomBetween(1, Math.min(3, totalVideos));
      const shuffled = [...this.config.videos].sort(() => Math.random() - 0.5);

      for (let v = 0; v < videosThisSession; v++) {
        const videoUrl = shuffled[v % shuffled.length];
        await this.retryHandler.execute(
          () => this.watchVideo(videoUrl, account),
          `video-${v + 1}`
        ).catch(() => {});

        // Delay between videos
        if (v < videosThisSession - 1) {
          const delay = this._randomBetween(
            this.config.timing.betweenVideos.min,
            this.config.timing.betweenVideos.max
          );
          console.log(`[Session] Next video in ${(delay/1000).toFixed(0)}s...`);
          await this._sleep(delay);
        }
      }

      this.stats.sessions++;

      // Session gap
      if (s < sessions - 1) {
        const gap = this._randomBetween(
          this.config.timing.sessionGap.min,
          this.config.timing.sessionGap.max
        );
        console.log(`\n[Session] Next session in ${(gap/60).toFixed(0)}min...\n`);
        await this._sleep(gap * 1000);
      }
    }

    this._printReport();
  }

  /**
   * Get video duration from page
   */
  async _getVideoDuration(page) {
    try {
      return await page.evaluate(() => {
        const video = document.querySelector('video');
        return video ? Math.floor(video.duration) : 600;
      });
    } catch { return 600; } // Default 10min
  }

  _extractVideoId(url) {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : url;
  }

  _randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _printReport() {
    const hours = (this.stats.totalWatchTime / 3600).toFixed(2);
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║          YOUTUBE VIEWER REPORT           ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║ Total Watch Time:  ${hours} hours`);
    console.log(`║ Videos Watched:    ${this.stats.videosWatched}`);
    console.log(`║ Sessions:          ${this.stats.sessions}`);
    console.log(`║ Success:           ${this.stats.success}`);
    console.log(`║ Failed:            ${this.stats.failed}`);
    console.log(`║ Accounts Used:     ${this.cookieLogin.getStats().valid}`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('\nAccount Details:');
    console.table(this.cookieLogin.listAccounts());
  }
}

// CLI Entry Point
if (require.main === module) {
  const viewer = new YouTubeViewer();
  viewer.run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = YouTubeViewer;
