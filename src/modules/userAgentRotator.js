'use strict';

/**
 * User-Agent Rotator Module
 * Provides realistic mobile and desktop user agents with rotation
 */

const MOBILE_USER_AGENTS = [
  // iPhone
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.109 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
  // Android
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.134 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.134 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.134 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.80 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.134 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-A235F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  // iPad
  'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
];

const DESKTOP_USER_AGENTS = [
  // Chrome Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // Chrome Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  // Firefox
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
  // Safari
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  // Edge
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
  // Chrome Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
];

class UserAgentRotator {
  constructor(options = {}) {
    this.mobileAgents = [...MOBILE_USER_AGENTS];
    this.desktopAgents = [...DESKTOP_USER_AGENTS];
    this.allAgents = [...this.mobileAgents, ...this.desktopAgents];
    this.usedAgents = [];
    this.mobileRatio = options.mobileRatio || 0.6; // 60% mobile by default
  }

  /**
   * Get random user agent (respects mobile ratio)
   */
  getRandom() {
    const isMobile = Math.random() < this.mobileRatio;
    return isMobile ? this.getRandomMobile() : this.getRandomDesktop();
  }

  /**
   * Get random mobile user agent
   */
  getRandomMobile() {
    const agent = this.mobileAgents[Math.floor(Math.random() * this.mobileAgents.length)];
    this.usedAgents.push(agent);
    return { userAgent: agent, isMobile: true };
  }

  /**
   * Get random desktop user agent
   */
  getRandomDesktop() {
    const agent = this.desktopAgents[Math.floor(Math.random() * this.desktopAgents.length)];
    this.usedAgents.push(agent);
    return { userAgent: agent, isMobile: false };
  }

  /**
   * Get unique user agent (avoid repeats)
   */
  getUnique() {
    const available = this.allAgents.filter(a => !this.usedAgents.includes(a));
    if (available.length === 0) {
      this.usedAgents = [];
      return this.getRandom();
    }

    const agent = available[Math.floor(Math.random() * available.length)];
    const isMobile = this.mobileAgents.includes(agent);
    this.usedAgents.push(agent);
    return { userAgent: agent, isMobile };
  }

  /**
   * Detect if user agent is mobile
   */
  isMobileAgent(userAgent) {
    return /Mobile|Android|iPhone|iPad/i.test(userAgent);
  }

  /**
   * Get platform hint based on user agent (for Client Hints)
   */
  getPlatformHints(userAgent) {
    if (/Windows/.test(userAgent)) return { platform: 'Windows', platformVersion: '10.0.0' };
    if (/Macintosh/.test(userAgent)) return { platform: 'macOS', platformVersion: '10.15.7' };
    if (/Linux/.test(userAgent)) return { platform: 'Linux', platformVersion: '6.1.0' };
    if (/iPhone|iPad/.test(userAgent)) return { platform: 'iOS', platformVersion: '17.1.0' };
    if (/Android/.test(userAgent)) return { platform: 'Android', platformVersion: '14.0.0' };
    return { platform: 'Windows', platformVersion: '10.0.0' };
  }

  /**
   * Add custom user agents
   */
  addCustomAgents(agents, type = 'desktop') {
    if (type === 'mobile') {
      this.mobileAgents.push(...agents);
    } else {
      this.desktopAgents.push(...agents);
    }
    this.allAgents = [...this.mobileAgents, ...this.desktopAgents];
  }
}

module.exports = UserAgentRotator;
