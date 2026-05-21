'use strict';

/**
 * Mute Detection Bypass Module
 * YouTube doesn't count views if video is muted (0% volume)
 * Ensures volume is always at minimum 1% and monitors mute state
 */

class MuteDetection {
  constructor(options = {}) {
    this.minVolume = options.minVolume || 0.05; // 5% minimum (safe)
    this.maxVolume = options.maxVolume || 0.85;
    this.checkInterval = options.checkInterval || 30000; // Check every 30s
    this.volumeChangeChance = options.volumeChangeChance || 0.1; // 10% chance to adjust
    this._monitorInterval = null;
  }

  /**
   * Set initial volume (never muted)
   */
  async setInitialVolume(page) {
    const volume = this._getRealisticVolume();
    await page.evaluate((vol) => {
      const video = document.querySelector('video');
      if (video) {
        video.volume = vol;
        video.muted = false;
      }
      // Also update YouTube's player state
      const player = document.querySelector('#movie_player');
      if (player && player.setVolume) {
        player.setVolume(Math.floor(vol * 100));
        player.unMute();
      }
    }, volume);
    console.log(`[MuteDetection] Volume set: ${(volume * 100).toFixed(0)}%`);
    return volume;
  }

  /**
   * Start monitoring mute state (runs periodically)
   */
  async startMonitoring(page) {
    // Initial check
    await this._ensureNotMuted(page);

    // Periodic monitoring
    this._monitorInterval = setInterval(async () => {
      try {
        await this._ensureNotMuted(page);
        
        // Occasionally adjust volume (natural behavior)
        if (Math.random() < this.volumeChangeChance) {
          await this._adjustVolume(page);
        }
      } catch (e) {
        // Page might be closed, stop monitoring
        this.stopMonitoring();
      }
    }, this.checkInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this._monitorInterval) {
      clearInterval(this._monitorInterval);
      this._monitorInterval = null;
    }
  }

  /**
   * Ensure video is not muted
   */
  async _ensureNotMuted(page) {
    const state = await page.evaluate((minVol) => {
      const video = document.querySelector('video');
      if (!video) return { ok: false, reason: 'no-video' };

      let fixed = false;
      if (video.muted) {
        video.muted = false;
        fixed = true;
      }
      if (video.volume < minVol) {
        video.volume = minVol + Math.random() * 0.1;
        fixed = true;
      }

      // Check YouTube player too
      const player = document.querySelector('#movie_player');
      if (player && player.isMuted && player.isMuted()) {
        player.unMute();
        fixed = true;
      }

      return { ok: true, volume: video.volume, muted: video.muted, fixed };
    }, this.minVolume);

    if (state.fixed) {
      console.log('[MuteDetection] Fixed mute/volume state');
    }
    return state;
  }

  /**
   * Naturally adjust volume (humans do this)
   */
  async _adjustVolume(page) {
    const newVolume = this._getRealisticVolume();
    await page.evaluate((vol) => {
      const video = document.querySelector('video');
      if (video) {
        // Gradual change (not instant)
        const current = video.volume;
        const step = (vol - current) / 5;
        let i = 0;
        const interval = setInterval(() => {
          video.volume = Math.max(0.05, Math.min(1, current + step * (i + 1)));
          i++;
          if (i >= 5) clearInterval(interval);
        }, 200);
      }
    }, newVolume);
  }

  /**
   * Get a realistic volume level
   */
  _getRealisticVolume() {
    // Most people watch at 40-70% volume
    const base = 0.4 + Math.random() * 0.3;
    // Never below minimum
    return Math.max(this.minVolume, Math.min(this.maxVolume, base));
  }

  /**
   * Verify volume before critical watch period
   */
  async verifyBeforeWatch(page) {
    const state = await this._ensureNotMuted(page);
    if (!state.ok) {
      console.log('[MuteDetection] WARNING: Could not verify audio state');
      return false;
    }
    return true;
  }
}

module.exports = MuteDetection;
