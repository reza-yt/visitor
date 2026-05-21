'use strict';

/**
 * Network Request Filtering Module
 * Controls which requests to allow/block for natural behavior
 * IMPORTANT: Don't block YouTube's tracking - it makes views look fake
 * Instead, ensure all expected requests are made naturally
 */

class NetworkFilter {
  constructor(options = {}) {
    this.mode = options.mode || 'natural'; // 'natural' (allow all), 'stealth' (block trackers), 'minimal'
    this.stats = { allowed: 0, blocked: 0, modified: 0 };
  }

  /**
   * Apply network interception to page
   */
  async apply(page) {
    await page.setRequestInterception(true);

    page.on('request', (request) => {
      const url = request.url();
      const type = request.resourceType();

      if (this.mode === 'natural') {
        // Allow everything (most natural, YouTube expects all requests)
        this.stats.allowed++;
        request.continue();
        return;
      }

      if (this.mode === 'stealth') {
        // Block only non-YouTube third-party trackers
        if (this._isThirdPartyTracker(url)) {
          this.stats.blocked++;
          request.abort();
          return;
        }
      }

      if (this.mode === 'minimal') {
        // Block images/fonts to save bandwidth (careful - may look suspicious)
        if (type === 'image' && !url.includes('youtube') && !url.includes('yt')) {
          this.stats.blocked++;
          request.abort();
          return;
        }
      }

      this.stats.allowed++;
      request.continue();
    });

    console.log(`[NetworkFilter] Applied mode: ${this.mode}`);
  }

  /**
   * Ensure YouTube's critical tracking requests are sent
   * These are REQUIRED for views to count
   */
  async ensureCriticalRequests(page) {
    // Monitor for watchtime endpoint (MUST succeed for watch hours)
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/stats/watchtime')) {
        console.log('[NetworkFilter] ✓ Watchtime API called');
      }
      if (url.includes('/api/stats/playback')) {
        console.log('[NetworkFilter] ✓ Playback stats sent');
      }
      if (url.includes('/youtubei/v1/player')) {
        console.log('[NetworkFilter] ✓ Player API loaded');
      }
    });
  }

  /**
   * Simulate realistic network patterns (connection speed variations)
   */
  async simulateNetworkJitter(page) {
    const client = await page.target().createCDPSession();
    
    // Occasional micro-disconnects (very brief)
    if (Math.random() < 0.05) {
      await client.send('Network.emulateNetworkConditions', {
        offline: true, downloadThroughput: 0, uploadThroughput: 0, latency: 0
      });
      await page.waitForTimeout(Math.floor(Math.random() * 500) + 100);
      await client.send('Network.emulateNetworkConditions', {
        offline: false, downloadThroughput: -1, uploadThroughput: -1, latency: 0
      });
    }
  }

  _isThirdPartyTracker(url) {
    const blocklist = [
      'doubleclick.net', 'googlesyndication.com',
      'adservice.google', 'pagead2.googlesyndication',
      'facebook.com/tr', 'connect.facebook',
      'analytics.tiktok', 'bat.bing.com',
    ];
    // NEVER block YouTube's own tracking
    if (url.includes('youtube.com') || url.includes('ytimg.com') || 
        url.includes('googlevideo.com') || url.includes('gstatic.com')) {
      return false;
    }
    return blocklist.some(domain => url.includes(domain));
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = NetworkFilter;
