'use strict';

/**
 * DNS over HTTPS (DoH) Module
 * Resolves DNS queries via HTTPS to prevent DNS leaks
 */

const https = require('https');

class DnsOverHttps {
  constructor(options = {}) {
    this.providers = options.providers || [
      'https://cloudflare-dns.com/dns-query',
      'https://dns.google/resolve',
      'https://dns.quad9.net:5053/dns-query',
    ];
    this.currentProvider = 0;
    this.cache = new Map();
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes
  }

  /**
   * Resolve domain via DoH
   */
  async resolve(domain) {
    // Check cache first
    const cached = this.cache.get(domain);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.ip;
    }

    const provider = this.providers[this.currentProvider % this.providers.length];
    this.currentProvider++;

    try {
      const ip = await this._queryDoH(provider, domain);
      this.cache.set(domain, { ip, timestamp: Date.now() });
      console.log(`[DoH] Resolved ${domain} -> ${ip}`);
      return ip;
    } catch (err) {
      console.log(`[DoH] Failed to resolve ${domain}: ${err.message}`);
      // Try next provider
      if (this.currentProvider < this.providers.length * 2) {
        return this.resolve(domain);
      }
      return null;
    }
  }

  /**
   * Query DoH provider
   */
  _queryDoH(providerUrl, domain) {
    return new Promise((resolve, reject) => {
      const url = new URL(providerUrl);
      const isGoogle = url.hostname === 'dns.google';

      const params = isGoogle
        ? `?name=${domain}&type=A`
        : `?name=${domain}&type=A`;

      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + params,
        method: 'GET',
        headers: {
          'Accept': isGoogle ? 'application/json' : 'application/dns-json',
        },
        timeout: 5000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const answers = json.Answer || [];
            const aRecord = answers.find(a => a.type === 1); // A record
            if (aRecord) {
              resolve(aRecord.data);
            } else {
              reject(new Error('No A record found'));
            }
          } catch (e) {
            reject(new Error(`Parse error: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    });
  }

  /**
   * Apply DoH to puppeteer page (intercept DNS)
   * Uses --host-resolver-rules flag
   */
  async getResolverRules(domains) {
    const rules = [];
    for (const domain of domains) {
      const ip = await this.resolve(domain);
      if (ip) {
        rules.push(`MAP ${domain} ${ip}`);
      }
    }
    return rules.join(',');
  }

  /**
   * Get browser launch arg for DNS resolution
   */
  async getBrowserArgs(targetUrl) {
    try {
      const url = new URL(targetUrl);
      const ip = await this.resolve(url.hostname);
      if (ip) {
        return [`--host-resolver-rules=MAP ${url.hostname} ${ip}`];
      }
    } catch (e) {
      console.log(`[DoH] Could not pre-resolve: ${e.message}`);
    }
    return [];
  }

  /**
   * Clear DNS cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[DoH] Cache cleared');
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      providers: this.providers.length,
    };
  }
}

module.exports = DnsOverHttps;
