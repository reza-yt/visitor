'use strict';

/**
 * Referer Randomizer Module
 * Generates realistic referer headers from search engines and social media
 */

const SEARCH_ENGINE_REFERERS = [
  'https://www.google.com/',
  'https://www.google.com/search?q=',
  'https://www.google.co.id/search?q=',
  'https://www.google.co.uk/search?q=',
  'https://www.bing.com/search?q=',
  'https://search.yahoo.com/search?p=',
  'https://duckduckgo.com/?q=',
  'https://yandex.com/search/?text=',
];

const SOCIAL_MEDIA_REFERERS = [
  'https://www.facebook.com/',
  'https://l.facebook.com/l.php?u=',
  'https://t.co/',
  'https://twitter.com/',
  'https://www.instagram.com/',
  'https://www.linkedin.com/feed/',
  'https://www.reddit.com/',
  'https://www.pinterest.com/',
  'https://www.tiktok.com/',
  'https://t.me/',
];

const DIRECT_REFERERS = [
  '', // Direct visit (no referer)
  '', // Direct visit
];

const NEWS_REFERERS = [
  'https://news.google.com/',
  'https://www.flipboard.com/',
  'https://feedly.com/',
  'https://getpocket.com/',
];

class RefererRandomizer {
  constructor(options = {}) {
    this.targetUrl = options.targetUrl || '';
    this.weights = options.weights || {
      search: 0.45,    // 45% from search engines
      social: 0.25,    // 25% from social media
      direct: 0.20,    // 20% direct
      news: 0.10       // 10% from news aggregators
    };
  }

  /**
   * Get weighted random referer
   */
  getRandom() {
    const rand = Math.random();
    let cumulative = 0;

    cumulative += this.weights.search;
    if (rand < cumulative) return this._getSearchReferer();

    cumulative += this.weights.social;
    if (rand < cumulative) return this._getSocialReferer();

    cumulative += this.weights.news;
    if (rand < cumulative) return this._getNewsReferer();

    return this._getDirectReferer();
  }

  _getSearchReferer() {
    const base = SEARCH_ENGINE_REFERERS[Math.floor(Math.random() * SEARCH_ENGINE_REFERERS.length)];
    if (base.includes('?')) {
      const keywords = this._generateSearchKeywords();
      return base + encodeURIComponent(keywords);
    }
    return base;
  }

  _getSocialReferer() {
    return SOCIAL_MEDIA_REFERERS[Math.floor(Math.random() * SOCIAL_MEDIA_REFERERS.length)];
  }

  _getDirectReferer() {
    return DIRECT_REFERERS[Math.floor(Math.random() * DIRECT_REFERERS.length)];
  }

  _getNewsReferer() {
    return NEWS_REFERERS[Math.floor(Math.random() * NEWS_REFERERS.length)];
  }

  _generateSearchKeywords() {
    const keywords = [
      'tips terbaru', 'cara mudah', 'tutorial lengkap',
      'berita hari ini', 'review terbaik', 'panduan pemula',
      'how to', 'best tips', 'latest news', 'guide 2024',
      'rekomendasi', 'info terkini', 'artikel menarik',
    ];
    const count = Math.floor(Math.random() * 3) + 1;
    const selected = [];
    for (let i = 0; i < count; i++) {
      selected.push(keywords[Math.floor(Math.random() * keywords.length)]);
    }
    return selected.join(' ');
  }

  /**
   * Set custom search keywords related to target site
   */
  setKeywords(keywords) {
    this.customKeywords = keywords;
  }
}

module.exports = RefererRandomizer;
