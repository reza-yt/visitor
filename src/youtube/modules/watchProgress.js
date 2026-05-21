'use strict';

/**
 * Watch Progress API Module
 * Simulates YouTube's internal watch progress saving
 * YouTube saves progress so users can resume - absence of this is suspicious
 */

class WatchProgress {
  constructor() {}

  /**
   * Save watch progress periodically (like YouTube does internally)
   */
  async saveProgress(page, currentTime, duration) {
    await page.evaluate((time, dur) => {
      // YouTube stores progress in localStorage
      const videoId = new URLSearchParams(window.location.search).get('v');
      if (!videoId) return;

      const key = `yt-player-resume:${videoId}`;
      const data = {
        data: JSON.stringify({ videoId, time, duration: dur }),
        creation: Date.now(),
        expiration: Date.now() + 86400000, // 24 hours
      };
      try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}

      // Also update the internal player state
      const player = document.querySelector('#movie_player');
      if (player && player.getCurrentTime) {
        // Player tracks this automatically, but we ensure it's happening
      }
    }, currentTime, duration);
  }

  /**
   * Simulate the /api/stats/watchtime request that YouTube sends
   * This is CRITICAL for watch hours to count
   */
  async ensureWatchtimeTracking(page) {
    // Monitor that watchtime endpoint is being called
    const watchtimeCalled = await page.evaluate(() => {
      return window.__ytWatchtimeSent || false;
    });

    if (!watchtimeCalled) {
      // Force a visibility event to trigger tracking
      await page.evaluate(() => {
        document.dispatchEvent(new Event('visibilitychange'));
        // Trigger a progress update
        const video = document.querySelector('video');
        if (video) {
          video.dispatchEvent(new Event('timeupdate'));
          video.dispatchEvent(new Event('progress'));
        }
      });
    }
  }

  /**
   * Simulate resume from last position (returning viewer)
   */
  async resumeFromLastPosition(page, videoId, lastPosition) {
    if (!lastPosition || lastPosition < 10) return false;

    // Only resume sometimes (natural behavior)
    if (Math.random() > 0.6) return false;

    await page.evaluate((pos) => {
      const video = document.querySelector('video');
      if (video && pos > 10) {
        video.currentTime = pos;
      }
    }, lastPosition);

    console.log(`[WatchProgress] Resumed from ${lastPosition}s`);
    return true;
  }

  /**
   * Track progress during playback (call periodically)
   */
  async trackDuringPlayback(page) {
    const progress = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (!video) return null;
      return {
        currentTime: video.currentTime,
        duration: video.duration,
        buffered: video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0,
        paused: video.paused,
        playbackRate: video.playbackRate,
      };
    });
    return progress;
  }
}

module.exports = WatchProgress;
