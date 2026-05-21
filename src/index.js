'use strict';

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Core modules
const ProxyRotator = require('./modules/proxyRotator');
const UserAgentRotator = require('./modules/userAgentRotator');
const ViewportRandomizer = require('./modules/viewportRandomizer');
const RefererRandomizer = require('./modules/refererRandomizer');
const HumanBehavior = require('./modules/humanBehavior');

// New modules
const CookieManager = require('./modules/cookieManager');
const TimezoneSpoofer = require('./modules/timezoneSpoofer');
const FingerprintRandomizer = require('./modules/fingerprintRandomizer');
const RetryHandler = require('./modules/retryHandler');
const Scheduler = require('./modules/scheduler');
const TrafficPattern = require('./modules/trafficPattern');
const DnsOverHttps = require('./modules/dnsOverHttps');
const StatsLogger = require('./modules/statsLogger');
const CaptchaDetector = require('./modules/captchaDetector');
const BandwidthThrottle = require('./modules/bandwidthThrottle');
const WarmupPhase = require('./modules/warmupPhase');
const ProxyHealthChecker = require('./modules/proxyHealthChecker');
const WebhookNotifier = require('./modules/webhookNotifier');
const BrowserEngine = require('./modules/browserEngine');
const EnvConfig = require('./envConfig');
const defaultConfig = require('./config');

// Apply stealth plugin
puppeteer.use(StealthPlugin());

class AutoVisitor {
  constructor(customConfig = {}) {
    // Load env/cli config
    const envConfig = new EnvConfig();
    envConfig.loadEnv().parseCli();
    const envBuilt = envConfig.buildConfig();

    // Merge: default < env < custom
    this.config = this._deepMerge(defaultConfig, envBuilt, customConfig);

    // Initialize all modules
    this.proxyRotator = new ProxyRotator();
    this.userAgentRotator = new UserAgentRotator({ mobileRatio: this.config.mobile.ratio });
    this.viewportRandomizer = new ViewportRandomizer();
    this.refererRandomizer = new RefererRandomizer();
    this.cookieManager = new CookieManager();
    this.timezoneSpoofer = new TimezoneSpoofer();
    this.fingerprintRandomizer = new FingerprintRandomizer();
    this.retryHandler = new RetryHandler(this.config.retry || {});
    this.trafficPattern = new TrafficPattern({ timezone: this.config.trafficPattern.timezone });
    this.dnsOverHttps = new DnsOverHttps();
    this.statsLogger = new StatsLogger({ format: this.config.logging.format, verbose: this.config.logging.verbose });
    this.captchaDetector = new CaptchaDetector();
    this.bandwidthThrottle = new BandwidthThrottle();
    this.warmupPhase = new WarmupPhase(this.config.warmup);
    this.proxyHealthChecker = new ProxyHealthChecker({ maxLatency: this.config.proxyHealth?.maxLatency });
    this.webhookNotifier = new WebhookNotifier(this.config.webhook || {});
    this.browserEngine = new BrowserEngine({ engine: this.config.browser.engine });
    this.scheduler = new Scheduler();

    this.stats = { success: 0, failed: 0, total: 0 };
  }


