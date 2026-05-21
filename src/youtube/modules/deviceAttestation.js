'use strict';

/**
 * Device Attestation Module
 * Simulates consistent device identity for trust building
 * Each account should appear to use the same device(s) over time
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class DeviceAttestation {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'devices');
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Get or generate a persistent device identity for an account
   */
  getDeviceForAccount(accountName, isMobile = false) {
    const filePath = path.join(this.dataDir, `${accountName}.json`);

    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const device = isMobile ? data.mobile : data.desktop;
      if (device) return device;
    }

    // Generate new persistent device
    const device = isMobile ? this._generateMobileDevice() : this._generateDesktopDevice();
    this._saveDevice(accountName, device, isMobile);
    return device;
  }


  /**
   * Generate persistent desktop device identity
   */
  _generateDesktopDevice() {
    const screens = [
      { width: 1920, height: 1080, scale: 1 },
      { width: 1440, height: 900, scale: 2 },
      { width: 1536, height: 864, scale: 1.25 },
      { width: 2560, height: 1440, scale: 1 },
      { width: 1680, height: 1050, scale: 1 },
    ];
    const screen = screens[Math.floor(Math.random() * screens.length)];
    const cores = [4, 6, 8, 12, 16][Math.floor(Math.random() * 5)];
    const memory = [4, 8, 16, 32][Math.floor(Math.random() * 4)];

    return {
      type: 'desktop',
      id: crypto.randomBytes(16).toString('hex'),
      screen,
      cores,
      memory,
      platform: this._randomFrom(['Win32', 'MacIntel', 'Linux x86_64']),
      gpu: this._randomDesktopGPU(),
      timezone: null, // Set based on proxy
      language: 'id-ID',
      fonts: this._generateFontList('desktop'),
      plugins: this._generatePluginList(),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate persistent mobile device identity
   */
  _generateMobileDevice() {
    const devices = [
      { model: 'SM-S918B', brand: 'Samsung', screen: { width: 360, height: 800, scale: 3 } },
      { model: 'Pixel 7', brand: 'Google', screen: { width: 393, height: 851, scale: 2.75 } },
      { model: 'SM-A546B', brand: 'Samsung', screen: { width: 384, height: 854, scale: 2.8 } },
      { model: 'iPhone14,5', brand: 'Apple', screen: { width: 390, height: 844, scale: 3 } },
      { model: 'iPhone15,2', brand: 'Apple', screen: { width: 393, height: 852, scale: 3 } },
    ];
    const device = devices[Math.floor(Math.random() * devices.length)];

    return {
      type: 'mobile',
      id: crypto.randomBytes(16).toString('hex'),
      model: device.model,
      brand: device.brand,
      screen: device.screen,
      cores: [4, 6, 8][Math.floor(Math.random() * 3)],
      memory: [3, 4, 6, 8][Math.floor(Math.random() * 4)],
      platform: device.brand === 'Apple' ? 'iPhone' : 'Linux armv8l',
      touchPoints: 5,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Apply device attestation to browser page
   */
  async apply(page, device) {
    await page.evaluateOnNewDocument((dev) => {
      // Persistent hardware concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => dev.cores });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => dev.memory });
      Object.defineProperty(navigator, 'platform', { get: () => dev.platform });

      // Screen properties
      if (dev.screen) {
        Object.defineProperty(screen, 'width', { get: () => dev.screen.width * (dev.screen.scale || 1) });
        Object.defineProperty(screen, 'height', { get: () => dev.screen.height * (dev.screen.scale || 1) });
        Object.defineProperty(screen, 'availWidth', { get: () => dev.screen.width * (dev.screen.scale || 1) });
        Object.defineProperty(screen, 'availHeight', { get: () => (dev.screen.height - 40) * (dev.screen.scale || 1) });
        Object.defineProperty(window, 'devicePixelRatio', { get: () => dev.screen.scale || 1 });
      }

      // Touch support for mobile
      if (dev.type === 'mobile') {
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => dev.touchPoints || 5 });
      }

      // Persistent WebGL renderer (from device GPU)
      if (dev.gpu) {
        const getParameterProxy = new Proxy(WebGLRenderingContext.prototype.getParameter, {
          apply(target, thisArg, args) {
            if (args[0] === 0x9245) return dev.gpu.vendor;
            if (args[0] === 0x9246) return dev.gpu.renderer;
            return Reflect.apply(target, thisArg, args);
          }
        });
        WebGLRenderingContext.prototype.getParameter = getParameterProxy;
        if (typeof WebGL2RenderingContext !== 'undefined') {
          WebGL2RenderingContext.prototype.getParameter = getParameterProxy;
        }
      }
    }, device);

    console.log(`[DeviceAttestation] Applied ${device.type} device: ${device.id.substring(0, 8)}...`);
  }

  _randomDesktopGPU() {
    const gpus = [
      { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA GeForce GTX 1660 Direct3D11)' },
      { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA GeForce RTX 3060 Direct3D11)' },
      { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD Radeon RX 580 Direct3D11)' },
      { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel UHD Graphics 630 Direct3D11)' },
      { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel Iris Xe Graphics Direct3D11)' },
      { vendor: 'Apple', renderer: 'Apple M1' },
      { vendor: 'Apple', renderer: 'Apple M2 Pro' },
    ];
    return gpus[Math.floor(Math.random() * gpus.length)];
  }

  _generateFontList(type) {
    const baseFonts = ['Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Courier New'];
    const extraFonts = type === 'desktop'
      ? ['Segoe UI', 'Roboto', 'Open Sans', 'Georgia', 'Calibri', 'Cambria']
      : ['Roboto', 'Droid Sans'];
    return [...baseFonts, ...extraFonts.slice(0, Math.floor(Math.random() * extraFonts.length) + 1)];
  }

  _generatePluginList() {
    return [
      { name: 'PDF Viewer', filename: 'internal-pdf-viewer' },
      { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' },
      { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer' },
    ];
  }

  _saveDevice(accountName, device, isMobile) {
    const filePath = path.join(this.dataDir, `${accountName}.json`);
    let data = {};
    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    data[isMobile ? 'mobile' : 'desktop'] = device;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  _randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

module.exports = DeviceAttestation;
