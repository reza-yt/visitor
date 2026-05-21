'use strict';

/**
 * Viewport Randomizer Module
 * Generates realistic random viewport sizes for mobile and desktop
 */

// Common mobile device viewports
const MOBILE_VIEWPORTS = [
  // iPhone models
  { width: 390, height: 844, deviceScaleFactor: 3, name: 'iPhone 14' },
  { width: 393, height: 852, deviceScaleFactor: 3, name: 'iPhone 14 Pro' },
  { width: 430, height: 932, deviceScaleFactor: 3, name: 'iPhone 14 Pro Max' },
  { width: 375, height: 812, deviceScaleFactor: 3, name: 'iPhone 13 Mini' },
  { width: 390, height: 844, deviceScaleFactor: 3, name: 'iPhone 13' },
  { width: 428, height: 926, deviceScaleFactor: 3, name: 'iPhone 13 Pro Max' },
  { width: 375, height: 667, deviceScaleFactor: 2, name: 'iPhone SE' },
  { width: 414, height: 896, deviceScaleFactor: 2, name: 'iPhone XR' },
  // Samsung Galaxy
  { width: 360, height: 800, deviceScaleFactor: 3, name: 'Samsung Galaxy S21' },
  { width: 384, height: 854, deviceScaleFactor: 2.8, name: 'Samsung Galaxy S23' },
  { width: 412, height: 915, deviceScaleFactor: 3.5, name: 'Samsung Galaxy S23 Ultra' },
  { width: 360, height: 740, deviceScaleFactor: 4, name: 'Samsung Galaxy S10' },
  { width: 412, height: 869, deviceScaleFactor: 2.6, name: 'Samsung Galaxy A54' },
  // Google Pixel
  { width: 393, height: 851, deviceScaleFactor: 2.75, name: 'Pixel 7' },
  { width: 412, height: 892, deviceScaleFactor: 2.625, name: 'Pixel 7 Pro' },
  { width: 411, height: 823, deviceScaleFactor: 2.6, name: 'Pixel 5' },
  // Tablets
  { width: 768, height: 1024, deviceScaleFactor: 2, name: 'iPad Mini' },
  { width: 810, height: 1080, deviceScaleFactor: 2, name: 'iPad 10th Gen' },
  { width: 820, height: 1180, deviceScaleFactor: 2, name: 'iPad Air' },
  { width: 1024, height: 1366, deviceScaleFactor: 2, name: 'iPad Pro 12.9' },
];

// Common desktop viewports
const DESKTOP_VIEWPORTS = [
  { width: 1920, height: 1080, deviceScaleFactor: 1, name: 'Full HD' },
  { width: 1366, height: 768, deviceScaleFactor: 1, name: 'HD Laptop' },
  { width: 1440, height: 900, deviceScaleFactor: 1, name: 'WXGA+ Laptop' },
  { width: 1536, height: 864, deviceScaleFactor: 1.25, name: 'HD+ Scaled' },
  { width: 1280, height: 720, deviceScaleFactor: 1, name: 'HD' },
  { width: 1600, height: 900, deviceScaleFactor: 1, name: 'HD+' },
  { width: 2560, height: 1440, deviceScaleFactor: 1, name: 'QHD' },
  { width: 1280, height: 800, deviceScaleFactor: 1, name: 'WXGA' },
  { width: 1680, height: 1050, deviceScaleFactor: 1, name: 'WSXGA+' },
  { width: 1440, height: 1080, deviceScaleFactor: 2, name: 'MacBook Pro 14' },
  { width: 1512, height: 982, deviceScaleFactor: 2, name: 'MacBook Pro 16' },
  { width: 1470, height: 956, deviceScaleFactor: 2, name: 'MacBook Air M2' },
];

class ViewportRandomizer {
  constructor(options = {}) {
    this.mobileViewports = [...MOBILE_VIEWPORTS];
    this.desktopViewports = [...DESKTOP_VIEWPORTS];
    this.addVariation = options.addVariation !== false; // Add slight randomness by default
  }

  /**
   * Get random mobile viewport
   */
  getRandomMobile() {
    const viewport = { ...this.mobileViewports[Math.floor(Math.random() * this.mobileViewports.length)] };

    if (this.addVariation) {
      // Add slight variation (±0-5px) to avoid fingerprinting
      viewport.width += Math.floor(Math.random() * 6) - 2;
      viewport.height += Math.floor(Math.random() * 6) - 2;
    }

    viewport.hasTouch = true;
    viewport.isMobile = true;
    viewport.isLandscape = Math.random() < 0.1; // 10% landscape

    if (viewport.isLandscape) {
      [viewport.width, viewport.height] = [viewport.height, viewport.width];
    }

    return viewport;
  }

  /**
   * Get random desktop viewport
   */
  getRandomDesktop() {
    const viewport = { ...this.desktopViewports[Math.floor(Math.random() * this.desktopViewports.length)] };

    if (this.addVariation) {
      // Simulate different browser chrome sizes (toolbar, bookmarks bar)
      viewport.height -= Math.floor(Math.random() * 80) + 20; // -20 to -100px for browser UI
      viewport.width -= Math.floor(Math.random() * 20); // slight width variation
    }

    viewport.hasTouch = false;
    viewport.isMobile = false;
    viewport.isLandscape = true;

    return viewport;
  }

  /**
   * Get random viewport (auto-detect based on isMobile flag)
   */
  getRandom(isMobile = false) {
    return isMobile ? this.getRandomMobile() : this.getRandomDesktop();
  }

  /**
   * Get viewport config object for Puppeteer
   */
  toPuppeteerConfig(viewport) {
    return {
      width: Math.max(viewport.width, 320),
      height: Math.max(viewport.height, 480),
      deviceScaleFactor: viewport.deviceScaleFactor || 1,
      hasTouch: viewport.hasTouch || false,
      isMobile: viewport.isMobile || false,
      isLandscape: viewport.isLandscape || false,
    };
  }
}

module.exports = ViewportRandomizer;
