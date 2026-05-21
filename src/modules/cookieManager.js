'use strict';

/**
 * Cookie & Session Management Module
 * Handles cookie consent popups, session persistence, and cookie randomization
 */

const fs = require('fs');
const path = require('path');

class CookieManager {
  constructor(options = {}) {
    this.sessionDir = options.sessionDir || path.join(process.cwd(), 'sessions');
    this.acceptCookieSelectors = [
      // Common cookie consent selectors
      '[id*="accept"]', '[class*="accept"]',
      '[id*="cookie"] button', '[class*="cookie"] button',
      '[id*="consent"] button', '[class*="consent"] button',
      'button[data-cookiefirst-action="accept"]',
      '.cookie-banner button', '.cookie-popup button',
      '#onetrust-accept-btn-handler',
      '.cc-accept', '.cc-btn.cc-dismiss',
      '[aria-label*="accept"]', '[aria-label*="Accept"]',
      '.gdpr-accept', '#gdpr-accept',
      'button[data-testid="cookie-accept"]',
      '.CookieConsent button', '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
      '.js-cookie-consent-agree', '.cookie-notice-accept',
    ];
    this._ensureSessionDir();
  }

  _ensureSessionDir() {
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  /**
   * Auto-accept cookie consent popups
   */
  async acceptCookieConsent(page) {
    await page.waitForTimeout(2000); // Wait for popup to appear

    for (const selector of this.acceptCookieSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          const isVisible = await page.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
          }, btn);

          if (isVisible) {
            await btn.click();
            console.log(`[CookieManager] Accepted cookie consent via: ${selector}`);
            await page.waitForTimeout(1000);
            return true;
          }
        }
      } catch (e) {
        // Selector not found, continue
      }
    }
    console.log('[CookieManager] No cookie consent popup found');
    return false;
  }

  /**
   * Save session cookies to file
   */
  async saveSession(page, sessionId) {
    const cookies = await page.cookies();
    const filePath = path.join(this.sessionDir, `${sessionId}.json`);
    const sessionData = {
      cookies,
      savedAt: new Date().toISOString(),
      url: page.url(),
    };
    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
    console.log(`[CookieManager] Session saved: ${sessionId} (${cookies.length} cookies)`);
    return filePath;
  }

  /**
   * Load session cookies from file
   */
  async loadSession(page, sessionId) {
    const filePath = path.join(this.sessionDir, `${sessionId}.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`[CookieManager] No saved session: ${sessionId}`);
      return false;
    }

    const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    await page.setCookie(...sessionData.cookies);
    console.log(`[CookieManager] Session loaded: ${sessionId} (${sessionData.cookies.length} cookies)`);
    return true;
  }

  /**
   * Generate random session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Clear all saved sessions
   */
  clearSessions() {
    const files = fs.readdirSync(this.sessionDir);
    files.forEach(f => fs.unlinkSync(path.join(this.sessionDir, f)));
    console.log(`[CookieManager] Cleared ${files.length} saved sessions`);
  }

  /**
   * Inject realistic cookies (GA, fbp, etc.)
   */
  async injectRealisticCookies(page, domain) {
    const now = Date.now();
    const fakeCookies = [
      {
        name: '_ga',
        value: `GA1.2.${Math.floor(Math.random() * 9999999999)}.${Math.floor(now / 1000) - Math.floor(Math.random() * 86400 * 30)}`,
        domain,
        path: '/',
        expires: Math.floor(now / 1000) + 63072000,
      },
      {
        name: '_gid',
        value: `GA1.2.${Math.floor(Math.random() * 9999999999)}.${Math.floor(now / 1000)}`,
        domain,
        path: '/',
        expires: Math.floor(now / 1000) + 86400,
      },
      {
        name: '_fbp',
        value: `fb.1.${now}.${Math.floor(Math.random() * 9999999999)}`,
        domain,
        path: '/',
        expires: Math.floor(now / 1000) + 7776000,
      },
    ];

    await page.setCookie(...fakeCookies);
    console.log(`[CookieManager] Injected ${fakeCookies.length} realistic cookies for ${domain}`);
  }
}

module.exports = CookieManager;
