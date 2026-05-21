'use strict';

/**
 * Low Quality Mode Module
 * Forces YouTube to play at 144p-240p to save bandwidth
 * 1 TB bandwidth = ~8000+ jam watch hours at 144p
 * YouTube STILL COUNTS watch hours regardless of quality!
 */

class LowQualityMode {
  constructor(options = {}) {
    this.targetQuality = options.targetQuality || '144p'; // '144p', '240p', '360p'
    this.maxQuality = options.maxQuality || '240p';
    this.bandwidthLimit = options.bandwidthLimit || 500; // kbps limit for video
  }

  /**
   * Force low quality via YouTube's settings menu
   */
  async forceQuality(page) {
    try {
      // Wait for player to load
      await page.waitForSelector('#movie_player, .html5-video-player', { timeout: 15000 });
      await page.waitForTimeout(3000);

      // Method 1: Use YouTube's player API directly
      const success = await page.evaluate((target) => {
        const player = document.querySelector('#movie_player');
        if (player && player.setPlaybackQualityRange) {
          const qualityMap = {
            '144p': 'tiny',
            '240p': 'small',
            '360p': 'medium',
            '480p': 'large',
          };
          const q = qualityMap[target] || 'tiny';
          try {
            player.setPlaybackQualityRange(q, q);
            player.setPlaybackQuality(q);
            return { success: true, method: 'api', quality: q };
          } catch (e) {
            return { success: false, method: 'api', error: e.message };
          }
        }
        return { success: false, method: 'api', error: 'player not found' };
      }, this.targetQuality);

      if (success.success) {
        console.log(`[LowQuality] Set to ${this.targetQuality} via player API`);
        return true;
      }

      // Method 2: Click through settings UI
      return await this._setViaUI(page);
    } catch (e) {
      console.log(`[LowQuality] Failed to set quality: ${e.message}`);
      return false;
    }
  }

  /**
   * Set quality through YouTube settings UI (fallback)
   */
  async _setViaUI(page) {
    try {
      // Click settings gear
      const settingsBtn = await page.$('.ytp-settings-button');
      if (!settingsBtn) return false;
      await settingsBtn.click();
      await page.waitForTimeout(800);

      // Click "Quality" menu item
      const menuItems = await page.$$('.ytp-menuitem');
      for (const item of menuItems) {
        const text = await page.evaluate(el => el.textContent, item);
        if (text.includes('Quality') || text.includes('Kualitas')) {
          await item.click();
          await page.waitForTimeout(800);
          break;
        }
      }

      // Find and click target quality
      const qualityItems = await page.$$('.ytp-quality-menu .ytp-menuitem, .ytp-panel-menu .ytp-menuitem');
      const targetLabels = this._getQualityLabels();

      for (const qi of qualityItems) {
        const label = await page.evaluate(el => el.textContent.toLowerCase(), qi);
        if (targetLabels.some(t => label.includes(t))) {
          await qi.click();
          console.log(`[LowQuality] Set to ${this.targetQuality} via UI`);
          await page.waitForTimeout(500);
          return true;
        }
      }

      // If target not found, pick lowest available
      if (qualityItems.length > 0) {
        await qualityItems[qualityItems.length - 1].click();
        console.log('[LowQuality] Set to lowest available quality');
        return true;
      }

      // Close menu if failed
      await page.keyboard.press('Escape');
      return false;
    } catch (e) {
      try { await page.keyboard.press('Escape'); } catch (_) {}
      return false;
    }
  }


  /**
   * Apply bandwidth throttling via CDP to force low quality
   * YouTube auto-downgrades quality when bandwidth is limited
   */
  async throttleBandwidth(page) {
    try {
      const client = await page.target().createCDPSession();

      // Limit download speed to force low quality selection
      const profiles = {
        '144p': { download: 200 * 1024, upload: 100 * 1024, latency: 100 },
        '240p': { download: 400 * 1024, upload: 200 * 1024, latency: 80 },
        '360p': { download: 800 * 1024, upload: 400 * 1024, latency: 50 },
      };

      const profile = profiles[this.targetQuality] || profiles['144p'];

      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: profile.download,
        uploadThroughput: profile.upload,
        latency: profile.latency,
      });

      console.log(`[LowQuality] Bandwidth throttled for ${this.targetQuality}`);
      return true;
    } catch (e) {
      console.log(`[LowQuality] Throttle failed: ${e.message}`);
      return false;
    }
  }

  /**
   * Verify current playback quality
   */
  async verifyQuality(page) {
    try {
      const quality = await page.evaluate(() => {
        const player = document.querySelector('#movie_player');
        if (player && player.getPlaybackQuality) {
          return player.getPlaybackQuality();
        }
        return 'unknown';
      });

      const qualityMap = { 'tiny': '144p', 'small': '240p', 'medium': '360p', 'large': '480p', 'hd720': '720p', 'hd1080': '1080p' };
      const readable = qualityMap[quality] || quality;

      console.log(`[LowQuality] Current quality: ${readable}`);
      return { raw: quality, readable };
    } catch (e) {
      return { raw: 'unknown', readable: 'unknown' };
    }
  }

  /**
   * Monitor and re-enforce quality during playback
   * YouTube sometimes auto-upgrades quality
   */
  async monitorQuality(page, intervalMs = 60000) {
    const monitor = setInterval(async () => {
      try {
        const { raw } = await this.verifyQuality(page);
        const allowed = ['tiny', 'small']; // 144p, 240p
        if (this.maxQuality === '360p') allowed.push('medium');

        if (!allowed.includes(raw) && raw !== 'unknown') {
          console.log(`[LowQuality] Quality drifted to ${raw}, re-enforcing...`);
          await this.forceQuality(page);
        }
      } catch (e) {
        clearInterval(monitor);
      }
    }, intervalMs);

    return monitor;
  }

  /**
   * Get bandwidth usage estimation
   */
  getBandwidthEstimate(watchHours) {
    const gbPerHour = {
      '144p': 0.08,
      '240p': 0.15,
      '360p': 0.3,
    };
    const rate = gbPerHour[this.targetQuality] || 0.08;
    return {
      totalGB: (watchHours * rate).toFixed(1),
      perHourGB: rate,
      quality: this.targetQuality,
    };
  }

  /**
   * Print bandwidth report
   */
  printReport(targetHours, availableBandwidthGB) {
    const est = this.getBandwidthEstimate(targetHours);
    const sufficient = parseFloat(est.totalGB) <= availableBandwidthGB;
    console.log(`[LowQuality] ${targetHours}h @ ${this.targetQuality} = ${est.totalGB} GB needed | ${availableBandwidthGB} GB available | ${sufficient ? '✅ ENOUGH' : '❌ NOT ENOUGH'}`);
    return sufficient;
  }

  _getQualityLabels() {
    const map = {
      '144p': ['144', 'tiny'],
      '240p': ['240', 'small'],
      '360p': ['360', 'medium'],
    };
    return map[this.targetQuality] || ['144'];
  }
}

module.exports = LowQualityMode;
