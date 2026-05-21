'use strict';

/**
 * Session Storage Persistence Module
 * Persists localStorage/sessionStorage between sessions
 * YouTube uses these to track user state - must be consistent
 */

const fs = require('fs');
const path = require('path');

class SessionPersistence {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'sessions');
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
  }

  /**
   * Save localStorage and sessionStorage from page
   */
  async save(page, accountName) {
    try {
      const data = await page.evaluate(() => {
        const local = {};
        const session = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          local[key] = localStorage.getItem(key);
        }
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          session[key] = sessionStorage.getItem(key);
        }
        return { localStorage: local, sessionStorage: session };
      });

      const filePath = path.join(this.dataDir, `${accountName}.json`);
      const saved = {
        localStorage: data.localStorage,
        sessionStorage: data.sessionStorage,
        savedAt: new Date().toISOString(),
        url: page.url(),
      };
      fs.writeFileSync(filePath, JSON.stringify(saved, null, 2));
      console.log(`[SessionPersistence] Saved ${Object.keys(data.localStorage).length} localStorage keys for ${accountName}`);
      return true;
    } catch (e) {
      console.log(`[SessionPersistence] Save failed: ${e.message}`);
      return false;
    }
  }

  /**
   * Restore localStorage and sessionStorage to page
   */
  async restore(page, accountName) {
    const filePath = path.join(this.dataDir, `${accountName}.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`[SessionPersistence] No saved session for ${accountName}`);
      return false;
    }

    try {
      const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      await page.evaluate((data) => {
        // Restore localStorage
        if (data.localStorage) {
          Object.entries(data.localStorage).forEach(([key, value]) => {
            try { localStorage.setItem(key, value); } catch (e) {}
          });
        }
        // Restore sessionStorage
        if (data.sessionStorage) {
          Object.entries(data.sessionStorage).forEach(([key, value]) => {
            try { sessionStorage.setItem(key, value); } catch (e) {}
          });
        }
      }, saved);

      console.log(`[SessionPersistence] Restored session for ${accountName}`);
      return true;
    } catch (e) {
      console.log(`[SessionPersistence] Restore failed: ${e.message}`);
      return false;
    }
  }

  /**
   * Inject YouTube-specific storage keys that should always exist
   */
  async injectYouTubeDefaults(page) {
    await page.evaluate(() => {
      // YouTube stores these for returning users
      if (!localStorage.getItem('yt-player-volume')) {
        const vol = Math.floor(Math.random() * 40) + 40; // 40-80
        localStorage.setItem('yt-player-volume', JSON.stringify({ data: `{"volume":${vol},"muted":false}`, creation: Date.now() }));
      }
      if (!localStorage.getItem('yt-player-quality')) {
        const qualities = ['auto', 'hd720', 'large', 'medium'];
        const q = qualities[Math.floor(Math.random() * qualities.length)];
        localStorage.setItem('yt-player-quality', JSON.stringify({ data: q, creation: Date.now() }));
      }
      if (!localStorage.getItem('yt-player-autonavstate')) {
        localStorage.setItem('yt-player-autonavstate', JSON.stringify({ data: 'true', creation: Date.now() }));
      }
      // Dark/light theme preference
      if (!localStorage.getItem('yt-player-theater-mode')) {
        const theater = Math.random() < 0.3 ? 'true' : 'false';
        localStorage.setItem('yt-player-theater-mode', JSON.stringify({ data: theater, creation: Date.now() }));
      }
    });
  }

  /**
   * Check if session data exists for account
   */
  hasSession(accountName) {
    const filePath = path.join(this.dataDir, `${accountName}.json`);
    return fs.existsSync(filePath);
  }
}

module.exports = SessionPersistence;
