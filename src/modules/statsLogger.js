'use strict';

/**
 * Stats Dashboard & Logging Module
 * Logs visit stats to file (JSON/CSV) and provides real-time dashboard
 */

const fs = require('fs');
const path = require('path');

class StatsLogger {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(process.cwd(), 'logs');
    this.format = options.format || 'json'; // 'json' or 'csv'
    this.verbose = options.verbose !== false;
    this.stats = {
      startTime: Date.now(),
      totalVisits: 0,
      successVisits: 0,
      failedVisits: 0,
      captchaHits: 0,
      proxyErrors: 0,
      avgResponseTime: 0,
      responseTimes: [],
      visitLog: [],
    };
    this._ensureLogDir();
  }

  _ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Log a visit result
   */
  logVisit(data) {
    const entry = {
      timestamp: new Date().toISOString(),
      visitNumber: this.stats.totalVisits + 1,
      url: data.url || '',
      status: data.success ? 'success' : 'failed',
      duration: data.duration || 0,
      proxy: data.proxy ? data.proxy.substring(0, 20) + '...' : 'direct',
      userAgent: data.isMobile ? 'mobile' : 'desktop',
      viewport: data.viewport || '',
      referer: data.referer || 'direct',
      error: data.error || null,
      country: data.country || '',
    };

    this.stats.totalVisits++;
    if (data.success) {
      this.stats.successVisits++;
    } else {
      this.stats.failedVisits++;
      if (data.error && data.error.includes('captcha')) this.stats.captchaHits++;
      if (data.error && data.error.includes('proxy')) this.stats.proxyErrors++;
    }

    if (data.duration) {
      this.stats.responseTimes.push(data.duration);
      this.stats.avgResponseTime = this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length;
    }

    this.stats.visitLog.push(entry);

    if (this.verbose) {
      this._printEntry(entry);
    }
  }

  /**
   * Print live dashboard to console
   */
  printDashboard() {
    const elapsed = ((Date.now() - this.stats.startTime) / 1000 / 60).toFixed(1);
    const rate = this.stats.totalVisits > 0 ? (this.stats.successVisits / this.stats.totalVisits * 100).toFixed(1) : 0;

    console.log('\n┌──────────────────────────────────────┐');
    console.log('│         VISITOR DASHBOARD            │');
    console.log('├──────────────────────────────────────┤');
    console.log(`│ Runtime:        ${elapsed} min`);
    console.log(`│ Total Visits:   ${this.stats.totalVisits}`);
    console.log(`│ Success:        ${this.stats.successVisits} (${rate}%)`);
    console.log(`│ Failed:         ${this.stats.failedVisits}`);
    console.log(`│ CAPTCHA Hits:   ${this.stats.captchaHits}`);
    console.log(`│ Proxy Errors:   ${this.stats.proxyErrors}`);
    console.log(`│ Avg Response:   ${(this.stats.avgResponseTime / 1000).toFixed(2)}s`);
    console.log('└──────────────────────────────────────┘\n');
  }

  /**
   * Save all stats to file
   */
  saveToFile() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (this.format === 'json') {
      const filePath = path.join(this.logDir, `stats_${timestamp}.json`);
      const data = {
        summary: {
          startTime: new Date(this.stats.startTime).toISOString(),
          endTime: new Date().toISOString(),
          totalVisits: this.stats.totalVisits,
          successVisits: this.stats.successVisits,
          failedVisits: this.stats.failedVisits,
          successRate: `${(this.stats.successVisits / Math.max(this.stats.totalVisits, 1) * 100).toFixed(1)}%`,
          avgResponseTime: `${(this.stats.avgResponseTime / 1000).toFixed(2)}s`,
          captchaHits: this.stats.captchaHits,
          proxyErrors: this.stats.proxyErrors,
        },
        visits: this.stats.visitLog,
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`[StatsLogger] Stats saved: ${filePath}`);
      return filePath;
    }

    if (this.format === 'csv') {
      const filePath = path.join(this.logDir, `stats_${timestamp}.csv`);
      const headers = 'timestamp,visit_number,url,status,duration_ms,proxy,user_agent,viewport,referer,error\n';
      const rows = this.stats.visitLog.map(e =>
        `${e.timestamp},${e.visitNumber},${e.url},${e.status},${e.duration},${e.proxy},${e.userAgent},${e.viewport},${e.referer},${e.error || ''}`
      ).join('\n');
      fs.writeFileSync(filePath, headers + rows);
      console.log(`[StatsLogger] CSV saved: ${filePath}`);
      return filePath;
    }
  }

  /**
   * Get summary stats object
   */
  getSummary() {
    return {
      runtime: ((Date.now() - this.stats.startTime) / 1000 / 60).toFixed(1) + ' min',
      total: this.stats.totalVisits,
      success: this.stats.successVisits,
      failed: this.stats.failedVisits,
      rate: (this.stats.successVisits / Math.max(this.stats.totalVisits, 1) * 100).toFixed(1) + '%',
      avgResponseTime: (this.stats.avgResponseTime / 1000).toFixed(2) + 's',
    };
  }

  _printEntry(entry) {
    const icon = entry.status === 'success' ? '✓' : '✗';
    console.log(`  ${icon} #${entry.visitNumber} ${entry.url} [${entry.userAgent}] ${entry.duration}ms`);
  }
}

module.exports = StatsLogger;
