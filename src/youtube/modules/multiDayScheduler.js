'use strict';

/**
 * Multi-Day Scheduler Module
 * Runs viewer consistently over days/weeks for organic watch hour accumulation
 */

const fs = require('fs');
const path = require('path');

class MultiDayScheduler {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'scheduler');
    this.dailyTargetHours = options.dailyTargetHours || 4;
    this.maxDailyHours = options.maxDailyHours || 8;
    this.activeHours = options.activeHours || { start: 7, end: 23 }; // 7am-11pm
    this.daysOfWeek = options.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]; // All days
    this._ensureDir();
  }

  _ensureDir() { if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true }); }

  /**
   * Get today's schedule status
   */
  getTodayStatus() {
    const today = new Date().toISOString().split('T')[0];
    const log = this._getDayLog(today);
    return {
      date: today,
      watchedHours: (log.totalWatchTime || 0) / 3600,
      targetHours: this.dailyTargetHours,
      sessions: log.sessions || 0,
      remaining: Math.max(0, this.dailyTargetHours - (log.totalWatchTime || 0) / 3600),
      isComplete: (log.totalWatchTime || 0) / 3600 >= this.dailyTargetHours,
      canRunMore: (log.totalWatchTime || 0) / 3600 < this.maxDailyHours,
    };
  }

  /**
   * Should we run now?
   */
  shouldRunNow() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    // Check day of week
    if (!this.daysOfWeek.includes(day)) return false;

    // Check active hours
    if (hour < this.activeHours.start || hour >= this.activeHours.end) return false;

    // Check daily limit
    const status = this.getTodayStatus();
    if (!status.canRunMore) return false;

    return true;
  }

  /**
   * Record watch time for today
   */
  recordWatchTime(seconds) {
    const today = new Date().toISOString().split('T')[0];
    const log = this._getDayLog(today);
    log.totalWatchTime = (log.totalWatchTime || 0) + seconds;
    log.sessions = (log.sessions || 0) + 1;
    log.lastActivity = new Date().toISOString();
    this._saveDayLog(today, log);
  }

  /**
   * Get recommended next run time
   */
  getNextRunTime() {
    const status = this.getTodayStatus();
    if (status.isComplete) {
      // Tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(this.activeHours.start + Math.floor(Math.random() * 3), 0, 0, 0);
      return tomorrow;
    }
    // Random time in next 1-3 hours
    const next = new Date();
    next.setMinutes(next.getMinutes() + Math.floor(Math.random() * 120) + 30);
    return next;
  }

  /**
   * Get weekly summary
   */
  getWeeklySummary() {
    const summary = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const log = this._getDayLog(dateStr);
      summary.push({
        date: dateStr,
        day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()],
        hours: ((log.totalWatchTime || 0) / 3600).toFixed(2),
        sessions: log.sessions || 0,
      });
    }
    const totalHours = summary.reduce((s, d) => s + parseFloat(d.hours), 0);
    return { days: summary, totalHours: totalHours.toFixed(2) };
  }

  /**
   * Run the multi-day loop (long-running process)
   */
  async runLoop(watchFn) {
    console.log('[MultiDayScheduler] Starting multi-day loop...');
    console.log(`[MultiDayScheduler] Target: ${this.dailyTargetHours}h/day, Hours: ${this.activeHours.start}-${this.activeHours.end}`);

    while (true) {
      if (!this.shouldRunNow()) {
        const next = this.getNextRunTime();
        const waitMs = next.getTime() - Date.now();
        console.log(`[MultiDayScheduler] Waiting until ${next.toLocaleTimeString()} (${(waitMs/60000).toFixed(0)}min)`);
        await this._sleep(Math.min(waitMs, 300000)); // Check every 5min max
        continue;
      }

      const status = this.getTodayStatus();
      console.log(`[MultiDayScheduler] Running session (${status.watchedHours.toFixed(2)}h / ${this.dailyTargetHours}h today)`);

      try {
        const watchTime = await watchFn();
        if (watchTime > 0) this.recordWatchTime(watchTime);
      } catch (e) {
        console.log(`[MultiDayScheduler] Session error: ${e.message}`);
      }

      // Random gap between sessions (15min - 2hr)
      const gap = Math.floor(Math.random() * 6300000) + 900000;
      console.log(`[MultiDayScheduler] Next session in ${(gap/60000).toFixed(0)}min`);
      await this._sleep(gap);
    }
  }

  _getDayLog(date) {
    const filePath = path.join(this.dataDir, `${date}.json`);
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {};
  }

  _saveDayLog(date, log) {
    const filePath = path.join(this.dataDir, `${date}.json`);
    fs.writeFileSync(filePath, JSON.stringify(log, null, 2));
  }

  _sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
}

module.exports = MultiDayScheduler;
