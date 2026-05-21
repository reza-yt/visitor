'use strict';

/**
 * Account Trust & Aging Module
 * Manages account trust scores, aging simulation, and Google trust graph
 * Older accounts with consistent behavior are more trusted by YouTube
 */

const fs = require('fs');
const path = require('path');

class AccountTrust {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'accounts');
    this.minAgeDays = options.minAgeDays || 7;
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Get or create trust profile for an account
   */
  getProfile(accountName) {
    const filePath = path.join(this.dataDir, `${accountName}.json`);

    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    // Create new profile
    const profile = {
      name: accountName,
      createdAt: new Date().toISOString(),
      firstSeen: new Date().toISOString(),
      trustScore: 50, // 0-100 scale
      totalSessions: 0,
      totalWatchHours: 0,
      averageSessionLength: 0,
      consistencyScore: 0,
      lastActivity: null,
      activityLog: [],
      flags: [],
      preferences: {
        avgDailyUsage: 0,
        favoriteHours: [],
        commonDevices: [],
        watchPatterns: [],
      },
    };

    this._saveProfile(profile);
    return profile;
  }


  /**
   * Record activity and update trust score
   */
  recordActivity(accountName, activity) {
    const profile = this.getProfile(accountName);
    const now = new Date();

    profile.totalSessions++;
    profile.lastActivity = now.toISOString();
    profile.totalWatchHours += (activity.watchTime || 0) / 3600;

    // Update average session length
    profile.averageSessionLength = (
      (profile.averageSessionLength * (profile.totalSessions - 1) + (activity.watchTime || 0))
      / profile.totalSessions
    );

    // Add to activity log (keep last 100)
    profile.activityLog.push({
      date: now.toISOString(),
      watchTime: activity.watchTime || 0,
      videosWatched: activity.videosWatched || 0,
      device: activity.device || 'desktop',
      engaged: activity.engaged || false,
      hour: now.getHours(),
    });
    if (profile.activityLog.length > 100) {
      profile.activityLog = profile.activityLog.slice(-100);
    }

    // Update trust score
    profile.trustScore = this._calculateTrust(profile);
    profile.consistencyScore = this._calculateConsistency(profile);

    // Update preferences
    this._updatePreferences(profile);

    this._saveProfile(profile);
    return profile;
  }

  /**
   * Calculate trust score (0-100)
   */
  _calculateTrust(profile) {
    let score = 50; // Base score

    // Age bonus (older = more trusted)
    const ageDays = (Date.now() - new Date(profile.firstSeen).getTime()) / 86400000;
    score += Math.min(20, ageDays * 0.5); // +0.5 per day, max +20

    // Session count bonus
    score += Math.min(15, profile.totalSessions * 0.3); // +0.3 per session, max +15

    // Watch hours bonus
    score += Math.min(10, profile.totalWatchHours * 0.2); // +0.2 per hour, max +10

    // Consistency bonus
    score += profile.consistencyScore * 0.1; // Up to +10

    // Penalties for flags
    score -= profile.flags.length * 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate behavior consistency (how regular is usage)
   */
  _calculateConsistency(profile) {
    if (profile.activityLog.length < 5) return 0;

    const last10 = profile.activityLog.slice(-10);
    const watchTimes = last10.map(a => a.watchTime);

    // Calculate coefficient of variation (lower = more consistent)
    const mean = watchTimes.reduce((a, b) => a + b, 0) / watchTimes.length;
    const variance = watchTimes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / watchTimes.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 1;

    // Convert to 0-100 score (lower CV = higher consistency)
    return Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));
  }

  /**
   * Update usage preference patterns
   */
  _updatePreferences(profile) {
    const logs = profile.activityLog;
    if (logs.length < 3) return;

    // Favorite hours
    const hourCounts = {};
    logs.forEach(l => { hourCounts[l.hour] = (hourCounts[l.hour] || 0) + 1; });
    profile.preferences.favoriteHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([h]) => parseInt(h));

    // Average daily usage
    const totalTime = logs.reduce((s, l) => s + l.watchTime, 0);
    const days = Math.max(1, (Date.now() - new Date(logs[0].date).getTime()) / 86400000);
    profile.preferences.avgDailyUsage = totalTime / days;

    // Common devices
    const deviceCounts = {};
    logs.forEach(l => { deviceCounts[l.device] = (deviceCounts[l.device] || 0) + 1; });
    profile.preferences.commonDevices = Object.entries(deviceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([d]) => d);
  }

  /**
   * Check if account should be used now (based on patterns)
   */
  shouldUseNow(accountName) {
    const profile = this.getProfile(accountName);
    const now = new Date();
    const currentHour = now.getHours();

    // If account has favorite hours, prefer those
    if (profile.preferences.favoriteHours.length > 0) {
      const nearFavorite = profile.preferences.favoriteHours.some(
        h => Math.abs(h - currentHour) <= 2
      );
      if (!nearFavorite && Math.random() > 0.3) return false;
    }

    // Don't use too frequently
    if (profile.lastActivity) {
      const hoursSinceLastUse = (Date.now() - new Date(profile.lastActivity).getTime()) / 3600000;
      if (hoursSinceLastUse < 0.5) return false; // At least 30min between sessions
    }

    return true;
  }

  /**
   * Get recommended session length for account (based on history)
   */
  getRecommendedSessionLength(accountName) {
    const profile = this.getProfile(accountName);

    if (profile.averageSessionLength > 0) {
      // Vary ±30% around average
      const base = profile.averageSessionLength;
      const variance = base * 0.3;
      return base + (Math.random() * variance * 2 - variance);
    }

    // Default: 10-30 minutes for new accounts
    return Math.floor(Math.random() * 1200) + 600;
  }

  /**
   * Flag an account for suspicious activity
   */
  flagAccount(accountName, reason) {
    const profile = this.getProfile(accountName);
    profile.flags.push({ reason, date: new Date().toISOString() });
    profile.trustScore = this._calculateTrust(profile);
    this._saveProfile(profile);
    console.log(`[AccountTrust] ⚠ Account flagged: ${accountName} - ${reason}`);
  }

  /**
   * Get accounts sorted by trust score
   */
  getAccountsByTrust(accountNames) {
    return accountNames
      .map(name => ({ name, ...this.getProfile(name) }))
      .sort((a, b) => b.trustScore - a.trustScore);
  }

  _saveProfile(profile) {
    const filePath = path.join(this.dataDir, `${profile.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2));
  }
}

module.exports = AccountTrust;
