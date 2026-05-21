'use strict';

/**
 * Notification Bell Interaction Module
 * Simulates clicking notification bell for trust building
 */

class NotificationBell {
  constructor(options = {}) {
    this.bellClickChance = options.bellClickChance || 0.08;
    this.checkNotificationsChance = options.checkNotificationsChance || 0.2;
  }

  async maybeClickBell(page) {
    if (Math.random() > this.bellClickChance) return false;
    try {
      await page.waitForTimeout(this._rand(5000, 30000));
      const bellBtn = await page.$('#subscription-notification-toggle button, ytd-subscription-notification-toggle-button-renderer button');
      if (bellBtn) {
        const isActive = await page.evaluate(el => el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-label')?.includes('All'), bellBtn);
        if (!isActive) { await bellBtn.click(); await page.waitForTimeout(2000); console.log('[Bell] Clicked notification bell'); return true; }
      }
    } catch (e) {}
    return false;
  }

  async checkNotifications(page) {
    if (Math.random() > this.checkNotificationsChance) return false;
    try {
      const notifBtn = await page.$('button#button[aria-label*="Notification"], ytd-notification-topbar-button-renderer button');
      if (notifBtn) { await notifBtn.click(); await page.waitForTimeout(this._rand(3000, 8000)); await page.keyboard.press('Escape'); console.log('[Bell] Checked notifications'); return true; }
    } catch (e) {}
    return false;
  }

  _rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
}

module.exports = NotificationBell;
