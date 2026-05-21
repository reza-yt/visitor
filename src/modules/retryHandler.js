'use strict';

/**
 * Error Recovery & Retry Logic Module
 * Exponential backoff, smart retry, error categorization
 */

class RetryHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 2000; // 2s base
    this.maxDelay = options.maxDelay || 30000; // 30s max
    this.backoffFactor = options.backoffFactor || 2;
    this.jitterRange = options.jitterRange || 1000;
    this.stats = { retries: 0, recovered: 0, abandoned: 0 };
  }

  /**
   * Execute with retry logic (exponential backoff + jitter)
   */
  async execute(fn, context = 'unknown') {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await fn(attempt);
        if (attempt > 0) {
          this.stats.recovered++;
          console.log(`[RetryHandler] Recovered on attempt ${attempt + 1}: ${context}`);
        }
        return result;
      } catch (error) {
        lastError = error;
        this.stats.retries++;

        const errorType = this._categorizeError(error);
        console.log(`[RetryHandler] Attempt ${attempt + 1}/${this.maxRetries + 1} failed (${errorType}): ${error.message}`);

        // Don't retry non-recoverable errors
        if (errorType === 'fatal') {
          console.log(`[RetryHandler] Fatal error, not retrying: ${context}`);
          break;
        }

        // Wait before retry (exponential backoff + jitter)
        if (attempt < this.maxRetries) {
          const delay = this._calculateDelay(attempt);
          console.log(`[RetryHandler] Waiting ${(delay / 1000).toFixed(1)}s before retry...`);
          await this._sleep(delay);
        }
      }
    }

    this.stats.abandoned++;
    throw lastError;
  }

  /**
   * Calculate delay with exponential backoff + jitter
   */
  _calculateDelay(attempt) {
    const exponentialDelay = this.baseDelay * Math.pow(this.backoffFactor, attempt);
    const jitter = Math.random() * this.jitterRange;
    return Math.min(exponentialDelay + jitter, this.maxDelay);
  }

  /**
   * Categorize error type to decide retry strategy
   */
  _categorizeError(error) {
    const message = error.message.toLowerCase();

    // Fatal errors - don't retry
    if (message.includes('invalid url') || message.includes('err_invalid_url')) return 'fatal';
    if (message.includes('not allowed') || message.includes('permission denied')) return 'fatal';
    if (message.includes('net::err_aborted') && message.includes('403')) return 'fatal';

    // Network errors - retry with proxy change
    if (message.includes('timeout') || message.includes('timedout')) return 'timeout';
    if (message.includes('net::err_connection') || message.includes('econnrefused')) return 'network';
    if (message.includes('net::err_proxy') || message.includes('proxy')) return 'proxy';
    if (message.includes('net::err_name_not_resolved')) return 'dns';

    // Rate limiting - retry with longer delay
    if (message.includes('429') || message.includes('too many requests')) return 'ratelimit';
    if (message.includes('503') || message.includes('service unavailable')) return 'server';

    // CAPTCHA - skip
    if (message.includes('captcha') || message.includes('challenge')) return 'captcha';

    return 'unknown';
  }

  /**
   * Get recovery suggestion based on error type
   */
  getRecoverySuggestion(error) {
    const type = this._categorizeError(error);
    switch (type) {
      case 'timeout': return { action: 'retry', changeProxy: true, increaseTimeout: true };
      case 'network': return { action: 'retry', changeProxy: true };
      case 'proxy': return { action: 'retry', changeProxy: true, markProxyFailed: true };
      case 'dns': return { action: 'retry', useDoh: true };
      case 'ratelimit': return { action: 'retry', longDelay: true, changeProxy: true };
      case 'server': return { action: 'retry', longDelay: true };
      case 'captcha': return { action: 'skip', changeProxy: true };
      case 'fatal': return { action: 'abort' };
      default: return { action: 'retry' };
    }
  }

  /**
   * Get retry stats
   */
  getStats() {
    return { ...this.stats };
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RetryHandler;
