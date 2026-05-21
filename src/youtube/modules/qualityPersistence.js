'use strict';

/**
 * Video Quality Persistence Module
 * Real humans stick to a preferred quality. This persists per account.
 */

const fs = require('fs');
const path = require('path');

class QualityPersistence {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'quality');
    this._ensureDir();
  }

  _ensureDir() { if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true }); }

  getPreferred(accountName, isMobile) {
    const filePath = path.join(this.dataDir, `${accountName}.json`);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return isMobile ? data.mobile : data.desktop;
    }
    const quality = isMobile
      ? ['auto', '360p', '480p', '720p'][Math.floor(Math.random() * 4)]
      : ['auto', '720p', '1080p'][Math.floor(Math.random() * 3)];
    this._save(accountName, quality, isMobile);
    return quality;
  }

  _save(accountName, quality, isMobile) {
    const filePath = path.join(this.dataDir, `${accountName}.json`);
    let data = {};
    if (fs.existsSync(filePath)) data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data[isMobile ? 'mobile' : 'desktop'] = quality;
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  async applyQuality(page, quality) {
    if (quality === 'auto') return;
    try {
      await page.waitForTimeout(3000);
      const settingsBtn = await page.$('.ytp-settings-button');
      if (settingsBtn) { await settingsBtn.click(); await page.waitForTimeout(1000); }
      const qualityItem = await page.$('.ytp-menuitem[role="menuitem"]:last-child');
      if (qualityItem) { await qualityItem.click(); await page.waitForTimeout(1000); }
      const qualityOptions = await page.$$('.ytp-quality-menu .ytp-menuitem');
      const qMap = { '1080p': 0, '720p': 1, '480p': 2, '360p': 3 };
      const idx = qMap[quality] || 0;
      if (qualityOptions[idx]) { await qualityOptions[idx].click(); console.log(`[Quality] Set to ${quality}`); }
      else { await page.keyboard.press('Escape'); }
    } catch (e) { console.log(`[Quality] Failed to set: ${e.message}`); }
  }
}

module.exports = QualityPersistence;
