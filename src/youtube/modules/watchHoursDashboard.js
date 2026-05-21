'use strict';

/**
 * Watch Hours Dashboard Module
 * Tracks total watch hours per channel, per day/week/month
 * Shows progress toward 4000 hour monetization goal
 */

const fs = require('fs');
const path = require('path');

class WatchHoursDashboard {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'dashboard');
    this.targetHours = options.targetHours || 4000; // Monetization requirement
    this._ensureDir();
  }

  _ensureDir() { if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true }); }

  /**
   * Record watch time
   */
  record(data) {
    const today = new Date().toISOString().split('T')[0];
    const log = this._getLog();

    if (!log.daily[today]) log.daily[today] = { seconds: 0, sessions: 0, videos: 0 };
    log.daily[today].seconds += data.watchTime || 0;
    log.daily[today].sessions++;
    log.daily[today].videos += data.videosWatched || 1;
    log.totalSeconds += data.watchTime || 0;
    log.totalSessions++;
    log.totalVideos += data.videosWatched || 1;
    log.lastUpdate = new Date().toISOString();

    this._saveLog(log);
  }

  /**
   * Print dashboard to console
   */
  printDashboard() {
    const log = this._getLog();
    const totalHours = (log.totalSeconds / 3600).toFixed(2);
    const progress = ((log.totalSeconds / 3600 / this.targetHours) * 100).toFixed(1);
    const today = new Date().toISOString().split('T')[0];
    const todayData = log.daily[today] || { seconds: 0, sessions: 0, videos: 0 };
    const todayHours = (todayData.seconds / 3600).toFixed(2);

    // Weekly calculation
    const weekSeconds = this._getWeekSeconds(log);
    const weekHours = (weekSeconds / 3600).toFixed(2);
    const avgDaily = log.totalSeconds > 0 ? (log.totalSeconds / Math.max(1, Object.keys(log.daily).length) / 3600).toFixed(2) : '0';
    const daysRemaining = avgDaily > 0 ? Math.ceil((this.targetHours - log.totalSeconds / 3600) / parseFloat(avgDaily)) : '∞';

    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║          WATCH HOURS DASHBOARD                 ║');
    console.log('╠════════════════════════════════════════════════╣');
    console.log(`║ TOTAL HOURS:      ${totalHours}h / ${this.targetHours}h (${progress}%)`);
    console.log(`║ Today:            ${todayHours}h (${todayData.videos} videos)`);
    console.log(`║ This Week:        ${weekHours}h`);
    console.log(`║ Daily Average:    ${avgDaily}h`);
    console.log(`║ Days Remaining:   ~${daysRemaining} days`);
    console.log(`║ Total Sessions:   ${log.totalSessions}`);
    console.log(`║ Total Videos:     ${log.totalVideos}`);
    console.log('╠════════════════════════════════════════════════╣');
    console.log('║ PROGRESS BAR:');
    const barLen = 40;
    const filled = Math.floor((parseFloat(progress) / 100) * barLen);
    const bar = '█'.repeat(Math.min(filled, barLen)) + '░'.repeat(Math.max(0, barLen - filled));
    console.log(`║ [${bar}] ${progress}%`);
    console.log('╚════════════════════════════════════════════════╝\n');
  }

  /**
   * Get summary stats object
   */
  getSummary() {
    const log = this._getLog();
    return {
      totalHours: (log.totalSeconds / 3600).toFixed(2),
      targetHours: this.targetHours,
      progress: ((log.totalSeconds / 3600 / this.targetHours) * 100).toFixed(1) + '%',
      totalSessions: log.totalSessions,
      totalVideos: log.totalVideos,
      daysActive: Object.keys(log.daily).length,
    };
  }

  /**
   * Export as CSV
   */
  exportCSV() {
    const log = this._getLog();
    let csv = 'date,hours,sessions,videos\n';
    Object.entries(log.daily).sort().forEach(([date, data]) => {
      csv += `${date},${(data.seconds/3600).toFixed(4)},${data.sessions},${data.videos}\n`;
    });
    const filePath = path.join(this.dataDir, 'watch_hours_export.csv');
    fs.writeFileSync(filePath, csv);
    console.log(`[Dashboard] Exported to ${filePath}`);
    return filePath;
  }

  _getWeekSeconds(log) {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    let total = 0;
    Object.entries(log.daily).forEach(([date, data]) => {
      if (new Date(date) >= weekAgo) total += data.seconds;
    });
    return total;
  }

  _getLog() {
    const filePath = path.join(this.dataDir, 'watch_hours.json');
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { totalSeconds: 0, totalSessions: 0, totalVideos: 0, daily: {}, startDate: new Date().toISOString() };
  }

  _saveLog(log) {
    const filePath = path.join(this.dataDir, 'watch_hours.json');
    fs.writeFileSync(filePath, JSON.stringify(log, null, 2));
  }
}

module.exports = WatchHoursDashboard;
