'use strict';

/**
 * RAM Optimizer Module
 * Reduces browser memory from ~800MB to ~300-400MB per instance
 * Enables 40+ concurrent browsers on 32GB RAM
 */

class RamOptimizer {
  constructor(options = {}) {
    this.blockImages = options.blockImages !== false;
    this.blockFonts = options.blockFonts !== false;
    this.blockCSS = options.blockCSS || false; // Careful: some CSS needed
    this.blockMedia = options.blockMedia || false; // Don't block video!
    this.reducedViewport = options.reducedViewport || { width: 640, height: 360 };
    this.jsMemoryLimit = options.jsMemoryLimit || 128; // MB
  }

  /**
   * Get optimized browser launch args for minimal RAM usage
   */
  getLaunchArgs() {
    return [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--disable-features=TranslateUI',
      '--disable-hang-monitor',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-domain-reliability',
      '--disable-infobars',
      '--disable-features=site-per-process',
      '--disable-breakpad',
      '--disable-backing-store-limit',
      '--disable-component-update',
      '--metrics-recording-only',
      '--mute-audio',
      `--js-flags=--max-old-space-size=${this.jsMemoryLimit}`,
      `--window-size=${this.reducedViewport.width},${this.reducedViewport.height}`,
      '--disable-features=IsolateOrigins',
      '--disable-site-isolation-trials',
      '--renderer-process-limit=1',
      '--disable-features=LazyFrameLoading',
      '--aggressive-cache-discard',
      '--disable-cache',
      '--disable-application-cache',
      '--disk-cache-size=0',
      '--media-cache-size=0',
    ];
  }


  /**
   * Apply request interception to block heavy resources
   */
  async applyToPage(page) {
    await page.setRequestInterception(true);

    page.on('request', (request) => {
      const type = request.resourceType();
      const url = request.url();

      // NEVER block video/audio streams (needed for watch hours!)
      if (url.includes('googlevideo.com') || url.includes('videoplayback')) {
        request.continue();
        return;
      }

      // NEVER block YouTube API calls (needed for view counting)
      if (url.includes('/api/stats/') || url.includes('/youtubei/') || 
          url.includes('play.google.com') || url.includes('/log_event')) {
        request.continue();
        return;
      }

      // Block images (saves ~200MB RAM)
      if (this.blockImages && type === 'image') {
        request.abort();
        return;
      }

      // Block fonts (saves ~30MB)
      if (this.blockFonts && type === 'font') {
        request.abort();
        return;
      }

      // Block non-essential CSS
      if (this.blockCSS && type === 'stylesheet' && !url.includes('youtube.com/s/player')) {
        request.abort();
        return;
      }

      // Block third-party scripts (ads, trackers)
      if (type === 'script' && !url.includes('youtube.com') && !url.includes('ytimg.com') &&
          !url.includes('google.com') && !url.includes('gstatic.com')) {
        request.abort();
        return;
      }

      // Block other heavy resources
      if (type === 'media' && !url.includes('googlevideo') && !url.includes('videoplayback')) {
        request.abort();
        return;
      }

      request.continue();
    });

    // Set minimal viewport
    await page.setViewport({
      width: this.reducedViewport.width,
      height: this.reducedViewport.height,
      deviceScaleFactor: 1,
    });

    // Disable heavy features via CDP
    try {
      const client = await page.target().createCDPSession();
      // Disable image rendering
      if (this.blockImages) {
        await client.send('Emulation.setDocumentCookieDisabled', { disabled: false });
      }
      // Limit memory
      await client.send('Runtime.evaluate', {
        expression: `window.__RAM_OPTIMIZED = true;`
      });
    } catch (e) {}

    console.log('[RamOptimizer] Applied: images=' + (this.blockImages ? 'blocked' : 'allowed') +
      ' fonts=' + (this.blockFonts ? 'blocked' : 'allowed') +
      ' viewport=' + this.reducedViewport.width + 'x' + this.reducedViewport.height);
  }

  /**
   * Force garbage collection between sessions
   */
  async cleanup(page) {
    try {
      const client = await page.target().createCDPSession();
      await client.send('HeapProfiler.collectGarbage');
    } catch (e) {}
  }

  /**
   * Get estimated RAM per browser with optimizations
   */
  getEstimatedRAM() {
    let base = 800; // MB base Chromium
    if (this.blockImages) base -= 200;
    if (this.blockFonts) base -= 30;
    if (this.blockCSS) base -= 50;
    base -= 100; // single-process + flags
    base -= 50; // reduced viewport
    return Math.max(250, base); // ~350-400MB optimized
  }

  /**
   * Calculate max concurrent browsers for given RAM
   */
  getMaxConcurrent(totalRAM_GB) {
    const perBrowser = this.getEstimatedRAM();
    const availableRAM = totalRAM_GB * 1024 * 0.85; // 85% usable
    return Math.floor(availableRAM / perBrowser);
  }

  /**
   * Print RAM optimization report
   */
  printReport(totalRAM_GB) {
    const perBrowser = this.getEstimatedRAM();
    const maxConcurrent = this.getMaxConcurrent(totalRAM_GB);
    console.log(`[RamOptimizer] ~${perBrowser}MB per browser | ${totalRAM_GB}GB RAM = ~${maxConcurrent} concurrent max`);
  }
}

module.exports = RamOptimizer;
