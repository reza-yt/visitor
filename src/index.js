'use strict';

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const ProxyRotator = require('./modules/proxyRotator');
const UserAgentRotator = require('./modules/userAgentRotator');
const ViewportRandomizer = require('./modules/viewportRandomizer');
const RefererRandomizer = require('./modules/refererRandomizer');
const HumanBehavior = require('./modules/humanBehavior');
const config = require('./config');

// Apply stealth plugin
puppeteer.use(StealthPlugin());

class AutoVisitor {
  constructor(customConfig = {}) {
    this.config = { ...config, ...customConfig };
    this.proxyRotator = new ProxyRotator();
    this.userAgentRotator = new UserAgentRotator({ mobileRatio: this.config.mobile.ratio });
    this.viewportRandomizer = new ViewportRandomizer();
    this.refererRandomizer = new RefererRandomizer();
    this.stats = { success: 0, failed: 0, total: 0 };
  }

  /**
   * Initialize the visitor
   */
  async init() {
    console.log('========================================');
    console.log('   AUTO VISITOR - Human Behavior Bot');
    console.log('========================================');
    console.log(`Targets: ${this.config.targets.length} URLs`);
    console.log(`Total Visits: ${this.config.visits.totalVisits}`);
    console.log(`Concurrent: ${this.config.visits.concurrentVisits}`);
    console.log(`Mobile Ratio: ${this.config.mobile.ratio * 100}%`);

    if (this.config.proxies.length > 0) {
      this.proxyRotator.loadProxies(this.config.proxies);
      console.log(`Proxies: ${this.config.proxies.length} loaded`);
    } else {
      console.log('Proxies: None (using direct connection)');
    }
    console.log('========================================\n');
  }


  /**
   * Create a single visit session
   */
  async createVisitSession(targetUrl, visitNumber) {
    const agentInfo = this.userAgentRotator.getRandom();
    const viewport = this.viewportRandomizer.getRandom(agentInfo.isMobile);
    const referer = this.refererRandomizer.getRandom();
    const proxy = this.proxyRotator.getRandom();

    const label = `[Visit #${visitNumber}]`;
    console.log(`${label} Starting...`);
    console.log(`${label} UA: ${agentInfo.isMobile ? 'Mobile' : 'Desktop'}`);
    console.log(`${label} Viewport: ${viewport.width}x${viewport.height}`);
    console.log(`${label} Referer: ${referer || '(direct)'}`);
    if (proxy) console.log(`${label} Proxy: ${proxy.substring(0, 30)}...`);

    let browser;
    try {
      const launchOptions = {
        headless: this.config.browser.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=' + viewport.width + ',' + viewport.height,
          '--disable-blink-features=AutomationControlled',
        ],
        ignoreHTTPSErrors: this.config.browser.ignoreHTTPSErrors,
      };

      // Add proxy if available
      if (proxy) {
        const formattedProxy = this.proxyRotator.formatForPuppeteer(proxy);
        launchOptions.args.push(`--proxy-server=${formattedProxy}`);
      }

      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();

      // Set viewport
      await page.setViewport(this.viewportRandomizer.toPuppeteerConfig(viewport));

      // Set user agent
      await page.setUserAgent(agentInfo.userAgent);

      // Set extra headers (referer, accept-language)
      const headers = {
        'Accept-Language': this._getRandomLanguage(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      };
      if (referer) headers['Referer'] = referer;
      await page.setExtraHTTPHeaders(headers);

      // Authenticate proxy if needed
      if (proxy) {
        const auth = this.proxyRotator.extractAuth(proxy);
        if (auth) {
          await page.authenticate(auth);
        }
      }

      // Navigate to target
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.browser.timeout,
      });

      // Wait for initial load
      await this._randomDelay(
        this.config.timing.pageLoadWait.min,
        this.config.timing.pageLoadWait.max
      );

      // Simulate human behavior
      const behavior = new HumanBehavior(page, {
        scrollDuration: this.config.behavior.scrollDuration,
        minDelay: this.config.timing.betweenScrolls.min,
        maxDelay: this.config.timing.betweenScrolls.max,
      });

      await behavior.simulateVisit();

      // Click internal links if enabled
      if (this.config.behavior.clickInternalLinks) {
        const clicks = Math.floor(Math.random() * this.config.behavior.maxInternalClicks) + 1;
        for (let i = 0; i < clicks; i++) {
          if (Math.random() < 0.5) {
            await behavior.clickRandomLink();
            await behavior.naturalScroll();
          }
        }
      }

      this.stats.success++;
      console.log(`${label} ✓ Completed successfully`);

    } catch (error) {
      this.stats.failed++;
      console.log(`${label} ✗ Failed: ${error.message}`);
      if (proxy) this.proxyRotator.markFailed(proxy);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }


  /**
   * Run all visits
   */
  async run() {
    await this.init();

    const totalVisits = this.config.visits.totalVisits;
    const concurrent = this.config.visits.concurrentVisits;

    for (let i = 0; i < totalVisits; i += concurrent) {
      const batch = Math.min(concurrent, totalVisits - i);
      const promises = [];

      for (let j = 0; j < batch; j++) {
        const visitNum = i + j + 1;
        const target = this.config.targets[Math.floor(Math.random() * this.config.targets.length)];
        promises.push(this.createVisitSession(target, visitNum));
      }

      await Promise.all(promises);
      this.stats.total += batch;

      // Progress update
      console.log(`\n--- Progress: ${this.stats.total}/${totalVisits} | Success: ${this.stats.success} | Failed: ${this.stats.failed} ---\n`);

      // Delay between batches
      if (i + concurrent < totalVisits) {
        const delay = await this._randomDelay(
          this.config.visits.delayBetweenVisits.min,
          this.config.visits.delayBetweenVisits.max
        );
        console.log(`Waiting ${(delay / 1000).toFixed(1)}s before next batch...\n`);
      }
    }

    this._printReport();
  }

  /**
   * Get random accept language
   */
  _getRandomLanguage() {
    const languages = [
      'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'en-US,en;q=0.9',
      'en-GB,en;q=0.9,en-US;q=0.8',
      'id-ID,id;q=0.9,en;q=0.8',
      'ms-MY,ms;q=0.9,en;q=0.8',
      'en-US,en;q=0.9,id;q=0.8',
    ];
    return languages[Math.floor(Math.random() * languages.length)];
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
   * Print final report
   */
  _printReport() {
    console.log('\n========================================');
    console.log('          VISIT REPORT');
    console.log('========================================');
    console.log(`Total Visits:  ${this.stats.total}`);
    console.log(`Successful:    ${this.stats.success}`);
    console.log(`Failed:        ${this.stats.failed}`);
    console.log(`Success Rate:  ${((this.stats.success / this.stats.total) * 100).toFixed(1)}%`);
    console.log(`Proxy Stats:   ${JSON.stringify(this.proxyRotator.getStats())}`);
    console.log('========================================\n');
  }
}

// Run if called directly
if (require.main === module) {
  const visitor = new AutoVisitor();
  visitor.run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = AutoVisitor;
