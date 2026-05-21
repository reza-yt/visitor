'use strict';

/**
 * Watch History Bypass Module
 * Ensures YouTube counts views by varying watch patterns
 * Avoids watching same video too many times from same account
 */

const fs = require('fs');
const path = require('path');

class WatchHistoryBypass {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'watch-log');
    this.maxRepeats = options.maxRepeats || 3; // Max times to watch same video per account per week
    this.cooldownHours = options.cooldownHours || 24; // Min hours between same video+account
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
  }

  /**
   * Check if account can watch this video (not too many repeats)
   */
  canWatch(accountName, videoId) {
    const log = this._getLog(accountName);
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // Count watches this week
    const recentWatches = (log[videoId] || []).filter(ts => ts > weekAgo);
    if (recentWatches.length >= this.maxRepeats) {
      console.log(`[HistoryBypass] ${accountName} already watched ${videoId} ${recentWatches.length}x this week, skipping`);
      return false;
    }

    // Check cooldown
    const lastWatch = recentWatches[recentWatches.length - 1];
    if (lastWatch && (Date.now() - lastWatch) < this.cooldownHours * 3600000) {
      console.log(`[HistoryBypass] ${accountName} watched ${videoId} too recently, cooldown active`);
      return false;
    }

    return true;
  }

  /**
   * Record a watch event
   */
  recordWatch(accountName, videoId) {
    const log = this._getLog(accountName);
    if (!log[videoId]) log[videoId] = [];
    log[videoId].push(Date.now());

    // Keep only last 30 days of data
    const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    log[videoId] = log[videoId].filter(ts => ts > monthAgo);

    this._saveLog(accountName, log);
  }

  /**
   * Get next best video for account (least recently watched)
   */
  getBestVideo(accountName, videoList) {
    const log = this._getLog(accountName);
    
    // Score each video (lower = better to watch)
    const scored = videoList.map(video => {
      const videoId = this._extractId(video);
      const watches = log[videoId] || [];
      const lastWatch = watches[watches.length - 1] || 0;
      const weekCount = watches.filter(ts => ts > Date.now() - 604800000).length;

      return {
        video,
        videoId,
        score: weekCount * 1000 + (lastWatch / 1000000), // Prefer least watched
        canWatch: this.canWatch(accountName, videoId),
      };
    });

    // Filter watchable, sort by score (lowest first)
    const available = scored.filter(s => s.canWatch).sort((a, b) => a.score - b.score);
    
    if (available.length === 0) {
      console.log(`[HistoryBypass] No available videos for ${accountName}, using random`);
      return videoList[Math.floor(Math.random() * videoList.length)];
    }

    // Pick from top 3 (add randomness)
    const top = available.slice(0, Math.min(3, available.length));
    return top[Math.floor(Math.random() * top.length)].video;
  }

  /**
   * Vary the entry point (don't always start from beginning)
   * Returns a start time offset in seconds
   */
  getStartOffset(videoDuration) {
    // 80% start from beginning, 20% start from random point (like resuming)
    if (Math.random() < 0.8) return 0;
    return Math.floor(Math.random() * videoDuration * 0.3); // Start within first 30%
  }

  /**
   * Get watch stats for an account
   */
  getStats(accountName) {
    const log = this._getLog(accountName);
    const weekAgo = Date.now() - 604800000;
    let totalThisWeek = 0;
    let uniqueVideos = 0;

    Object.entries(log).forEach(([videoId, timestamps]) => {
      const weekWatches = timestamps.filter(ts => ts > weekAgo).length;
      if (weekWatches > 0) {
        totalThisWeek += weekWatches;
        uniqueVideos++;
      }
    });

    return { totalThisWeek, uniqueVideos, videosTracked: Object.keys(log).length };
  }

  _getLog(accountName) {
    const filePath = path.join(this.dataDir, `${accountName}.json`);
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {};
  }

  _saveLog(accountName, log) {
    const filePath = path.join(this.dataDir, `${accountName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(log, null, 2));
  }

  _extractId(url) {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : url;
  }
}

module.exports = WatchHistoryBypass;
