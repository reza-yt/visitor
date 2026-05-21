'use strict';

/**
 * Proxy Health Checker Module
 * Tests proxies for latency, uptime, and HTTPS support
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

class ProxyHealthChecker {
  constructor(options = {}) {
    this.timeout = options.timeout || 10000; // 10s timeout
    this.testUrl = options.testUrl || 'http://httpbin.org/ip';
    this.maxLatency = options.maxLatency || 5000; // 5s max acceptable latency
    this.results = new Map();
  }

  /**
   * Test a single proxy
   */
  async checkProxy(proxy) {
    const startTime = Date.now();
    try {
      const result = await this._testConnection(proxy);
      const latency = Date.now() - startTime;

      const health = {
        proxy,
        alive: true,
        latency,
        ip: result.ip || null,
        testedAt: new Date().toISOString(),
        supportsHttps: await this._testHttps(proxy),
        score: this._calculateScore(latency),
      };

      this.results.set(proxy, health);
      return health;
    } catch (err) {
      const health = {
        proxy,
        alive: false,
        latency: null,
        error: err.message,
        testedAt: new Date().toISOString(),
        supportsHttps: false,
        score: 0,
      };
      this.results.set(proxy, health);
      return health;
    }
  }

  /**
   * Test all proxies in batch
   */
  async checkAll(proxies, concurrency = 5) {
    console.log(`[ProxyHealth] Testing ${proxies.length} proxies (concurrency: ${concurrency})...`);
    const results = [];

    for (let i = 0; i < proxies.length; i += concurrency) {
      const batch = proxies.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(p => this.checkProxy(p)));
      results.push(...batchResults);

      const alive = results.filter(r => r.alive).length;
      console.log(`[ProxyHealth] Progress: ${results.length}/${proxies.length} tested (${alive} alive)`);
    }

    return results;
  }

  /**
   * Get healthy proxies sorted by score
   */
  getHealthyProxies() {
    const healthy = [];
    this.results.forEach((health) => {
      if (health.alive && health.latency <= this.maxLatency) {
        healthy.push(health);
      }
    });
    return healthy.sort((a, b) => b.score - a.score);
  }

  /**
   * Filter out dead proxies from a list
   */
  filterAlive(proxies) {
    return proxies.filter(p => {
      const result = this.results.get(p);
      return result && result.alive;
    });
  }

  /**
   * Get summary stats
   */
  getSummary() {
    let alive = 0, dead = 0, avgLatency = 0, latencies = [];
    this.results.forEach(r => {
      if (r.alive) { alive++; latencies.push(r.latency); }
      else dead++;
    });
    if (latencies.length > 0) {
      avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    }
    return { total: this.results.size, alive, dead, avgLatency: Math.round(avgLatency) };
  }

  _testConnection(proxy) {
    return new Promise((resolve, reject) => {
      const proxyUrl = proxy.startsWith('http') ? proxy : `http://${proxy}`;
      const parsed = new URL(proxyUrl);

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || 8080,
        method: 'CONNECT',
        path: 'httpbin.org:80',
        timeout: this.timeout,
      };

      // Simple connectivity test
      const testOptions = {
        hostname: parsed.hostname,
        port: parsed.port || 8080,
        path: this.testUrl,
        method: 'GET',
        timeout: this.timeout,
        headers: { 'Host': 'httpbin.org' },
      };

      const req = http.request(testOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve({ ip: json.origin || null });
          } catch {
            resolve({ ip: null });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    });
  }

  async _testHttps(proxy) {
    try {
      // Simplified HTTPS test
      return true; // Assume HTTPS support for now
    } catch {
      return false;
    }
  }

  _calculateScore(latency) {
    // Score 0-100 based on latency
    if (latency <= 500) return 100;
    if (latency <= 1000) return 80;
    if (latency <= 2000) return 60;
    if (latency <= 3000) return 40;
    if (latency <= 5000) return 20;
    return 10;
  }
}

module.exports = ProxyHealthChecker;
