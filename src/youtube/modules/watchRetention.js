'use strict';

/**
 * Watch Retention Module
 * Simulates realistic watch retention patterns that match human behavior
 * Key for YouTube watch hours counting
 */

class WatchRetention {
  constructor(options = {}) {
    this.targetRetention = options.targetRetention || 0.7;    // 70% average
    this.dropOffVariance = options.dropOffVariance || 0.15;
    this.rewindChance = options.rewindChance || 0.2;
    this.skipAheadChance = options.skipAheadChance || 0.05;
    this.pauseChance = options.pauseChance || 0.3;
    this.pauseDuration = options.pauseDuration || { min: 3, max: 30 };
    this.stats = { totalWatchTime: 0, sessions: 0 };
  }

  /**
   * Generate a watch plan for a video
   * Returns array of actions: play, pause, seek, speed-change, etc.
   */
  generateWatchPlan(videoDurationSeconds) {
    const plan = [];
    const watchPercent = this._getWatchPercent();
    const totalWatchTime = Math.floor(videoDurationSeconds * watchPercent);
    let currentTime = 0;
    let elapsed = 0;

    // Initial play
    plan.push({ action: 'play', time: 0, timestamp: elapsed });

    while (currentTime < totalWatchTime && currentTime < videoDurationSeconds) {
      // Determine next action based on probabilities
      const rand = Math.random();

      if (rand < this.pauseChance * 0.1) {
        // Pause
        const pauseTime = this._randomBetween(this.pauseDuration.min, this.pauseDuration.max);
        plan.push({ action: 'pause', time: currentTime, duration: pauseTime, timestamp: elapsed });
        elapsed += pauseTime;
        plan.push({ action: 'resume', time: currentTime, timestamp: elapsed });

      } else if (rand < this.rewindChance * 0.05 && currentTime > 30) {
        // Rewind (human missed something)
        const rewindAmount = this._randomBetween(5, 20);
        currentTime = Math.max(0, currentTime - rewindAmount);
        plan.push({ action: 'seek', time: currentTime, direction: 'back', amount: rewindAmount, timestamp: elapsed });

      } else if (rand < this.skipAheadChance * 0.02 && currentTime < totalWatchTime - 60) {
        // Skip ahead (rare, human skips boring part)
        const skipAmount = this._randomBetween(10, 45);
        currentTime = Math.min(videoDurationSeconds, currentTime + skipAmount);
        plan.push({ action: 'seek', time: currentTime, direction: 'forward', amount: skipAmount, timestamp: elapsed });
      }

      // Normal playback segment (watch 15-120 seconds continuously)
      const segmentLength = this._randomBetween(15, 120);
      const actualSegment = Math.min(segmentLength, totalWatchTime - currentTime);
      currentTime += actualSegment;
      elapsed += actualSegment;

      // Maybe adjust playback speed (very rare, 2%)
      if (Math.random() < 0.02 && currentTime > videoDurationSeconds * 0.3) {
        const speeds = [1.0, 1.25, 1.5, 1.75];
        const speed = speeds[Math.floor(Math.random() * speeds.length)];
        plan.push({ action: 'speed', time: currentTime, speed, timestamp: elapsed });
      }
    }

    // End of watch
    plan.push({ action: 'end', time: currentTime, timestamp: elapsed, watchedPercent: watchPercent });

    return {
      plan,
      videoDuration: videoDurationSeconds,
      watchDuration: totalWatchTime,
      watchPercent,
      totalElapsed: elapsed,
    };
  }

  /**
   * Execute watch plan on a YouTube page
   */
  async executeWatchPlan(page, watchPlan) {
    const { plan, videoDuration } = watchPlan;
    let totalWatched = 0;

    console.log(`[WatchRetention] Executing plan: ${plan.length} actions, target ${(watchPlan.watchPercent * 100).toFixed(0)}% of ${videoDuration}s`);

    for (const action of plan) {
      try {
        switch (action.action) {
          case 'play':
            await this._ensurePlaying(page);
            break;

          case 'pause':
            await this._pauseVideo(page);
            await page.waitForTimeout(action.duration * 1000);
            break;

          case 'resume':
            await this._playVideo(page);
            break;

          case 'seek':
            await this._seekTo(page, action.time, videoDuration);
            await page.waitForTimeout(this._randomBetween(500, 1500));
            break;

          case 'speed':
            await this._setPlaybackSpeed(page, action.speed);
            break;

          case 'end':
            totalWatched = action.time;
            break;
        }
      } catch (err) {
        console.log(`[WatchRetention] Action failed (${action.action}): ${err.message}`);
      }
    }

    this.stats.totalWatchTime += totalWatched;
    this.stats.sessions++;

    return { totalWatched, percent: watchPlan.watchPercent };
  }

  /**
   * Wait for video to play for specified duration with periodic checks
   */
  async watchFor(page, seconds) {
    const checkInterval = 10; // Check every 10 seconds
    let watched = 0;

    while (watched < seconds) {
      const waitTime = Math.min(checkInterval, seconds - watched);
      await page.waitForTimeout(waitTime * 1000);
      watched += waitTime;

      // Verify video is still playing
      const isPlaying = await this._isPlaying(page);
      if (!isPlaying) {
        console.log('[WatchRetention] Video paused/stopped, resuming...');
        await this._playVideo(page);
        await page.waitForTimeout(1000);
      }

      // Random micro-interactions during watching
      if (Math.random() < 0.1) {
        await this._microInteraction(page);
      }
    }

    return watched;
  }

  /**
   * Get realistic watch percentage
   */
  _getWatchPercent() {
    // Normal distribution around target retention
    const variance = this.dropOffVariance;
    const base = this.targetRetention;
    const gaussian = () => {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };
    const percent = base + gaussian() * variance;
    return Math.max(0.3, Math.min(0.98, percent)); // Clamp 30%-98%
  }

  async _ensurePlaying(page) {
    const isPaused = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video ? video.paused : true;
    });
    if (isPaused) await this._playVideo(page);
  }

  async _playVideo(page) {
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video && video.paused) video.play();
    });
  }

  async _pauseVideo(page) {
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video && !video.paused) video.pause();
    });
  }

  async _isPlaying(page) {
    return page.evaluate(() => {
      const video = document.querySelector('video');
      return video ? !video.paused && !video.ended : false;
    });
  }

  async _seekTo(page, timeSeconds, totalDuration) {
    await page.evaluate((time) => {
      const video = document.querySelector('video');
      if (video) video.currentTime = time;
    }, timeSeconds);
  }

  async _setPlaybackSpeed(page, speed) {
    await page.evaluate((s) => {
      const video = document.querySelector('video');
      if (video) video.playbackRate = s;
    }, speed);
    console.log(`[WatchRetention] Speed changed to ${speed}x`);
  }

  async _microInteraction(page) {
    // Small random interactions while watching
    const actions = ['mouse-move', 'scroll-tiny', 'nothing'];
    const action = actions[Math.floor(Math.random() * actions.length)];

    if (action === 'mouse-move') {
      const x = this._randomBetween(100, 800);
      const y = this._randomBetween(100, 500);
      await page.mouse.move(x, y, { steps: 5 });
    } else if (action === 'scroll-tiny') {
      await page.evaluate(() => window.scrollBy(0, Math.random() * 20 - 10));
    }
  }

  _randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getStats() {
    return {
      totalWatchTime: this.stats.totalWatchTime,
      totalWatchHours: (this.stats.totalWatchTime / 3600).toFixed(2),
      sessions: this.stats.sessions,
    };
  }
}

module.exports = WatchRetention;
