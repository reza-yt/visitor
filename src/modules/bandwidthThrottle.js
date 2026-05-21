'use strict';

/**
 * Bandwidth Throttling Module
 * Simulates different network speeds (3G, 4G, WiFi)
 */

class BandwidthThrottle {
  constructor() {
    this.profiles = {
      '2g': {
        label: '2G (GPRS)',
        downloadThroughput: 50 * 1024 / 8, // 50 kbps
        uploadThroughput: 20 * 1024 / 8,
        latency: 500,
      },
      '3g': {
        label: '3G (Good)',
        downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
        uploadThroughput: 750 * 1024 / 8,
        latency: 150,
      },
      '3g-slow': {
        label: '3G (Slow)',
        downloadThroughput: 500 * 1024 / 8, // 500 kbps
        uploadThroughput: 250 * 1024 / 8,
        latency: 300,
      },
      '4g': {
        label: '4G (LTE)',
        downloadThroughput: 20 * 1024 * 1024 / 8, // 20 Mbps
        uploadThroughput: 10 * 1024 * 1024 / 8,
        latency: 40,
      },
      '4g-slow': {
        label: '4G (Slow)',
        downloadThroughput: 5 * 1024 * 1024 / 8, // 5 Mbps
        uploadThroughput: 2 * 1024 * 1024 / 8,
        latency: 80,
      },
      'wifi': {
        label: 'WiFi (Fast)',
        downloadThroughput: 50 * 1024 * 1024 / 8, // 50 Mbps
        uploadThroughput: 25 * 1024 * 1024 / 8,
        latency: 10,
      },
      'wifi-slow': {
        label: 'WiFi (Slow/Coffee Shop)',
        downloadThroughput: 5 * 1024 * 1024 / 8,
        uploadThroughput: 2 * 1024 * 1024 / 8,
        latency: 50,
      },
      'fiber': {
        label: 'Fiber',
        downloadThroughput: 100 * 1024 * 1024 / 8,
        uploadThroughput: 50 * 1024 * 1024 / 8,
        latency: 5,
      },
    };
  }

  /**
   * Get random mobile network profile (weighted towards 4G)
   */
  getRandomMobile() {
    const mobileProfiles = ['3g', '3g-slow', '4g', '4g-slow', '4g', '4g', '4g-slow'];
    const selected = mobileProfiles[Math.floor(Math.random() * mobileProfiles.length)];
    return { name: selected, ...this.profiles[selected] };
  }

  /**
   * Get random desktop network profile
   */
  getRandomDesktop() {
    const desktopProfiles = ['wifi', 'wifi', 'wifi-slow', 'fiber', '4g'];
    const selected = desktopProfiles[Math.floor(Math.random() * desktopProfiles.length)];
    return { name: selected, ...this.profiles[selected] };
  }

  /**
   * Get network profile based on device type
   */
  getProfile(isMobile) {
    return isMobile ? this.getRandomMobile() : this.getRandomDesktop();
  }

  /**
   * Apply bandwidth throttling to page via CDP
   */
  async apply(page, profile) {
    try {
      const client = await page.target().createCDPSession();
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: profile.downloadThroughput,
        uploadThroughput: profile.uploadThroughput,
        latency: profile.latency,
        connectionType: this._getConnectionType(profile.name),
      });
      console.log(`[BandwidthThrottle] Applied: ${profile.label} (${profile.latency}ms latency)`);
      return true;
    } catch (err) {
      console.log(`[BandwidthThrottle] Failed to apply: ${err.message}`);
      return false;
    }
  }

  /**
   * Add random jitter to latency
   */
  addJitter(profile) {
    const jitter = Math.floor(Math.random() * (profile.latency * 0.3));
    return {
      ...profile,
      latency: profile.latency + jitter,
    };
  }

  _getConnectionType(name) {
    if (name.includes('2g')) return 'cellular2g';
    if (name.includes('3g')) return 'cellular3g';
    if (name.includes('4g')) return 'cellular4g';
    if (name.includes('wifi')) return 'wifi';
    return 'ethernet';
  }
}

module.exports = BandwidthThrottle;
