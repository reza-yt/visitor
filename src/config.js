'use strict';

/**
 * Default Configuration for Auto Visitor
 * Values can be overridden by .env file or CLI arguments
 */
module.exports = {
  // Target URLs to visit
  targets: [
    'https://example.com',
  ],

  // Proxy list (format: protocol://user:pass@host:port or host:port)
  proxies: [],

  // Visit settings
  visits: {
    totalVisits: 50,
    concurrentVisits: 2,
    delayBetweenVisits: { min: 5000, max: 15000 },
  },

  // Human behavior
  behavior: {
    scrollDuration: 30000,
    minPageStay: 15000,
    maxPageStay: 90000,
    clickInternalLinks: true,
    maxInternalClicks: 3,
    simulateReading: true,
  },

  // Mobile emulation
  mobile: {
    ratio: 0.6,
    enableTouch: true,
  },

  // Timing
  timing: {
    pageLoadWait: { min: 2000, max: 5000 },
    beforeScroll: { min: 1000, max: 3000 },
    betweenScrolls: { min: 500, max: 3000 },
    beforeClick: { min: 1000, max: 4000 },
    afterClick: { min: 2000, max: 6000 },
  },

  // Browser settings
  browser: {
    headless: 'new',
    timeout: 60000,
    engine: 'puppeteer', // 'puppeteer' or 'playwright'
    ignoreHTTPSErrors: true,
  },

  // Warm-up phase
  warmup: {
    enabled: true,
    phases: [
      { visits: 2, delay: 30000, label: 'Phase 1: Warming up' },
      { visits: 5, delay: 20000, label: 'Phase 2: Light traffic' },
      { visits: 10, delay: 15000, label: 'Phase 3: Normal traffic' },
      { visits: 20, delay: 10000, label: 'Phase 4: Ramping up' },
      { visits: -1, delay: 8000, label: 'Phase 5: Full speed' },
    ],
  },

  // Traffic pattern
  trafficPattern: {
    enabled: true,
    timezone: 'Asia/Jakarta',
  },

  // Scheduler
  scheduler: {
    enabled: false,
    hours: [8, 10, 12, 14, 16, 18, 20],
    intervalMinutes: 60,
  },

  // Proxy health check
  proxyHealth: {
    enabled: true,
    maxLatency: 5000,
    timeout: 10000,
  },

  // DNS over HTTPS
  doh: {
    enabled: true,
    providers: [
      'https://cloudflare-dns.com/dns-query',
      'https://dns.google/resolve',
    ],
  },

  // Bandwidth throttling
  throttle: {
    enabled: true,
  },

  // Retry settings
  retry: {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffFactor: 2,
  },

  // Logging
  logging: {
    format: 'json', // 'json' or 'csv'
    verbose: true,
    showProgress: true,
  },

  // Webhook notifications
  webhook: {
    enabled: false,
    telegram: null, // { botToken: '', chatId: '' }
    discord: null, // { webhookUrl: '' }
    notifyOn: ['complete', 'error', 'captcha'],
  },
};
