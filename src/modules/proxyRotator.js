'use strict';

/**
 * Proxy Rotator Module
 * Full support for SOCKS4, SOCKS5, HTTP, HTTPS proxies
 * Manages proxy list, rotates IPs, validates & formats proxies
 */

const SUPPORTED_PROTOCOLS = ['http', 'https', 'socks4', 'socks5'];

class ProxyRotator {
  constructor(proxies = []) {
    this.proxies = [];
    this.currentIndex = 0;
    this.failedProxies = new Set();
    this.proxyMeta = new Map(); // Store parsed proxy metadata

    if (proxies.length > 0) this.loadProxies(proxies);
  }

  /**
   * Load proxies from array
   * 
   * Supported formats:
   *   socks5://user:pass@host:port
   *   socks4://host:port
   *   http://user:pass@host:port
   *   https://user:pass@host:port
   *   user:pass@host:port          (defaults to http)
   *   host:port                     (defaults to http)
   *   host:port:user:pass           (alternative format, defaults to http)
   */
  loadProxies(proxyList) {
    this.proxies = [];
    this.proxyMeta.clear();
    this.currentIndex = 0;
    this.failedProxies.clear();

    for (const raw of proxyList) {
      const trimmed = raw ? raw.trim() : '';
      if (!trimmed) continue;

      const parsed = this._parseProxy(trimmed);
      if (parsed) {
        this.proxies.push(trimmed);
        this.proxyMeta.set(trimmed, parsed);
      } else {
        console.log(`[ProxyRotator] Invalid proxy format, skipping: ${trimmed}`);
      }
    }

    // Show protocol breakdown
    const breakdown = { http: 0, https: 0, socks4: 0, socks5: 0 };
    this.proxyMeta.forEach(meta => { breakdown[meta.protocol]++; });
    console.log(`[ProxyRotator] Loaded ${this.proxies.length} proxies (HTTP:${breakdown.http} HTTPS:${breakdown.https} SOCKS4:${breakdown.socks4} SOCKS5:${breakdown.socks5})`);
  }

  /**
   * Load proxies from a newline-separated string (e.g., from file)
   */
  loadFromText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    this.loadProxies(lines);
  }

  /**
   * Parse proxy string into structured data
   */
  _parseProxy(proxy) {
    let protocol = 'http';
    let username = null;
    let password = null;
    let host = null;
    let port = null;

    let remaining = proxy;

    // Extract protocol
    const protoMatch = remaining.match(/^(https?|socks[45]):\/\//i);
    if (protoMatch) {
      protocol = protoMatch[1].toLowerCase();
      remaining = remaining.substring(protoMatch[0].length);
    }

    // Check for user:pass@host:port
    if (remaining.includes('@')) {
      const [authPart, hostPart] = remaining.split('@');
      const authSplit = authPart.split(':');
      if (authSplit.length >= 2) {
        username = authSplit[0];
        password = authSplit.slice(1).join(':'); // password can contain ':'
      }
      remaining = hostPart;
    }

    // Parse host:port (or host:port:user:pass alternative format)
    const parts = remaining.split(':');
    if (parts.length === 2) {
      host = parts[0];
      port = parseInt(parts[1], 10);
    } else if (parts.length === 4 && !username) {
      // Format: host:port:user:pass
      host = parts[0];
      port = parseInt(parts[1], 10);
      username = parts[2];
      password = parts[3];
    } else if (parts.length >= 2) {
      host = parts[0];
      port = parseInt(parts[1], 10);
    }

    if (!host || !port || isNaN(port)) return null;

    return { protocol, host, port, username, password, raw: proxy };
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
   * Get random proxy of specific protocol type
   */
  getRandomByType(protocol) {
    const filtered = this.proxies.filter(p => {
      const meta = this.proxyMeta.get(p);
      return meta && meta.protocol === protocol && !this.failedProxies.has(p);
    });
    if (filtered.length === 0) return this.getRandom(); // Fallback
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  /**
   * Mark proxy as failed
   */
  markFailed(proxy) {
    this.failedProxies.add(proxy);
    const meta = this.proxyMeta.get(proxy);
    const label = meta ? `${meta.protocol}://${meta.host}:${meta.port}` : proxy;
    console.log(`[ProxyRotator] Proxy marked as failed: ${label}`);
  }

  /**
   * Reset failed proxy (give it another chance)
   */
  resetFailed(proxy) {
    this.failedProxies.delete(proxy);
  }

  /**
   * Format proxy for Puppeteer --proxy-server flag
   * 
   * Puppeteer supports:
   *   http://host:port
   *   socks5://host:port
   *   socks4://host:port
   * 
   * Note: auth is handled separately via page.authenticate()
   */
  formatForPuppeteer(proxy) {
    if (!proxy) return null;

    const meta = this.proxyMeta.get(proxy);
    if (meta) {
      // SOCKS4/5 and HTTP/HTTPS formatting
      return `${meta.protocol}://${meta.host}:${meta.port}`;
    }

    // Fallback: if proxy wasn't parsed through loadProxies
    if (proxy.startsWith('socks4://') || proxy.startsWith('socks5://') ||
        proxy.startsWith('http://') || proxy.startsWith('https://')) {
      // Strip auth for the --proxy-server flag (auth handled via page.authenticate)
      const stripped = proxy.replace(/\/\/([^@]+)@/, '//');
      return stripped;
    }

    // Simple host:port
    return `http://${proxy.split('@').pop()}`;
  }

  /**
   * Extract auth credentials from proxy
   */
  extractAuth(proxy) {
    if (!proxy) return null;

    const meta = this.proxyMeta.get(proxy);
    if (meta && meta.username && meta.password) {
      return { username: meta.username, password: meta.password };
    }

    // Fallback regex matching
    const match = proxy.match(/\/\/([^:]+):([^@]+)@/);
    if (match) {
      return { username: match[1], password: match[2] };
    }

    const match2 = proxy.match(/^([^:]+):([^@]+)@/);
    if (match2) {
      return { username: match2[1], password: match2[2] };
    }

    return null;
  }

  /**
   * Get proxy metadata (protocol, host, port, auth)
   */
  getMeta(proxy) {
    return this.proxyMeta.get(proxy) || null;
  }

  /**
   * Get protocol type of a proxy
   */
  getProtocol(proxy) {
    const meta = this.proxyMeta.get(proxy);
    return meta ? meta.protocol : 'http';
  }

  /**
   * Check if proxy is SOCKS type
   */
  isSocks(proxy) {
    const proto = this.getProtocol(proxy);
    return proto === 'socks4' || proto === 'socks5';
  }

  /**
   * Get proxy count info with protocol breakdown
   */
  getStats() {
    const breakdown = { http: 0, https: 0, socks4: 0, socks5: 0 };
    this.proxyMeta.forEach(meta => {
      if (!this.failedProxies.has(meta.raw)) {
        breakdown[meta.protocol]++;
      }
    });

    return {
      total: this.proxies.length,
      available: this.proxies.length - this.failedProxies.size,
      failed: this.failedProxies.size,
      breakdown,
    };
  }

  /**
   * Get all proxies formatted as list (for display)
   */
  listAll() {
    return this.proxies.map(p => {
      const meta = this.proxyMeta.get(p);
      const failed = this.failedProxies.has(p);
      return {
        raw: p,
        protocol: meta?.protocol || 'unknown',
        host: meta?.host || '',
        port: meta?.port || 0,
        hasAuth: !!(meta?.username),
        failed,
      };
    });
  }
}

module.exports = ProxyRotator;
