'use strict';

/**
 * Scheduler / Cron Support Module
 * Schedule visits at specific times, intervals, or cron patterns
 */

class Scheduler {
  constructor(options = {}) {
    this.jobs = [];
    this.isRunning = false;
    this.timezone = options.timezone || 'Asia/Jakarta';
  }

  /**
   * Schedule visits at regular interval
   * @param {Function} fn - Function to execute
   * @param {number} intervalMs - Interval in milliseconds
   */
  scheduleInterval(fn, intervalMs, label = 'job') {
    const job = {
      id: this._generateId(),
      type: 'interval',
      label,
      fn,
      interval: intervalMs,
      timer: null,
      nextRun: Date.now() + intervalMs,
      runs: 0,
    };
    this.jobs.push(job);
    console.log(`[Scheduler] Registered interval job "${label}" every ${(intervalMs / 1000 / 60).toFixed(1)} min`);
    return job.id;
  }

  /**
   * Schedule visits using cron-like pattern
   * Simple cron: { hour: [9,12,15,18,21], minute: [0,30] }
   */
  scheduleCron(fn, cronPattern, label = 'cron-job') {
    const job = {
      id: this._generateId(),
      type: 'cron',
      label,
      fn,
      pattern: cronPattern,
      timer: null,
      nextRun: this._getNextCronRun(cronPattern),
      runs: 0,
    };
    this.jobs.push(job);
    console.log(`[Scheduler] Registered cron job "${label}" pattern:`, cronPattern);
    return job.id;
  }

  /**
   * Schedule a one-time delayed execution
   */
  scheduleOnce(fn, delayMs, label = 'once') {
    const job = {
      id: this._generateId(),
      type: 'once',
      label,
      fn,
      delay: delayMs,
      timer: null,
      nextRun: Date.now() + delayMs,
      runs: 0,
    };
    this.jobs.push(job);
    console.log(`[Scheduler] Registered one-time job "${label}" in ${(delayMs / 1000).toFixed(0)}s`);
    return job.id;
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    this.isRunning = true;
    console.log(`[Scheduler] Starting ${this.jobs.length} jobs...`);

    this.jobs.forEach(job => {
      if (job.type === 'interval') {
        job.timer = setInterval(async () => {
          try {
            job.runs++;
            job.lastRun = Date.now();
            job.nextRun = Date.now() + job.interval;
            console.log(`[Scheduler] Running "${job.label}" (run #${job.runs})`);
            await job.fn();
          } catch (err) {
            console.log(`[Scheduler] Job "${job.label}" failed: ${err.message}`);
          }
        }, job.interval);
      } else if (job.type === 'cron') {
        this._startCronJob(job);
      } else if (job.type === 'once') {
        job.timer = setTimeout(async () => {
          try {
            job.runs++;
            job.lastRun = Date.now();
            console.log(`[Scheduler] Running one-time "${job.label}"`);
            await job.fn();
          } catch (err) {
            console.log(`[Scheduler] Job "${job.label}" failed: ${err.message}`);
          }
        }, job.delay);
      }
    });
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    this.isRunning = false;
    this.jobs.forEach(job => {
      if (job.timer) {
        clearInterval(job.timer);
        clearTimeout(job.timer);
        job.timer = null;
      }
    });
    console.log('[Scheduler] All jobs stopped');
  }

  /**
   * Remove a specific job
   */
  removeJob(jobId) {
    const idx = this.jobs.findIndex(j => j.id === jobId);
    if (idx !== -1) {
      const job = this.jobs[idx];
      if (job.timer) { clearInterval(job.timer); clearTimeout(job.timer); }
      this.jobs.splice(idx, 1);
      console.log(`[Scheduler] Removed job: ${job.label}`);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      jobs: this.jobs.map(j => ({
        id: j.id,
        label: j.label,
        type: j.type,
        runs: j.runs,
        nextRun: j.nextRun ? new Date(j.nextRun).toISOString() : null,
        lastRun: j.lastRun ? new Date(j.lastRun).toISOString() : null,
      })),
    };
  }

  _startCronJob(job) {
    const check = () => {
      const now = new Date();
      const hours = job.pattern.hours || Array.from({ length: 24 }, (_, i) => i);
      const minutes = job.pattern.minutes || [0];

      if (hours.includes(now.getHours()) && minutes.includes(now.getMinutes())) {
        if (!job._lastMinuteRun || job._lastMinuteRun !== now.getMinutes()) {
          job._lastMinuteRun = now.getMinutes();
          job.runs++;
          job.lastRun = Date.now();
          console.log(`[Scheduler] Cron triggered "${job.label}"`);
          job.fn().catch(err => console.log(`[Scheduler] Cron job failed: ${err.message}`));
        }
      }
    };
    job.timer = setInterval(check, 30000); // Check every 30s
  }

  _getNextCronRun(pattern) {
    const now = new Date();
    const hours = pattern.hours || [now.getHours()];
    const minutes = pattern.minutes || [0];
    // Simplified: next matching hour:minute
    for (const h of hours) {
      for (const m of minutes) {
        const next = new Date(now);
        next.setHours(h, m, 0, 0);
        if (next > now) return next.getTime();
      }
    }
    // Tomorrow
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(hours[0], minutes[0], 0, 0);
    return next.getTime();
  }

  _generateId() {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}

module.exports = Scheduler;