  /**
   * Initialize the visitor bot
   */
  async init() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   AUTO VISITOR v2.0 - Full Feature Bot   ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║ Targets:     ${this.config.targets.length} URLs`);
    console.log(`║ Visits:      ${this.config.visits.totalVisits}`);
    console.log(`║ Concurrent:  ${this.config.visits.concurrentVisits}`);
    console.log(`║ Mobile:      ${this.config.mobile.ratio * 100}%`);
    console.log(`║ Engine:      ${this.config.browser.engine}`);
    console.log(`║ Warmup:      ${this.config.warmup.enabled ? 'ON' : 'OFF'}`);
    console.log(`║ Traffic:     ${this.config.trafficPattern.enabled ? 'ON' : 'OFF'}`);
    console.log(`║ DoH:         ${this.config.doh.enabled ? 'ON' : 'OFF'}`);
    console.log(`║ Throttle:    ${this.config.throttle.enabled ? 'ON' : 'OFF'}`);
    console.log(`║ Webhook:     ${this.config.webhook.enabled ? 'ON' : 'OFF'}`);
    console.log('╚══════════════════════════════════════════╝');

    // Load and check proxies
    if (this.config.proxies.length > 0) {
      this.proxyRotator.loadProxies(this.config.proxies);

      if (this.config.proxyHealth.enabled) {
        console.log('\n[Init] Running proxy health check...');
        await this.proxyHealthChecker.checkAll(this.config.proxies, 5);
        const summary = this.proxyHealthChecker.getSummary();
        console.log(`[Init] Proxy Health: ${summary.alive}/${summary.total} alive (avg ${summary.avgLatency}ms)`);

        // Update proxy list with only healthy ones
        const healthyProxies = this.proxyHealthChecker.getHealthyProxies().map(h => h.proxy);
        if (healthyProxies.length > 0) {
          this.proxyRotator.loadProxies(healthyProxies);
        } else {
          console.log('[Init] WARNING: No healthy proxies found, using all');
        }
      }
    } else {
      console.log('\n[Init] No proxies configured (using direct connection)');
    }

    // Start warmup
    if (this.config.warmup.enabled) {
      this.warmupPhase.start();
    }

    console.log('[Init] Ready to start!\n');
  }


  /**
   * Create a single visit session with all features
   */
  async createVisitSession(targetUrl, visitNumber) {
    const startTime = Date.now();
    const agentInfo = this.userAgentRotator.getRandom();
    const viewport = this.viewportRandomizer.getRandom(agentInfo.isMobile);
    const referer = this.refererRandomizer.getRandom();
    const proxy = this.proxyRotator.getRandom();
    const tzData = this.timezoneSpoofer.getRandom();
    const networkProfile = this.config.throttle.enabled
      ? this.bandwidthThrottle.getProfile(agentInfo.isMobile)
      : null;

    const label = `[Visit #${visitNumber}]`;
    console.log(`${label} Starting | ${agentInfo.isMobile ? 'Mobile' : 'Desktop'} | ${viewport.width}x${viewport.height} | ${tzData.city}`);

    let browser;
    try {
      // Build launch options
      const launchArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        `--window-size=${viewport.width},${viewport.height}`,
        '--disable-blink-features=AutomationControlled',
      ];

      // Add proxy
      if (proxy) {
        const formattedProxy = this.proxyRotator.formatForPuppeteer(proxy);
        launchArgs.push(`--proxy-server=${formattedProxy}`);
      }

      // Add DoH resolution
      if (this.config.doh.enabled) {
        const dohArgs = await this.dnsOverHttps.getBrowserArgs(targetUrl);
        launchArgs.push(...dohArgs);
      }

      // Launch browser
      browser = await puppeteer.launch({
        headless: this.config.browser.headless,
        args: launchArgs,
        ignoreHTTPSErrors: true,
      });

      const page = await browser.newPage();

      // Set viewport
      await page.setViewport(this.viewportRandomizer.toPuppeteerConfig(viewport));

      // Set user agent
      await page.setUserAgent(agentInfo.userAgent);

      // Apply timezone & geolocation spoofing
      await this.timezoneSpoofer.applyToPage(page, tzData);

      // Apply fingerprint randomization
      await this.fingerprintRandomizer.apply(page);

      // Apply bandwidth throttling
      if (networkProfile) {
        await this.bandwidthThrottle.apply(page, networkProfile);
      }

      // Set headers
      const headers = {
        'Accept-Language': this.timezoneSpoofer.getAcceptLanguage(tzData),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      };
      if (referer) headers['Referer'] = referer;
      await page.setExtraHTTPHeaders(headers);

      // Authenticate proxy
      if (proxy) {
        const auth = this.proxyRotator.extractAuth(proxy);
        if (auth) await page.authenticate(auth);
      }

      // Inject realistic cookies
      try {
        const domain = new URL(targetUrl).hostname;
        await this.cookieManager.injectRealisticCookies(page, domain);
      } catch (e) {}

      // Navigate to target
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.browser.timeout,
      });

      // Wait for initial load
      await this._randomDelay(this.config.timing.pageLoadWait.min, this.config.timing.pageLoadWait.max);

      // Check for CAPTCHA
      const captchaResult = await this.captchaDetector.detect(page);
      if (captchaResult.detected) {
        const action = await this.captchaDetector.handle(page, captchaResult);
        if (action.action === 'skip') {
          console.log(`${label} CAPTCHA detected, skipping...`);
          await this.webhookNotifier.notifyCaptcha(targetUrl, proxy);
          throw new Error('CAPTCHA detected - skipping');
        }
      }

      // Accept cookie consent
      await this.cookieManager.acceptCookieConsent(page);

      // Simulate human behavior
      const behavior = new HumanBehavior(page, {
        scrollDuration: this.config.behavior.scrollDuration,
        minDelay: this.config.timing.betweenScrolls.min,
        maxDelay: this.config.timing.betweenScrolls.max,
      });

      await behavior.simulateVisit();

      // Click internal links
      if (this.config.behavior.clickInternalLinks) {
        const clicks = Math.floor(Math.random() * this.config.behavior.maxInternalClicks) + 1;
        for (let i = 0; i < clicks; i++) {
          if (Math.random() < 0.5) {
            await behavior.clickRandomLink();
            await behavior.naturalScroll();
          }
        }
      }

      // Tab behavior simulation
      await behavior.simulateTabBehavior();

      // Success
      const duration = Date.now() - startTime;
      this.stats.success++;
      console.log(`${label} ✓ Done (${(duration / 1000).toFixed(1)}s)`);

      // Log stats
      this.statsLogger.logVisit({
        url: targetUrl, success: true, duration,
        proxy, isMobile: agentInfo.isMobile,
        viewport: `${viewport.width}x${viewport.height}`,
        referer, country: tzData.country,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.stats.failed++;
      console.log(`${label} ✗ Failed: ${error.message} (${(duration / 1000).toFixed(1)}s)`);

      if (proxy) this.proxyRotator.markFailed(proxy);

      this.statsLogger.logVisit({
        url: targetUrl, success: false, duration,
        proxy, isMobile: agentInfo.isMobile,
        viewport: `${viewport.width}x${viewport.height}`,
        referer, country: tzData.country,
        error: error.message,
      });
    } finally {
      if (browser) await browser.close();
    }
  }


  /**
   * Run all visits with warmup, traffic pattern, and retry
   */
  async run() {
    await this.init();

    const totalVisits = this.config.visits.totalVisits;
    let visitsDone = 0;

    while (visitsDone < totalVisits) {
      // Check traffic pattern
      if (this.config.trafficPattern.enabled && !this.trafficPattern.shouldRunNow()) {
        console.log(`[Traffic] Low traffic period, pausing 60s...`);
        await this._randomDelay(30000, 60000);
        continue;
      }

      // Calculate batch size
      let batchSize = this.config.visits.concurrentVisits;

      // Warmup phase limits
      if (this.config.warmup.enabled && !this.warmupPhase.isWarmupComplete()) {
        batchSize = Math.min(batchSize, this.warmupPhase.getConcurrentLimit());
      }

      // Traffic pattern adjustment
      if (this.config.trafficPattern.enabled) {
        batchSize = this.trafficPattern.getVisitCount(batchSize);
      }

      batchSize = Math.min(batchSize, totalVisits - visitsDone);

      // Create visit batch with retry
      const promises = [];
      for (let j = 0; j < batchSize; j++) {
        const visitNum = visitsDone + j + 1;
        const target = this.config.targets[Math.floor(Math.random() * this.config.targets.length)];

        const visitFn = () => this.createVisitSession(target, visitNum);
        promises.push(
          this.retryHandler.execute(visitFn, `visit-${visitNum}`).catch(() => {})
        );
      }

      await Promise.all(promises);
      visitsDone += batchSize;
      this.stats.total = visitsDone;

      // Warmup tracking
      if (this.config.warmup.enabled) {
        for (let i = 0; i < batchSize; i++) this.warmupPhase.recordVisit();
      }

      // Progress
      const trafficStatus = this.config.trafficPattern.enabled ? this.trafficPattern.getTrafficStatus() : '';
      console.log(`\n--- Progress: ${visitsDone}/${totalVisits} | ✓${this.stats.success} ✗${this.stats.failed} | ${trafficStatus} ---\n`);

      // Send progress webhook every 25%
      if (visitsDone % Math.ceil(totalVisits / 4) === 0) {
        await this.webhookNotifier.notifyProgress(this.statsLogger.getSummary());
      }

      // Delay between batches
      if (visitsDone < totalVisits) {
        let delay;
        if (this.config.warmup.enabled && !this.warmupPhase.isWarmupComplete()) {
          delay = this.warmupPhase.getDelay();
        } else if (this.config.trafficPattern.enabled) {
          const { min, max } = this.trafficPattern.getDelay(
            this.config.visits.delayBetweenVisits.min,
            this.config.visits.delayBetweenVisits.max
          );
          delay = await this._randomDelay(min, max);
        } else {
          delay = await this._randomDelay(
            this.config.visits.delayBetweenVisits.min,
            this.config.visits.delayBetweenVisits.max
          );
        }
        if (typeof delay === 'number') {
          console.log(`Waiting ${(delay / 1000).toFixed(1)}s...\n`);
        }
      }
    }

    await this._finish();
  }

  /**
   * Run with scheduler (long-running mode)
   */
  async runScheduled() {
    await this.init();

    console.log('[Scheduler] Starting scheduled mode...');
    const { hours, intervalMinutes } = this.config.scheduler;

    this.scheduler.scheduleCron(async () => {
      console.log(`\n[Scheduler] Triggered batch at ${new Date().toLocaleTimeString()}`);
      await this.run();
    }, { hours, minutes: [0] }, 'visitor-cron');

    this.scheduler.start();
    console.log(`[Scheduler] Running at hours: ${hours.join(', ')}`);
    console.log('[Scheduler] Press Ctrl+C to stop\n');

    // Keep alive
    process.on('SIGINT', () => {
      console.log('\n[Scheduler] Shutting down...');
      this.scheduler.stop();
      this._finish().then(() => process.exit(0));
    });
  }

  /**
   * Finish and report
   */
  async _finish() {
    // Print dashboard
    this.statsLogger.printDashboard();

    // Save stats to file
    const logFile = this.statsLogger.saveToFile();
    console.log(`[Stats] Log saved: ${logFile}`);

    // Send webhook notification
    await this.webhookNotifier.notifyComplete(this.statsLogger.getSummary());

    // Print retry stats
    const retryStats = this.retryHandler.getStats();
    if (retryStats.retries > 0) {
      console.log(`[Retry] Total retries: ${retryStats.retries} | Recovered: ${retryStats.recovered} | Abandoned: ${retryStats.abandoned}`);
    }

    // Print CAPTCHA stats
    const captchaStats = this.captchaDetector.getStats();
    if (captchaStats.detected > 0) {
      console.log(`[CAPTCHA] Detected: ${captchaStats.detected} | Bypassed: ${captchaStats.bypassed} | Skipped: ${captchaStats.skipped}`);
    }

    // Print proxy stats
    console.log(`[Proxy] ${JSON.stringify(this.proxyRotator.getStats())}`);
  }

  /**
   * Random delay helper
   */
  async _randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
    return delay;
  }

  /**
   * Deep merge objects
   */
  _deepMerge(...objects) {
    const result = {};
    for (const obj of objects) {
      if (!obj) continue;
      for (const key of Object.keys(obj)) {
        if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          result[key] = this._deepMerge(result[key] || {}, obj[key]);
        } else if (obj[key] !== undefined) {
          result[key] = obj[key];
        }
      }
    }
    return result;
  }
}

// ========================================
// CLI Entry Point
// ========================================
if (require.main === module) {
  const args = process.argv.slice(2);
  const visitor = new AutoVisitor();

  if (args.includes('--scheduled') || args.includes('--cron')) {
    visitor.runScheduled().catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
  } else {
    visitor.run().catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
  }
}

module.exports = AutoVisitor;
