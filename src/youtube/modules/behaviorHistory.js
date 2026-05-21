'use strict';

/**
 * Long-term Behavior History Module
 * Tracks and simulates consistent long-term viewing patterns
 * Makes accounts appear to have organic viewing history
 */

const fs = require('fs');
const path = require('path');

class BehaviorHistory {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'history');
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Get viewing history for an account
   */
  getHistory(accountName) {
    const filePath = path.join(this.dataDir, `${accountName}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return {
      accountName,
      watchHistory: [],
      searchHistory: [],
      categories: {},
      totalVideosWatched: 0,
      totalHoursWatched: 0,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Record a video watch event
   */
  recordWatch(accountName, data) {
    const history = this.getHistory(accountName);
    const entry = {
      videoId: data.videoId,
      title: data.title || '',
      channel: data.channel || '',
      duration: data.duration || 0,
      watchTime: data.watchTime || 0,
      watchPercent: data.watchPercent || 0,
      category: data.category || 'unknown',
      liked: data.liked || false,
      commented: data.commented || false,
      timestamp: new Date().toISOString(),
    };

    history.watchHistory.push(entry);
    history.totalVideosWatched++;
    history.totalHoursWatched += (data.watchTime || 0) / 3600;

    // Track category preferences
    const cat = data.category || 'unknown';
    history.categories[cat] = (history.categories[cat] || 0) + 1;

    // Keep last 500 entries
    if (history.watchHistory.length > 500) {
      history.watchHistory = history.watchHistory.slice(-500);
    }

    this._saveHistory(accountName, history);
    return history;
  }


  /**
   * Record a search query
   */
  recordSearch(accountName, query) {
    const history = this.getHistory(accountName);
    history.searchHistory.push({
      query,
      timestamp: new Date().toISOString(),
    });
    if (history.searchHistory.length > 100) {
      history.searchHistory = history.searchHistory.slice(-100);
    }
    this._saveHistory(accountName, history);
  }

  /**
   * Generate organic pre-watch behavior
   * Before watching target video, simulate browsing patterns
   */
  async simulateOrganicBrowsing(page, accountName) {
    const history = this.getHistory(accountName);
    const actions = [];

    // 1. Browse YouTube home page
    actions.push({ type: 'home', duration: this._randomBetween(5, 15) });

    // 2. Maybe search something related
    if (Math.random() < 0.4) {
      const query = this._generateSearchQuery(history);
      actions.push({ type: 'search', query, duration: this._randomBetween(3, 10) });
    }

    // 3. Maybe watch a short recommended video first
    if (Math.random() < 0.3) {
      actions.push({ type: 'watch_recommended', duration: this._randomBetween(30, 120) });
    }

    // 4. Browse Shorts (very common behavior)
    if (Math.random() < 0.25) {
      actions.push({ type: 'browse_shorts', count: this._randomBetween(2, 5) });
    }

    console.log(`[BehaviorHistory] Organic browsing plan: ${actions.map(a => a.type).join(' → ')}`);

    // Execute actions
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'home':
            await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(action.duration * 1000);
            await this._scrollHome(page);
            break;

          case 'search':
            await this._performSearch(page, action.query);
            await page.waitForTimeout(action.duration * 1000);
            this.recordSearch(accountName, action.query);
            break;

          case 'watch_recommended':
            await this._clickRecommended(page);
            await page.waitForTimeout(action.duration * 1000);
            break;

          case 'browse_shorts':
            await this._browseShorts(page, action.count);
            break;
        }
      } catch (e) {
        console.log(`[BehaviorHistory] Organic action failed: ${e.message}`);
      }
    }
  }

  /**
   * Get viewing pattern for time-of-day (for realistic scheduling)
   */
  getPreferredWatchingTimes(accountName) {
    const history = this.getHistory(accountName);
    const hourCounts = {};

    history.watchHistory.forEach(w => {
      const hour = new Date(w.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return hourCounts;
  }

  /**
   * Get top categories for this account
   */
  getTopCategories(accountName, limit = 5) {
    const history = this.getHistory(accountName);
    return Object.entries(history.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([cat, count]) => ({ category: cat, count }));
  }

  async _scrollHome(page) {
    for (let i = 0; i < this._randomBetween(3, 8); i++) {
      await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
      await page.waitForTimeout(this._randomBetween(1000, 3000));
    }
  }

  async _performSearch(page, query) {
    try {
      const searchInput = await page.$('input#search');
      if (searchInput) {
        await searchInput.click();
        await page.waitForTimeout(500);
        await page.keyboard.type(query, { delay: this._randomBetween(50, 150) });
        await page.waitForTimeout(this._randomBetween(500, 1500));
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
      }
    } catch (e) {}
  }

  async _clickRecommended(page) {
    try {
      const videos = await page.$$('ytd-rich-item-renderer, ytd-video-renderer');
      if (videos.length > 0) {
        const randomVideo = videos[Math.floor(Math.random() * Math.min(videos.length, 10))];
        await randomVideo.click();
        await page.waitForTimeout(5000);
      }
    } catch (e) {}
  }

  async _browseShorts(page, count) {
    try {
      await page.goto('https://www.youtube.com/shorts', { waitUntil: 'domcontentloaded', timeout: 30000 });
      for (let i = 0; i < count; i++) {
        await page.waitForTimeout(this._randomBetween(5000, 15000));
        // Swipe/scroll to next short
        await page.keyboard.press('ArrowDown');
      }
    } catch (e) {}
  }

  _generateSearchQuery(history) {
    const genericQueries = [
      'tutorial programming', 'music hits 2024', 'cooking recipe',
      'gaming walkthrough', 'tech review', 'workout routine',
      'travel vlog', 'funny videos', 'how to edit video',
      'podcast indonesia', 'belajar coding', 'tips produktif',
    ];
    return genericQueries[Math.floor(Math.random() * genericQueries.length)];
  }

  _saveHistory(accountName, history) {
    const filePath = path.join(this.dataDir, `${accountName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
  }

  _randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

module.exports = BehaviorHistory;
