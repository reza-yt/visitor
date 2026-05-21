'use strict';

/**
 * Cookie Login Module for YouTube
 * Login menggunakan exported cookies dari browser (Netscape/JSON format)
 * Supports multiple accounts dengan rotation
 */

const fs = require('fs');
const path = require('path');

class CookieLogin {
  constructor(options = {}) {
    this.cookiesDir = options.cookiesDir || path.join(process.cwd(), 'cookies');
    this.accounts = []; // Array of { name, cookies, lastUsed, loginStatus }
    this.activeAccount = null;
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.cookiesDir)) {
      fs.mkdirSync(this.cookiesDir, { recursive: true });
    }
  }

  /**
   * Load all cookie files from cookies directory
   * Supports: .json (Puppeteer format) and .txt (Netscape format)
   */
  loadAllAccounts() {
    const files = fs.readdirSync(this.cookiesDir)
      .filter(f => f.endsWith('.json') || f.endsWith('.txt'));

    this.accounts = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.cookiesDir, file);
        const cookies = this._parseCookieFile(filePath);

        if (cookies && cookies.length > 0) {
          const accountName = path.basename(file, path.extname(file));
          this.accounts.push({
            name: accountName,
            file: filePath,
            cookies,
            lastUsed: null,
            loginStatus: 'unknown', // unknown, valid, expired, banned
            sessionsToday: 0,
            totalWatchTime: 0,
          });
          console.log(`[CookieLogin] Loaded account: ${accountName} (${cookies.length} cookies)`);
        }
      } catch (err) {
        console.log(`[CookieLogin] Failed to load ${file}: ${err.message}`);
      }
    }

    console.log(`[CookieLogin] Total accounts loaded: ${this.accounts.length}`);
    return this.accounts;
  }

  /**
   * Parse cookie file (auto-detect format)
   */
  _parseCookieFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8').trim();

    // JSON format (Puppeteer/EditThisCookie export)
    if (content.startsWith('[') || content.startsWith('{')) {
      return this._parseJsonCookies(content);
    }

    // Netscape format (cookies.txt from browser extensions)
    return this._parseNetscapeCookies(content);
  }

  /**
   * Parse JSON cookie format
   * Supports: Puppeteer format and EditThisCookie format
   */
  _parseJsonCookies(content) {
    let data = JSON.parse(content);
    if (!Array.isArray(data)) data = [data];

    return data.map(cookie => {
      // Normalize to Puppeteer format
      return {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || '.youtube.com',
        path: cookie.path || '/',
        expires: cookie.expires || cookie.expirationDate || -1,
        httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : false,
        secure: cookie.secure !== undefined ? cookie.secure : true,
        sameSite: cookie.sameSite || 'Lax',
      };
    }).filter(c => c.name && c.value);
  }

  /**
   * Parse Netscape/Mozilla cookie.txt format
   * Format: domain\tflag\tpath\tsecure\texpiry\tname\tvalue
   */
  _parseNetscapeCookies(content) {
    const cookies = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const parts = trimmed.split('\t');
      if (parts.length >= 7) {
        cookies.push({
          domain: parts[0],
          path: parts[2],
          secure: parts[3].toLowerCase() === 'true',
          expires: parseInt(parts[4], 10) || -1,
          name: parts[5],
          value: parts[6],
          httpOnly: parts[0].startsWith('#HttpOnly_') || false,
          sameSite: 'Lax',
        });
      }
    }

    return cookies;
  }

  /**
   * Get next available account (rotation + cooldown)
   */
  getNextAccount(cooldownMinutes = 30) {
    const now = Date.now();
    const cooldownMs = cooldownMinutes * 60 * 1000;

    // Filter available accounts (respect cooldown)
    const available = this.accounts.filter(acc => {
      if (acc.loginStatus === 'banned' || acc.loginStatus === 'expired') return false;
      if (acc.lastUsed && (now - acc.lastUsed) < cooldownMs) return false;
      return true;
    });

    if (available.length === 0) {
      console.log('[CookieLogin] All accounts on cooldown, using least recently used');
      // Fallback: use least recently used
      const sorted = this.accounts
        .filter(a => a.loginStatus !== 'banned')
        .sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
      return sorted[0] || null;
    }

    // Pick random from available
    const account = available[Math.floor(Math.random() * available.length)];
    return account;
  }

  /**
   * Apply cookies to browser page (login)
   */
  async login(page, account) {
    if (!account || !account.cookies) {
      console.log('[CookieLogin] No account to login');
      return false;
    }

    this.activeAccount = account;
    account.lastUsed = Date.now();

    try {
      // Navigate to YouTube first (required for cookie domain)
      await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Filter YouTube-related cookies
      const ytCookies = account.cookies.filter(c =>
        c.domain.includes('youtube.com') ||
        c.domain.includes('google.com') ||
        c.domain.includes('.google.') ||
        c.domain.includes('accounts.google')
      );

      // Set cookies
      await page.setCookie(...ytCookies);
      console.log(`[CookieLogin] Set ${ytCookies.length} cookies for account: ${account.name}`);

      // Reload to apply cookies
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);

      // Verify login
      const isLoggedIn = await this._verifyLogin(page);
      account.loginStatus = isLoggedIn ? 'valid' : 'expired';

      if (isLoggedIn) {
        console.log(`[CookieLogin] ✓ Successfully logged in as: ${account.name}`);
      } else {
        console.log(`[CookieLogin] ✗ Login failed for: ${account.name} (cookies expired?)`);
      }

      return isLoggedIn;
    } catch (err) {
      console.log(`[CookieLogin] Login error: ${err.message}`);
      account.loginStatus = 'expired';
      return false;
    }
  }

  /**
   * Verify if login is successful
   */
  async _verifyLogin(page) {
    try {
      // Check for avatar/account menu (indicates logged in)
      const selectors = [
        '#avatar-btn',                          // Avatar button
        'button#avatar-btn',
        'yt-img-shadow.ytd-topbar-menu-button-renderer img', // Profile pic
        '#channel-header-flex',                 // Channel name in header
        'ytd-topbar-menu-button-renderer',
      ];

      for (const selector of selectors) {
        const el = await page.$(selector);
        if (el) return true;
      }

      // Alternative: check if sign-in button is NOT visible
      const signInBtn = await page.$('a[href*="accounts.google.com/ServiceLogin"]');
      const signInLink = await page.$('ytd-button-renderer a[href*="accounts.google"]');

      if (!signInBtn && !signInLink) {
        // No sign-in button found, likely logged in
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Save updated cookies after session (for keeping session alive)
   */
  async saveCookies(page, account) {
    if (!account) return;

    try {
      const cookies = await page.cookies('https://www.youtube.com', 'https://accounts.google.com');
      if (cookies.length > 0) {
        account.cookies = cookies;
        fs.writeFileSync(account.file, JSON.stringify(cookies, null, 2));
        console.log(`[CookieLogin] Updated cookies for: ${account.name} (${cookies.length} cookies)`);
      }
    } catch (err) {
      console.log(`[CookieLogin] Failed to save cookies: ${err.message}`);
    }
  }

  /**
   * Mark account as banned/suspended
   */
  markBanned(account) {
    if (account) {
      account.loginStatus = 'banned';
      console.log(`[CookieLogin] ⚠ Account marked as banned: ${account.name}`);
    }
  }

  /**
   * Record watch time for account
   */
  recordWatchTime(account, seconds) {
    if (account) {
      account.totalWatchTime += seconds;
      account.sessionsToday++;
    }
  }

  /**
   * Get account stats
   */
  getStats() {
    return {
      total: this.accounts.length,
      valid: this.accounts.filter(a => a.loginStatus === 'valid').length,
      expired: this.accounts.filter(a => a.loginStatus === 'expired').length,
      banned: this.accounts.filter(a => a.loginStatus === 'banned').length,
      unknown: this.accounts.filter(a => a.loginStatus === 'unknown').length,
      active: this.activeAccount ? this.activeAccount.name : null,
    };
  }

  /**
   * Get all accounts summary
   */
  listAccounts() {
    return this.accounts.map(a => ({
      name: a.name,
      status: a.loginStatus,
      sessionsToday: a.sessionsToday,
      totalWatchTime: `${(a.totalWatchTime / 3600).toFixed(2)}h`,
      lastUsed: a.lastUsed ? new Date(a.lastUsed).toLocaleTimeString() : 'never',
    }));
  }
}

module.exports = CookieLogin;
