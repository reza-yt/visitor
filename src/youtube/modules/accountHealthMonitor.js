'use strict';

/**
 * Account Health Monitor Module
 * Detects shadowban, limited accounts, or suspicious activity flags
 */

const fs = require('fs');
const path = require('path');

class AccountHealthMonitor {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'health');
    this._ensureDir();
  }

  _ensureDir() { if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true }); }

  /**
   * Run health check on logged-in account
   */
  async checkHealth(page, accountName) {
    const results = {
      accountName,
      timestamp: new Date().toISOString(),
      isLoggedIn: false,
      canComment: true,
      canLike: true,
      hasRestriction: false,
      suspiciousSignals: [],
      score: 100, // 0-100
    };

    // 1. Check login status
    results.isLoggedIn = await this._checkLogin(page);
    if (!results.isLoggedIn) {
      results.score -= 50;
      results.suspiciousSignals.push('not_logged_in');
    }

    // 2. Check for restriction banners
    results.hasRestriction = await this._checkRestrictions(page);
    if (results.hasRestriction) {
      results.score -= 30;
      results.suspiciousSignals.push('restriction_detected');
    }

    // 3. Check if commenting is disabled for account
    results.canComment = await this._checkCommentAbility(page);
    if (!results.canComment) {
      results.score -= 20;
      results.suspiciousSignals.push('comments_disabled');
    }

    // Save result
    this._saveHealth(accountName, results);
    this._printHealth(results);
    return results;
  }

  async _checkLogin(page) {
    return page.evaluate(() => {
      return document.querySelector('#avatar-btn') !== null ||
        document.querySelector('ytd-topbar-menu-button-renderer img') !== null;
    });
  }

  async _checkRestrictions(page) {
    return page.evaluate(() => {
      const body = document.body.innerText.toLowerCase();
      const signals = [
        'unusual activity', 'verify your identity',
        'account has been suspended', 'temporarily locked',
        'confirm you are not a robot', 'action not allowed',
      ];
      return signals.some(s => body.includes(s));
    });
  }

  async _checkCommentAbility(page) {
    // Navigate to a popular video and check comment box
    try {
      const commentBox = await page.$('ytd-comment-simplebox-renderer #placeholder-area');
      return commentBox !== null;
    } catch { return true; } // Assume OK if can't check
  }

  /**
   * Get health status for account
   */
  getStatus(accountName) {
    const filePath = path.join(this.dataDir, `${accountName}.json`);
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return null;
  }

  /**
   * Is account safe to use?
   */
  isSafe(accountName) {
    const status = this.getStatus(accountName);
    if (!status) return true; // Unknown = assume safe
    return status.score >= 50 && !status.hasRestriction;
  }

  _saveHealth(accountName, results) {
    const filePath = path.join(this.dataDir, `${accountName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
  }

  _printHealth(results) {
    const icon = results.score >= 80 ? '✓' : results.score >= 50 ? '⚠' : '✗';
    console.log(`[HealthMonitor] ${icon} ${results.accountName}: score=${results.score}/100${results.suspiciousSignals.length ? ' signals=' + results.suspiciousSignals.join(',') : ''}`);
  }
}

module.exports = AccountHealthMonitor;
