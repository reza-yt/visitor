'use strict';

/**
 * Timezone & Geolocation Spoofing Module
 * Matches timezone, locale, and geolocation with proxy location
 */

const TIMEZONE_DATA = [
  { country: 'ID', timezone: 'Asia/Jakarta', locale: 'id-ID', lat: -6.2088, lng: 106.8456, city: 'Jakarta' },
  { country: 'ID', timezone: 'Asia/Makassar', locale: 'id-ID', lat: -5.1477, lng: 119.4327, city: 'Makassar' },
  { country: 'US', timezone: 'America/New_York', locale: 'en-US', lat: 40.7128, lng: -74.0060, city: 'New York' },
  { country: 'US', timezone: 'America/Los_Angeles', locale: 'en-US', lat: 34.0522, lng: -118.2437, city: 'Los Angeles' },
  { country: 'US', timezone: 'America/Chicago', locale: 'en-US', lat: 41.8781, lng: -87.6298, city: 'Chicago' },
  { country: 'GB', timezone: 'Europe/London', locale: 'en-GB', lat: 51.5074, lng: -0.1278, city: 'London' },
  { country: 'DE', timezone: 'Europe/Berlin', locale: 'de-DE', lat: 52.5200, lng: 13.4050, city: 'Berlin' },
  { country: 'FR', timezone: 'Europe/Paris', locale: 'fr-FR', lat: 48.8566, lng: 2.3522, city: 'Paris' },
  { country: 'JP', timezone: 'Asia/Tokyo', locale: 'ja-JP', lat: 35.6762, lng: 139.6503, city: 'Tokyo' },
  { country: 'KR', timezone: 'Asia/Seoul', locale: 'ko-KR', lat: 37.5665, lng: 126.9780, city: 'Seoul' },
  { country: 'SG', timezone: 'Asia/Singapore', locale: 'en-SG', lat: 1.3521, lng: 103.8198, city: 'Singapore' },
  { country: 'AU', timezone: 'Australia/Sydney', locale: 'en-AU', lat: -33.8688, lng: 151.2093, city: 'Sydney' },
  { country: 'IN', timezone: 'Asia/Kolkata', locale: 'hi-IN', lat: 28.6139, lng: 77.2090, city: 'Delhi' },
  { country: 'BR', timezone: 'America/Sao_Paulo', locale: 'pt-BR', lat: -23.5505, lng: -46.6333, city: 'Sao Paulo' },
  { country: 'RU', timezone: 'Europe/Moscow', locale: 'ru-RU', lat: 55.7558, lng: 37.6173, city: 'Moscow' },
  { country: 'MY', timezone: 'Asia/Kuala_Lumpur', locale: 'ms-MY', lat: 3.1390, lng: 101.6869, city: 'Kuala Lumpur' },
  { country: 'TH', timezone: 'Asia/Bangkok', locale: 'th-TH', lat: 13.7563, lng: 100.5018, city: 'Bangkok' },
  { country: 'PH', timezone: 'Asia/Manila', locale: 'fil-PH', lat: 14.5995, lng: 120.9842, city: 'Manila' },
  { country: 'VN', timezone: 'Asia/Ho_Chi_Minh', locale: 'vi-VN', lat: 10.8231, lng: 106.6297, city: 'Ho Chi Minh' },
  { country: 'CA', timezone: 'America/Toronto', locale: 'en-CA', lat: 43.6532, lng: -79.3832, city: 'Toronto' },
];

class TimezoneSpoofer {
  constructor() {
    this.timezoneData = TIMEZONE_DATA;
  }

  /**
   * Get timezone data for a country code
   */
  getByCountry(countryCode) {
    const matches = this.timezoneData.filter(t => t.country === countryCode.toUpperCase());
    if (matches.length === 0) return this.getRandom();
    return matches[Math.floor(Math.random() * matches.length)];
  }

  /**
   * Get random timezone data
   */
  getRandom() {
    return this.timezoneData[Math.floor(Math.random() * this.timezoneData.length)];
  }

  /**
   * Apply timezone spoofing to browser page
   */
  async applyToPage(page, tzData) {
    // Override timezone
    await page.emulateTimezone(tzData.timezone);

    // Override geolocation
    await page.setGeolocation({
      latitude: tzData.lat + (Math.random() * 0.02 - 0.01), // slight randomness
      longitude: tzData.lng + (Math.random() * 0.02 - 0.01),
      accuracy: Math.floor(Math.random() * 50) + 10,
    });

    // Grant geolocation permission
    const context = page.browser().defaultBrowserContext();
    await context.overridePermissions(page.url() || 'https://example.com', ['geolocation']);

    // Override navigator properties via CDP
    const client = await page.target().createCDPSession();
    await client.send('Emulation.setLocaleOverride', { locale: tzData.locale });

    console.log(`[TimezoneSpoofer] Applied: ${tzData.city} (${tzData.timezone}, ${tzData.locale})`);
    return tzData;
  }

  /**
   * Override Date object timezone in page context
   */
  async overrideDateTimezone(page, timezone) {
    await page.evaluateOnNewDocument((tz) => {
      const originalDate = Date;
      const originalToString = Date.prototype.toString;
      const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;

      // This injects timezone awareness into the page
      Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
        value: function () {
          return { ...Intl.DateTimeFormat.prototype.resolvedOptions.call(this), timeZone: tz };
        }
      });
    }, timezone);
  }

  /**
   * Get matching accept-language header
   */
  getAcceptLanguage(tzData) {
    const locale = tzData.locale;
    const lang = locale.split('-')[0];
    return `${locale},${lang};q=0.9,en-US;q=0.8,en;q=0.7`;
  }
}

module.exports = TimezoneSpoofer;
