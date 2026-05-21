'use strict';

/**
 * Real Playback Telemetry Module
 * Simulates realistic YouTube playback events and telemetry data
 * Makes playback look genuine to YouTube's analytics system
 */

class PlaybackTelemetry {
  constructor(options = {}) {
    this.sessionId = this._generateSessionId();
    this.events = [];
    this.startTime = null;
  }

  /**
   * Initialize telemetry for a video session
   */
  async initSession(page, videoId) {
    this.sessionId = this._generateSessionId();
    this.startTime = Date.now();
    this.events = [];

    // Inject telemetry simulation into page
    await page.evaluateOnNewDocument((sessionId) => {
      // Simulate yt.player telemetry events
      window.__ytTelemetry = {
        sessionId,
        events: [],
        startTime: Date.now(),
      };

      // Override Performance API to add realistic entries
      const originalMark = performance.mark;
      performance.mark = function (name, options) {
        window.__ytTelemetry.events.push({
          type: 'performance_mark',
          name,
          timestamp: Date.now(),
        });
        return originalMark.call(this, name, options);
      };
    }, this.sessionId);

    console.log(`[PlaybackTelemetry] Session initialized: ${this.sessionId.substring(0, 8)}...`);
  }

  /**
   * Send playback heartbeat events (YouTube sends these periodically)
   */
  async sendHeartbeat(page, currentTime, duration, state) {
    await page.evaluate((data) => {
      // Simulate YouTube's internal heartbeat
      const event = {
        type: 'heartbeat',
        cpn: data.sessionId, // Client Playback Nonce
        st: data.currentTime, // Start time
        et: data.currentTime + 10, // End time (10s intervals)
        state: data.state, // playing, paused, buffering
        volume: Math.floor(Math.random() * 40) + 50,
        dur: data.duration,
        timestamp: Date.now(),
      };

      if (window.__ytTelemetry) {
        window.__ytTelemetry.events.push(event);
      }
    }, { sessionId: this.sessionId, currentTime, duration, state });
  }

  /**
   * Simulate buffering events (realistic network behavior)
   */
  async simulateBuffering(page, currentTime) {
    // Random buffer events (5-15% of time)
    if (Math.random() < 0.1) {
      const bufferDuration = Math.floor(Math.random() * 2000) + 200; // 200ms-2.2s

      await page.evaluate((data) => {
        if (window.__ytTelemetry) {
          window.__ytTelemetry.events.push({
            type: 'buffer_start',
            time: data.currentTime,
            timestamp: Date.now(),
          });
        }
      }, { currentTime });

      await page.waitForTimeout(bufferDuration);

      await page.evaluate((data) => {
        if (window.__ytTelemetry) {
          window.__ytTelemetry.events.push({
            type: 'buffer_end',
            time: data.currentTime,
            duration: data.bufferDuration,
            timestamp: Date.now(),
          });
        }
      }, { currentTime, bufferDuration });
    }
  }

  /**
   * Simulate quality change events
   */
  async simulateQualityChange(page, isMobile) {
    const qualities = isMobile
      ? ['tiny', 'small', 'medium', 'large'] // 144p-480p
      : ['medium', 'large', 'hd720', 'hd1080']; // 360p-1080p

    // Most viewers stay on auto quality, occasional manual change
    if (Math.random() < 0.15) {
      const quality = qualities[Math.floor(Math.random() * qualities.length)];
      await page.evaluate((q) => {
        if (window.__ytTelemetry) {
          window.__ytTelemetry.events.push({
            type: 'quality_change',
            quality: q,
            reason: 'user', // or 'auto'
            timestamp: Date.now(),
          });
        }
      }, quality);
      console.log(`[PlaybackTelemetry] Quality change simulated: ${quality}`);
    }
  }

  /**
   * Generate realistic video info parameters
   * These match what YouTube's player sends
   */
  generateVideoParams(videoId, duration) {
    return {
      cpn: this.sessionId,                         // Client Playback Nonce
      ver: 2,                                       // Version
      cmt: '0',                                     // Current media time
      fmt: this._getRandomFormat(),                 // Format
      fs: Math.random() < 0.2 ? '1' : '0',        // Fullscreen
      rt: Math.floor(Math.random() * 30) + 5,     // Reference time
      lact: Math.floor(Math.random() * 5000),      // Last activity
      cl: Math.floor(Math.random() * 900000000) + 500000000, // Client lib
      mos: 0,                                       // Mouse over
      volume: Math.floor(Math.random() * 40) + 50, // Volume
      cbr: this._getRandomBrowser(),               // Client browser
      cbrver: this._getRandomBrowserVersion(),     // Browser version
      cos: this._getRandomOS(),                    // Client OS
      cosver: this._getRandomOSVersion(),          // OS version
      hl: 'id',                                     // Language
      cr: 'ID',                                     // Country
      docid: videoId,
      dur: duration.toString(),
      len: duration.toString(),
    };
  }

  /**
   * Simulate player state changes
   */
  async reportStateChange(page, state) {
    const stateNames = {
      '-1': 'unstarted', '0': 'ended', '1': 'playing',
      '2': 'paused', '3': 'buffering', '5': 'cued',
    };

    await page.evaluate((data) => {
      if (window.__ytTelemetry) {
        window.__ytTelemetry.events.push({
          type: 'state_change',
          state: data.state,
          stateName: data.stateName,
          timestamp: Date.now(),
        });
      }
    }, { state, stateName: stateNames[state] || 'unknown' });
  }

  /**
   * Simulate visibility/focus events
   */
  async simulateVisibility(page, isVisible) {
    await page.evaluate((visible) => {
      if (window.__ytTelemetry) {
        window.__ytTelemetry.events.push({
          type: 'visibility_change',
          visible,
          timestamp: Date.now(),
        });
      }

      // Trigger actual visibility event
      Object.defineProperty(document, 'hidden', { value: !visible, writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, isVisible);
  }

  /**
   * Get session duration
   */
  getSessionDuration() {
    return this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
  }

  _generateSessionId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  _getRandomFormat() {
    const formats = ['243', '244', '247', '248', '278', '298', '302', '303'];
    return formats[Math.floor(Math.random() * formats.length)];
  }

  _getRandomBrowser() {
    const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
    return browsers[Math.floor(Math.random() * browsers.length)];
  }

  _getRandomBrowserVersion() {
    const versions = ['119.0.0.0', '120.0.0.0', '118.0.0.0', '17.1'];
    return versions[Math.floor(Math.random() * versions.length)];
  }

  _getRandomOS() {
    const os = ['Windows', 'Macintosh', 'X11', 'Linux', 'Android', 'iOS'];
    return os[Math.floor(Math.random() * os.length)];
  }

  _getRandomOSVersion() {
    const versions = ['10.0', '14.1', '13', '10_15_7', '6.1'];
    return versions[Math.floor(Math.random() * versions.length)];
  }
}

module.exports = PlaybackTelemetry;
