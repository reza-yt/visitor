'use strict';

/**
 * CAPTCHA Detection & Skip Module
 * Detects CAPTCHA/challenge pages and handles them gracefully
 */

class CaptchaDetector {
  constructor(options = {}) {
    this.maxWaitForChallenge = options.maxWaitForChallenge || 10000;
    this.stats = { detected: 0, bypassed: 0, skipped: 0 };

    // Known CAPTCHA/challenge indicators
    this.indicators = {
      titles: [
        'just a moment', 'attention required', 'access denied',
        'are you a robot', 'verify you are human', 'security check',
        'please wait', 'checking your browser', 'ddos protection',
      ],
      selectors: [
        '#cf-challenge-running', '.cf-browser-verification',
        '#challenge-form', '#captcha-form',
        '.g-recaptcha', '#recaptcha',
        '.h-captcha', '#hcaptcha',
        '[data-sitekey]', 'iframe[src*="recaptcha"]',
        'iframe[src*="hcaptcha"]', 'iframe[src*="captcha"]',
        '.challenge-container', '#px-captcha',
        '.antibot', '#challenge-running',
      ],
      urlPatterns: [
        '/cdn-cgi/challenge', '/captcha',
        '/_captcha', '/security-check',
      ],
    };
  }

  /**
   * Check if current page is a CAPTCHA/challenge page
   */
  async detect(page) {
    try {
      // Check page title
      const title = (await page.title()).toLowerCase();
      const titleMatch = this.indicators.titles.some(t => title.includes(t));
      if (titleMatch) {
        this.stats.detected++;
        console.log(`[CaptchaDetector] Detected via title: "${title}"`);
        return { detected: true, type: 'challenge-page', source: 'title' };
      }

      // Check URL patterns
      const url = page.url().toLowerCase();
      const urlMatch = this.indicators.urlPatterns.some(p => url.includes(p));
      if (urlMatch) {
        this.stats.detected++;
        console.log(`[CaptchaDetector] Detected via URL: ${url}`);
        return { detected: true, type: 'challenge-url', source: 'url' };
      }

      // Check for CAPTCHA elements
      for (const selector of this.indicators.selectors) {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await page.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }, element);

          if (isVisible) {
            this.stats.detected++;
            console.log(`[CaptchaDetector] Detected via selector: ${selector}`);
            return { detected: true, type: 'captcha-element', source: selector };
          }
        }
      }

      // Check for Cloudflare challenge
      const cfChallenge = await page.evaluate(() => {
        return document.querySelector('#cf-challenge-running') !== null ||
          document.querySelector('.cf-browser-verification') !== null ||
          (document.body && document.body.innerText.includes('Checking your browser'));
      });

      if (cfChallenge) {
        this.stats.detected++;
        console.log('[CaptchaDetector] Detected Cloudflare challenge');
        return { detected: true, type: 'cloudflare', source: 'cf-check' };
      }

      return { detected: false };
    } catch (err) {
      return { detected: false, error: err.message };
    }
  }

  /**
   * Try to wait for Cloudflare challenge to pass
   */
  async waitForCloudflare(page, timeout) {
    const waitTime = timeout || this.maxWaitForChallenge;
    console.log(`[CaptchaDetector] Waiting for Cloudflare challenge (${waitTime / 1000}s)...`);

    try {
      await page.waitForFunction(() => {
        return !document.querySelector('#cf-challenge-running') &&
          !document.body.innerText.includes('Checking your browser');
      }, { timeout: waitTime });

      this.stats.bypassed++;
      console.log('[CaptchaDetector] Cloudflare challenge passed!');
      return true;
    } catch (e) {
      console.log('[CaptchaDetector] Cloudflare challenge timeout');
      return false;
    }
  }

  /**
   * Handle detected CAPTCHA - returns action to take
   */
  async handle(page, detection) {
    if (!detection.detected) return { action: 'continue' };

    // Try waiting for Cloudflare
    if (detection.type === 'cloudflare') {
      const passed = await this.waitForCloudflare(page);
      if (passed) return { action: 'continue' };
    }

    // For actual CAPTCHAs, skip
    this.stats.skipped++;
    console.log(`[CaptchaDetector] Skipping page (${detection.type}), changing proxy recommended`);
    return {
      action: 'skip',
      reason: detection.type,
      recommendation: 'change_proxy',
    };
  }

  /**
   * Get detection stats
   */
  getStats() {
    return { ...this.stats };
  }
}

module.exports = CaptchaDetector;
