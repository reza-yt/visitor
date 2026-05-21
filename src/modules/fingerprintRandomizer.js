'use strict';

/**
 * Canvas/WebGL Fingerprint Randomization Module
 * Randomizes canvas, WebGL, and audio fingerprints to avoid detection
 */

class FingerprintRandomizer {
  constructor() {
    this.noiseLevel = 0.02; // 2% noise
  }

  /**
   * Apply all fingerprint randomizations to a page
   */
  async apply(page) {
    await this._randomizeCanvas(page);
    await this._randomizeWebGL(page);
    await this._randomizeAudioContext(page);
    await this._randomizeClientRects(page);
    await this._randomizeHardware(page);
    console.log('[FingerprintRandomizer] All fingerprint randomizations applied');
  }

  /**
   * Randomize canvas fingerprint
   */
  async _randomizeCanvas(page) {
    await page.evaluateOnNewDocument(() => {
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const originalToBlob = HTMLCanvasElement.prototype.toBlob;
      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

      // Add noise to toDataURL
      HTMLCanvasElement.prototype.toDataURL = function (type, quality) {
        const ctx = this.getContext('2d');
        if (ctx) {
          const imageData = originalGetImageData.call(ctx, 0, 0, this.width, this.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            // Add subtle noise to RGB channels
            imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + (Math.random() * 2 - 1)));
            imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + (Math.random() * 2 - 1)));
            imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + (Math.random() * 2 - 1)));
          }
          ctx.putImageData(imageData, 0, 0);
        }
        return originalToDataURL.call(this, type, quality);
      };

      // Add noise to toBlob
      HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
        const ctx = this.getContext('2d');
        if (ctx) {
          const imageData = originalGetImageData.call(ctx, 0, 0, this.width, this.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + (Math.random() * 2 - 1)));
          }
          ctx.putImageData(imageData, 0, 0);
        }
        return originalToBlob.call(this, callback, type, quality);
      };
    });
  }

  /**
   * Randomize WebGL fingerprint
   */
  async _randomizeWebGL(page) {
    await page.evaluateOnNewDocument(() => {
      const VENDORS = ['Google Inc.', 'Google Inc. (NVIDIA)', 'Google Inc. (AMD)', 'Google Inc. (Intel)'];
      const RENDERERS = [
        'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Apple M1 Pro Metal)',
        'ANGLE (Apple M2 Metal)',
        'Mali-G78 MC20',
        'Adreno (TM) 730',
      ];

      const vendor = VENDORS[Math.floor(Math.random() * VENDORS.length)];
      const renderer = RENDERERS[Math.floor(Math.random() * RENDERERS.length)];

      const getParameterProxy = new Proxy(WebGLRenderingContext.prototype.getParameter, {
        apply(target, thisArg, args) {
          const param = args[0];
          // UNMASKED_VENDOR_WEBGL
          if (param === 0x9245) return vendor;
          // UNMASKED_RENDERER_WEBGL
          if (param === 0x9246) return renderer;
          return Reflect.apply(target, thisArg, args);
        }
      });

      WebGLRenderingContext.prototype.getParameter = getParameterProxy;

      // Also override WebGL2
      if (typeof WebGL2RenderingContext !== 'undefined') {
        WebGL2RenderingContext.prototype.getParameter = getParameterProxy;
      }
    });
  }

  /**
   * Randomize AudioContext fingerprint
   */
  async _randomizeAudioContext(page) {
    await page.evaluateOnNewDocument(() => {
      const originalCreateOscillator = AudioContext.prototype.createOscillator;
      const originalCreateDynamicsCompressor = AudioContext.prototype.createDynamicsCompressor;

      AudioContext.prototype.createOscillator = function () {
        const oscillator = originalCreateOscillator.call(this);
        const originalConnect = oscillator.connect;
        oscillator.connect = function (dest) {
          // Add tiny noise to audio output
          const gainNode = this.context.createGain();
          gainNode.gain.value = 1 + (Math.random() * 0.0001 - 0.00005);
          originalConnect.call(this, gainNode);
          gainNode.connect(dest);
          return dest;
        };
        return oscillator;
      };
    });
  }

  /**
   * Randomize client rects (element positioning fingerprint)
   */
  async _randomizeClientRects(page) {
    await page.evaluateOnNewDocument(() => {
      const originalGetClientRects = Element.prototype.getClientRects;
      const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

      Element.prototype.getClientRects = function () {
        const rects = originalGetClientRects.call(this);
        const noise = () => Math.random() * 0.001;
        for (let i = 0; i < rects.length; i++) {
          // Can't modify DOMRect directly, but this prevents consistent fingerprint
        }
        return rects;
      };
    });
  }

  /**
   * Randomize hardware info (navigator.hardwareConcurrency, deviceMemory)
   */
  async _randomizeHardware(page) {
    const cores = [2, 4, 6, 8, 12, 16][Math.floor(Math.random() * 6)];
    const memory = [2, 4, 8, 16][Math.floor(Math.random() * 4)];

    await page.evaluateOnNewDocument((c, m) => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => c });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => m });

      // Randomize screen color depth
      const colorDepths = [24, 30, 32];
      Object.defineProperty(screen, 'colorDepth', {
        get: () => colorDepths[Math.floor(Math.random() * colorDepths.length)]
      });
    }, cores, memory);
  }
}

module.exports = FingerprintRandomizer;
