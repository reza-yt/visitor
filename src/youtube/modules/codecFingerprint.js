'use strict';

/**
 * Media Codec Fingerprint Module
 * Simulates realistic media codec support that matches device type
 */

class CodecFingerprint {
  constructor() {
    this.profiles = this._buildProfiles();
  }

  _buildProfiles() {
    return {
      chrome_desktop: {
        video: [
          { type: 'video/webm; codecs="vp9"', support: 'probably' },
          { type: 'video/webm; codecs="vp8"', support: 'probably' },

          { type: 'video/mp4; codecs="avc1.42E01E"', support: 'probably' },
          { type: 'video/mp4; codecs="avc1.4D401E"', support: 'probably' },
          { type: 'video/mp4; codecs="avc1.64001E"', support: 'probably' },
          { type: 'video/webm; codecs="av01.0.05M.08"', support: 'probably' },
          { type: 'video/mp4; codecs="hev1.1.6.L93.B0"', support: '' },
        ],
        audio: [
          { type: 'audio/webm; codecs="opus"', support: 'probably' },
          { type: 'audio/webm; codecs="vorbis"', support: 'probably' },
          { type: 'audio/mp4; codecs="mp4a.40.2"', support: 'probably' },
          { type: 'audio/mpeg', support: 'probably' },
          { type: 'audio/flac', support: 'probably' },
        ],
      },
      chrome_mobile: {
        video: [
          { type: 'video/webm; codecs="vp9"', support: 'probably' },
          { type: 'video/webm; codecs="vp8"', support: 'probably' },
          { type: 'video/mp4; codecs="avc1.42E01E"', support: 'probably' },
          { type: 'video/mp4; codecs="avc1.4D401E"', support: 'probably' },
          { type: 'video/webm; codecs="av01.0.05M.08"', support: 'maybe' },
        ],
        audio: [
          { type: 'audio/webm; codecs="opus"', support: 'probably' },
          { type: 'audio/mp4; codecs="mp4a.40.2"', support: 'probably' },
          { type: 'audio/mpeg', support: 'probably' },
        ],
      },
      safari_desktop: {
        video: [
          { type: 'video/mp4; codecs="avc1.42E01E"', support: 'probably' },
          { type: 'video/mp4; codecs="hev1.1.6.L93.B0"', support: 'probably' },
          { type: 'video/webm; codecs="vp9"', support: '' },
          { type: 'video/webm; codecs="vp8"', support: '' },
        ],
        audio: [
          { type: 'audio/mp4; codecs="mp4a.40.2"', support: 'probably' },
          { type: 'audio/mpeg', support: 'probably' },
          { type: 'audio/webm; codecs="opus"', support: 'maybe' },
        ],
      },
      firefox_desktop: {
        video: [
          { type: 'video/webm; codecs="vp9"', support: 'probably' },
          { type: 'video/webm; codecs="vp8"', support: 'probably' },
          { type: 'video/mp4; codecs="avc1.42E01E"', support: 'probably' },
          { type: 'video/webm; codecs="av01.0.05M.08"', support: 'probably' },
        ],
        audio: [
          { type: 'audio/webm; codecs="opus"', support: 'probably' },
          { type: 'audio/webm; codecs="vorbis"', support: 'probably' },
          { type: 'audio/mp4; codecs="mp4a.40.2"', support: 'probably' },
          { type: 'audio/ogg; codecs="flac"', support: 'probably' },
        ],
      },
    };
  }


  /**
   * Get codec profile based on user agent
   */
  getProfile(userAgent) {
    if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) return 'safari_desktop';
    if (/Firefox/.test(userAgent)) return 'firefox_desktop';
    if (/Mobile|Android/.test(userAgent)) return 'chrome_mobile';
    return 'chrome_desktop';
  }

  /**
   * Apply codec fingerprint to page
   */
  async apply(page, userAgent) {
    const profileName = this.getProfile(userAgent || '');
    const profile = this.profiles[profileName];

    await page.evaluateOnNewDocument((codecProfile) => {
      // Override HTMLMediaElement.canPlayType
      const originalCanPlayType = HTMLMediaElement.prototype.canPlayType;
      HTMLMediaElement.prototype.canPlayType = function (type) {
        const allCodecs = [...codecProfile.video, ...codecProfile.audio];
        const match = allCodecs.find(c => c.type === type);
        if (match) return match.support;
        return originalCanPlayType.call(this, type);
      };

      // Override MediaSource.isTypeSupported
      if (window.MediaSource) {
        const originalIsTypeSupported = MediaSource.isTypeSupported;
        MediaSource.isTypeSupported = function (type) {
          const allCodecs = [...codecProfile.video, ...codecProfile.audio];
          const match = allCodecs.find(c => type.includes(c.type.split(';')[0]));
          if (match) return match.support === 'probably' || match.support === 'maybe';
          return originalIsTypeSupported.call(this, type);
        };
      }
    }, profile);

    console.log(`[CodecFingerprint] Applied profile: ${profileName}`);
    return profileName;
  }

  /**
   * Get supported formats for EME (Encrypted Media Extensions)
   */
  async applyEME(page, profileName) {
    await page.evaluateOnNewDocument((pName) => {
      // Simulate Widevine DRM support (required for HD YouTube)
      if (navigator.requestMediaKeySystemAccess) {
        const original = navigator.requestMediaKeySystemAccess;
        navigator.requestMediaKeySystemAccess = function (keySystem, configs) {
          // Simulate successful Widevine access
          if (keySystem === 'com.widevine.alpha') {
            return original.call(this, keySystem, configs);
          }
          return original.call(this, keySystem, configs);
        };
      }
    }, profileName);
  }
}

module.exports = CodecFingerprint;
