'use strict';

/**
 * Multi-Browser Engine Support Module
 * Supports Puppeteer (Chromium) and Playwright (Chromium, Firefox, WebKit)
 */

class BrowserEngine {
  constructor(options = {}) {
    this.engine = options.engine || 'puppeteer'; // 'puppeteer' or 'playwright'
    this.browserType = options.browserType || 'chromium'; // 'chromium', 'firefox', 'webkit'
    this.engines = ['puppeteer', 'playwright'];
    this.playwrightBrowsers = ['chromium', 'firefox', 'webkit'];
  }

  /**
   * Get random browser engine combination
   */
  getRandomEngine() {
    // 60% puppeteer (stealth), 40% playwright (diversity)
    if (Math.random() < 0.6) {
      return { engine: 'puppeteer', browserType: 'chromium' };
    }
    const browser = this.playwrightBrowsers[Math.floor(Math.random() * this.playwrightBrowsers.length)];
    return { engine: 'playwright', browserType: browser };
  }

  /**
   * Launch browser with given engine
   */
  async launch(config) {
    const { engine, browserType } = config;

    if (engine === 'puppeteer') {
      return this._launchPuppeteer(config);
    } else if (engine === 'playwright') {
      return this._launchPlaywright(config);
    }
    throw new Error(`Unknown engine: ${engine}`);
  }

  /**
   * Launch Puppeteer browser
   */
  async _launchPuppeteer(config) {
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());

    const launchOptions = {
      headless: config.headless || 'new',
      args: config.args || [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
      ignoreHTTPSErrors: true,
    };

    if (config.proxy) {
      launchOptions.args.push(`--proxy-server=${config.proxy}`);
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    return {
      engine: 'puppeteer',
      browser,
      page,
      close: () => browser.close(),
      setViewport: (vp) => page.setViewport(vp),
      setUserAgent: (ua) => page.setUserAgent(ua),
      goto: (url, opts) => page.goto(url, opts),
      evaluate: (...args) => page.evaluate(...args),
      evaluateOnNewDocument: (...args) => page.evaluateOnNewDocument(...args),
      setCookie: (...args) => page.setCookie(...args),
      cookies: () => page.cookies(),
      waitForTimeout: (ms) => page.waitForTimeout(ms),
      $: (sel) => page.$(sel),
      setExtraHTTPHeaders: (h) => page.setExtraHTTPHeaders(h),
      title: () => page.title(),
      url: () => page.url(),
      mouse: page.mouse,
    };
  }

  /**
   * Launch Playwright browser
   */
  async _launchPlaywright(config) {
    let playwright;
    try {
      playwright = require('playwright');
    } catch (e) {
      console.log('[BrowserEngine] Playwright not installed, falling back to Puppeteer');
      return this._launchPuppeteer(config);
    }

    const browserType = config.browserType || 'chromium';
    const launchOptions = {
      headless: config.headless !== false,
      proxy: config.proxy ? { server: config.proxy } : undefined,
    };

    const browser = await playwright[browserType].launch(launchOptions);
    const context = await browser.newContext({
      userAgent: config.userAgent,
      viewport: config.viewport ? { width: config.viewport.width, height: config.viewport.height } : undefined,
      locale: config.locale || 'en-US',
      timezoneId: config.timezone || 'America/New_York',
      geolocation: config.geolocation,
      permissions: config.geolocation ? ['geolocation'] : [],
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    return {
      engine: 'playwright',
      browserType,
      browser,
      context,
      page,
      close: async () => { await context.close(); await browser.close(); },
      setViewport: (vp) => page.setViewportSize(vp),
      setUserAgent: () => {}, // Set in context
      goto: (url, opts) => page.goto(url, opts),
      evaluate: (...args) => page.evaluate(...args),
      evaluateOnNewDocument: (fn, ...args) => context.addInitScript(fn, ...args),
      setCookie: (...cookies) => context.addCookies(cookies),
      cookies: (url) => context.cookies(url),
      waitForTimeout: (ms) => page.waitForTimeout(ms),
      $: (sel) => page.$(sel),
      setExtraHTTPHeaders: (h) => context.setExtraHTTPHeaders(h),
      title: () => page.title(),
      url: () => page.url(),
      mouse: page.mouse,
    };
  }

  /**
   * Get browser fingerprint info for logging
   */
  getFingerprint(config) {
    return `${config.engine}/${config.browserType}`;
  }
}

module.exports = BrowserEngine;
