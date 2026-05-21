'use strict';

/**
 * Proxy Rotator Module
 * Manages proxy list, rotates IPs, validates proxies
 */
class ProxyRotator {
  constructor(proxies = []) {
    this.proxies = proxies;
    this.currentIndex = 0;
    this.failedProxies = new Set();
  }

  /**
   * Load proxies from array
   * Format: protocol://user:pass@host:port or host:port
   */
  loadProxies(proxyList) {
    this.proxies = proxyList.filter(p => p && p.trim().length > 0);
    this.currentIndex = 0;
    this.failedProxies.clear();
    console.log(`[ProxyRotator] Loaded ${this.proxies.length} proxies`);
  }

  /**
   * Get next proxy (round-robin rotation)
   */
  getNext() {
    if (this.proxies.length === 0) return null;

    const availableProxies = this.proxies.filter(p => !this.failedProxies.has(p));
    if (availableProxies.length === 0) {
      console.log('[ProxyRotator] All proxies failed, resetting...');
      this.failedProxies.clear();
      return this.proxies[0];
    }

    const proxy = availableProxies[this.currentIndex % availableProxies.length];
    this.currentIndex++;
    return proxy;
  }

  /**
   * Get random proxy
   */
  getRandom() {
    if (this.proxies.length === 0) return null;

    const availableProxies = this.proxies.filter(p => !this.failedProxies.has(p));
    if (availableProxies.length === 0) {
      this.failedProxies.clear();
      return this.proxies[Math.floor(Math.random() * this.proxies.length)];
    }

    return availableProxies[Math.floor(Math.random() * availableProxies.length)];
  }

  /**
   * Mark proxy as failed
   */
  markFailed(proxy) {
    this.failedProxies.add(proxy);
    console.log(`[ProxyRotator] Proxy marked as failed: ${proxy}`);
  }

  /**
   * Format proxy for puppeteer
   * Supports formats: host:port, user:pass@host:port, protocol://user:pass@host:port
   */
  formatForPuppeteer(proxy) {
    if (!proxy) return null;

    // Already has protocol
    if (proxy.startsWith('http://') || proxy.startsWith('https://') || proxy.startsWith('socks')) {
      return proxy;
    }

    // Check if it has auth (user:pass@host:port)
    if (proxy.includes('@')) {
      return `http://${proxy}`;
    }

    // Simple host:port
    return `http://${proxy}`;
  }

  /**
   * Extract auth credentials from proxy string
   */
  extractAuth(proxy) {
    if (!proxy) return null;

    const match = proxy.match(/\/\/([^:]+):([^@]+)@/);
    if (match) {
      return { username: match[1], password: match[2] };
    }

    // Format: user:pass@host:port (without protocol)
    const match2 = proxy.match(/^([^:]+):([^@]+)@/);
    if (match2) {
      return { username: match2[1], password: match2[2] };
    }

    return null;
  }

  /**
   * Get proxy count info
   */
  getStats() {
    return {
      total: this.proxies.length,
      available: this.proxies.length - this.failedProxies.size,
      failed: this.failedProxies.size
    };
  }
}

module.exports = ProxyRotator;
