'use strict';

/**
 * Environment & CLI Configuration Module
 * Loads config from .env file and CLI arguments
 */

const fs = require('fs');
const path = require('path');

class EnvConfig {
  constructor() {
    this.envPath = path.join(process.cwd(), '.env');
    this.envVars = {};
    this.cliArgs = {};
  }

  /**
   * Load .env file manually (no external dependency)
   */
  loadEnv() {
    if (!fs.existsSync(this.envPath)) {
      console.log('[EnvConfig] No .env file found, using defaults');
      return this;
    }

    const content = fs.readFileSync(this.envPath, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();

      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      this.envVars[key] = value;
      process.env[key] = value;
    }

    console.log(`[EnvConfig] Loaded ${Object.keys(this.envVars).length} env vars from .env`);
    return this;
  }

  /**
   * Parse CLI arguments
   * Supports: --key=value, --key value, --flag
   */
  parseCli(argv) {
    const args = argv || process.argv.slice(2);

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith('--')) {
        const withoutDashes = arg.substring(2);

        if (withoutDashes.includes('=')) {
          const [key, ...valueParts] = withoutDashes.split('=');
          this.cliArgs[key] = valueParts.join('=');
        } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          this.cliArgs[withoutDashes] = args[i + 1];
          i++;
        } else {
          this.cliArgs[withoutDashes] = 'true';
        }
      } else if (arg.startsWith('-')) {
        const key = arg.substring(1);
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          this.cliArgs[key] = args[i + 1];
          i++;
        } else {
          this.cliArgs[key] = 'true';
        }
      }
    }

    return this;
  }

  /**
   * Get value with priority: CLI > ENV > default
   */
  get(key, defaultValue) {
    // CLI args (convert camelCase to kebab-case for lookup)
    const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    if (this.cliArgs[kebabKey] !== undefined) return this.cliArgs[kebabKey];
    if (this.cliArgs[key] !== undefined) return this.cliArgs[key];

    // Environment variables (convert to UPPER_SNAKE_CASE)
    const envKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
    if (process.env[envKey] !== undefined) return process.env[envKey];
    if (this.envVars[envKey] !== undefined) return this.envVars[envKey];

    // Direct key lookup
    if (process.env[key] !== undefined) return process.env[key];

    return defaultValue;
  }

  /**
   * Get as integer
   */
  getInt(key, defaultValue) {
    const val = this.get(key, defaultValue);
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Get as float
   */
  getFloat(key, defaultValue) {
    const val = this.get(key, defaultValue);
    const parsed = parseFloat(val);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Get as boolean
   */
  getBool(key, defaultValue) {
    const val = this.get(key, defaultValue);
    if (typeof val === 'boolean') return val;
    return val === 'true' || val === '1' || val === 'yes';
  }

  /**
   * Get as array (comma-separated)
   */
  getArray(key, defaultValue) {
    const val = this.get(key, null);
    if (!val) return defaultValue || [];
    return val.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  /**
   * Build full config object from env/cli
   */
  buildConfig() {
    return {
      targets: this.getArray('TARGET_URLS', ['https://example.com']),
      proxies: this.getArray('PROXIES', []),

      visits: {
        totalVisits: this.getInt('TOTAL_VISITS', 50),
        concurrentVisits: this.getInt('CONCURRENT_VISITS', 2),
        delayBetweenVisits: {
          min: this.getInt('DELAY_MIN', 5000),
          max: this.getInt('DELAY_MAX', 15000),
        },
      },

      behavior: {
        scrollDuration: this.getInt('SCROLL_DURATION', 30000),
        clickInternalLinks: this.getBool('CLICK_INTERNAL_LINKS', true),
        maxInternalClicks: this.getInt('MAX_INTERNAL_CLICKS', 3),
        simulateReading: this.getBool('SIMULATE_READING', true),
      },

      mobile: {
        ratio: this.getFloat('MOBILE_RATIO', 0.6),
        enableTouch: true,
      },

      browser: {
        headless: this.getBool('HEADLESS', true) ? 'new' : false,
        timeout: this.getInt('BROWSER_TIMEOUT', 60000),
        engine: this.get('ENGINE', 'puppeteer'),
        ignoreHTTPSErrors: true,
      },

      warmup: {
        enabled: this.getBool('WARMUP_ENABLED', true),
      },

      trafficPattern: {
        enabled: this.getBool('TRAFFIC_PATTERN_ENABLED', true),
        timezone: this.get('TRAFFIC_TIMEZONE', 'Asia/Jakarta'),
      },

      scheduler: {
        enabled: this.getBool('SCHEDULER_ENABLED', false),
        hours: this.getArray('SCHEDULER_HOURS', ['8','10','12','14','16','18','20']).map(Number),
        intervalMinutes: this.getInt('SCHEDULER_INTERVAL_MINUTES', 60),
      },

      proxyHealth: {
        enabled: this.getBool('PROXY_HEALTH_CHECK', true),
        maxLatency: this.getInt('PROXY_MAX_LATENCY', 5000),
      },

      doh: {
        enabled: this.getBool('DOH_ENABLED', true),
      },

      throttle: {
        enabled: this.getBool('THROTTLE_ENABLED', true),
      },

      logging: {
        format: this.get('LOG_FORMAT', 'json'),
        verbose: this.getBool('LOG_VERBOSE', true),
      },

      webhook: {
        enabled: this.getBool('TELEGRAM_ENABLED', false) || this.getBool('DISCORD_ENABLED', false),
        telegram: this.getBool('TELEGRAM_ENABLED', false) ? {
          botToken: this.get('TELEGRAM_BOT_TOKEN', ''),
          chatId: this.get('TELEGRAM_CHAT_ID', ''),
        } : null,
        discord: this.getBool('DISCORD_ENABLED', false) ? {
          webhookUrl: this.get('DISCORD_WEBHOOK_URL', ''),
        } : null,
        notifyOn: this.getArray('WEBHOOK_EVENTS', ['complete', 'error', 'captcha']),
      },
    };
  }

  /**
   * Print loaded config summary
   */
  printSummary(config) {
    console.log('\n[EnvConfig] Configuration Summary:');
    console.log(`  Targets: ${config.targets.length} URLs`);
    console.log(`  Proxies: ${config.proxies.length}`);
    console.log(`  Visits: ${config.visits.totalVisits} (${config.visits.concurrentVisits} concurrent)`);
    console.log(`  Mobile Ratio: ${config.mobile.ratio * 100}%`);
    console.log(`  Engine: ${config.browser.engine}`);
    console.log(`  Warmup: ${config.warmup.enabled}`);
    console.log(`  Traffic Pattern: ${config.trafficPattern.enabled}`);
    console.log(`  DoH: ${config.doh.enabled}`);
    console.log(`  Throttle: ${config.throttle.enabled}`);
    console.log(`  Webhook: ${config.webhook.enabled}\n`);
  }
}

module.exports = EnvConfig;
