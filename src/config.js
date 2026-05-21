'use strict';

/**
 * Configuration file for Auto Visitor
 */
module.exports = {
  // Target URLs to visit
  targets: [
    'https://example.com',
    // Add more URLs here
  ],

  // Proxy list (format: protocol://user:pass@host:port or host:port)
  proxies: [
    // 'http://user:pass@proxy1.example.com:8080',
    // 'socks5://user:pass@proxy2.example.com:1080',
    // '123.456.789.0:8080',
  ],

  // Visit settings
  visits: {
    totalVisits: 50,           // Total number of visits
    concurrentVisits: 2,       // Simultaneous browser sessions
    delayBetweenVisits: {      // Delay between each visit batch
      min: 5000,               // 5 seconds minimum
      max: 15000,              // 15 seconds maximum
    },
  },

  // Behavior settings
  behavior: {
    scrollDuration: 30000,       // Random scroll duration (30s)
    minPageStay: 15000,          // Minimum time on page (15s)
    maxPageStay: 90000,          // Maximum time on page (90s)
    clickInternalLinks: true,    // Click other articles
    maxInternalClicks: 3,        // Max articles to visit per session
    simulateReading: true,       // Simulate reading behavior
  },

  // Mobile emulation ratio
  mobile: {
    ratio: 0.6,                  // 60% mobile visitors
    enableTouch: true,
  },

  // Timing settings (realistic delays)
  timing: {
    pageLoadWait: { min: 2000, max: 5000 },
    beforeScroll: { min: 1000, max: 3000 },
    betweenScrolls: { min: 500, max: 3000 },
    beforeClick: { min: 1000, max: 4000 },
    afterClick: { min: 2000, max: 6000 },
  },

  // Browser settings
  browser: {
    headless: 'new',             // 'new' for headless, false for visible
    timeout: 60000,              // Page timeout (60s)
    ignoreHTTPSErrors: true,
  },

  // Logging
  logging: {
    verbose: true,
    showProgress: true,
  },
};
