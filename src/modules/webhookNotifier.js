'use strict';

/**
 * Webhook Notification Module
 * Sends notifications to Telegram and Discord
 */

const https = require('https');
const http = require('http');

class WebhookNotifier {
  constructor(options = {}) {
    this.telegram = options.telegram || null; // { botToken, chatId }
    this.discord = options.discord || null; // { webhookUrl }
    this.enabled = options.enabled !== false;
    this.notifyOn = options.notifyOn || ['complete', 'error', 'captcha'];
  }

  /**
   * Send notification to all configured channels
   */
  async notify(event, data) {
    if (!this.enabled) return;
    if (!this.notifyOn.includes(event)) return;

    const message = this._formatMessage(event, data);

    const promises = [];
    if (this.telegram) promises.push(this._sendTelegram(message));
    if (this.discord) promises.push(this._sendDiscord(message, event));

    await Promise.allSettled(promises);
  }

  /**
   * Send to Telegram
   */
  async _sendTelegram(message) {
    if (!this.telegram || !this.telegram.botToken || !this.telegram.chatId) return;

    const url = `https://api.telegram.org/bot${this.telegram.botToken}/sendMessage`;
    const payload = JSON.stringify({
      chat_id: this.telegram.chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    return this._httpPost(url, payload);
  }

  /**
   * Send to Discord
   */
  async _sendDiscord(message, event) {
    if (!this.discord || !this.discord.webhookUrl) return;

    const colors = { complete: 0x00ff00, error: 0xff0000, captcha: 0xffaa00, progress: 0x0099ff };

    const payload = JSON.stringify({
      embeds: [{
        title: `Auto Visitor - ${event.toUpperCase()}`,
        description: message,
        color: colors[event] || 0x808080,
        timestamp: new Date().toISOString(),
        footer: { text: 'Auto Visitor Bot' },
      }],
    });

    return this._httpPost(this.discord.webhookUrl, payload);
  }

  /**
   * Send batch complete notification
   */
  async notifyComplete(stats) {
    await this.notify('complete', {
      title: 'Batch Complete',
      total: stats.total,
      success: stats.success,
      failed: stats.failed,
      rate: stats.rate,
      runtime: stats.runtime,
    });
  }

  /**
   * Send error notification
   */
  async notifyError(error, context) {
    await this.notify('error', {
      title: 'Error Detected',
      error: error.message || error,
      context,
    });
  }

  /**
   * Send CAPTCHA notification
   */
  async notifyCaptcha(url, proxy) {
    await this.notify('captcha', {
      title: 'CAPTCHA Detected',
      url,
      proxy: proxy ? proxy.substring(0, 20) + '...' : 'direct',
    });
  }

  /**
   * Send progress notification
   */
  async notifyProgress(stats) {
    await this.notify('progress', {
      title: 'Progress Update',
      ...stats,
    });
  }

  _formatMessage(event, data) {
    switch (event) {
      case 'complete':
        return `<b>✅ Batch Complete</b>\n` +
          `Total: ${data.total}\n` +
          `Success: ${data.success}\n` +
          `Failed: ${data.failed}\n` +
          `Rate: ${data.rate}\n` +
          `Runtime: ${data.runtime}`;
      case 'error':
        return `<b>❌ Error</b>\n` +
          `Context: ${data.context}\n` +
          `Error: ${data.error}`;
      case 'captcha':
        return `<b>⚠️ CAPTCHA Detected</b>\n` +
          `URL: ${data.url}\n` +
          `Proxy: ${data.proxy}`;
      case 'progress':
        return `<b>📊 Progress</b>\n` +
          `Visits: ${data.total || 0}\n` +
          `Success: ${data.success || 0}\n` +
          `Rate: ${data.rate || '0%'}`;
      default:
        return JSON.stringify(data);
    }
  }

  _httpPost(url, payload) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 10000,
      };

      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', (err) => {
        console.log(`[Webhook] Failed: ${err.message}`);
        resolve(null); // Don't reject, webhook failures shouldn't stop visits
      });
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(payload);
      req.end();
    });
  }
}

module.exports = WebhookNotifier;
