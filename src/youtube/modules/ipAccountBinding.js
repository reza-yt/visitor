'use strict';

/**
 * IP-Account Binding Module
 * Each account consistently uses the same proxy/IP range
 * Prevents suspicious pattern of same account from different IPs
 */

const fs = require('fs');
const path = require('path');

class IpAccountBinding {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'ip-binding');
    this.maxProxiesPerAccount = options.maxProxiesPerAccount || 2;
    this._ensureDir();
  }

  _ensureDir() { if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true }); }

  /**
   * Get assigned proxy for account (or assign one)
   */
  getProxyForAccount(accountName, availableProxies) {
    if (!availableProxies || availableProxies.length === 0) return null;

    const bindings = this._getBindings();

    // Check existing binding
    if (bindings[accountName] && bindings[accountName].length > 0) {
      const bound = bindings[accountName];
      // Find an available bound proxy
      const available = bound.filter(p => availableProxies.includes(p));
      if (available.length > 0) {
        const proxy = available[Math.floor(Math.random() * available.length)];
        console.log(`[IPBinding] ${accountName} → ${proxy.substring(0, 25)}... (bound)`);
        return proxy;
      }
    }

    // Assign new proxy (prefer least-used)
    const usageCounts = {};
    Object.values(bindings).forEach(proxies => {
      proxies.forEach(p => { usageCounts[p] = (usageCounts[p] || 0) + 1; });
    });

    // Sort by usage (least used first)
    const sorted = availableProxies.sort((a, b) => (usageCounts[a] || 0) - (usageCounts[b] || 0));
    const assigned = sorted[0];

    // Save binding
    if (!bindings[accountName]) bindings[accountName] = [];
    if (!bindings[accountName].includes(assigned)) {
      bindings[accountName].push(assigned);
      // Limit bindings per account
      if (bindings[accountName].length > this.maxProxiesPerAccount) {
        bindings[accountName] = bindings[accountName].slice(-this.maxProxiesPerAccount);
      }
    }
    this._saveBindings(bindings);

    console.log(`[IPBinding] ${accountName} → ${assigned.substring(0, 25)}... (new binding)`);
    return assigned;
  }

  /**
   * Check if a proxy is free (not bound to too many accounts)
   */
  isProxyAvailable(proxy, maxAccounts = 3) {
    const bindings = this._getBindings();
    let count = 0;
    Object.values(bindings).forEach(proxies => {
      if (proxies.includes(proxy)) count++;
    });
    return count < maxAccounts;
  }

  /**
   * Get all bindings summary
   */
  getSummary() {
    const bindings = this._getBindings();
    return Object.entries(bindings).map(([account, proxies]) => ({
      account, proxies: proxies.length, list: proxies.map(p => p.substring(0, 20) + '...')
    }));
  }

  _getBindings() {
    const filePath = path.join(this.dataDir, 'bindings.json');
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {};
  }

  _saveBindings(bindings) {
    const filePath = path.join(this.dataDir, 'bindings.json');
    fs.writeFileSync(filePath, JSON.stringify(bindings, null, 2));
  }
}

module.exports = IpAccountBinding;
