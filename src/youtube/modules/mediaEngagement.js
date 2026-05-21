'use strict';

/**
 * Audio/Video Engagement Module
 * Simulates realistic media engagement: volume, fullscreen, interactions
 * Makes it look like a real human is actively watching
 */

class MediaEngagement {
  constructor(options = {}) {
    this.volumeRange = options.volumeRange || { min: 30, max: 85 };
    this.fullscreenChance = options.fullscreenChance || 0.2;
    this.theaterModeChance = options.theaterModeChance || 0.3;
    this.likeChance = options.likeChance || 0.15;
    this.commentChance = options.commentChance || 0.03;
    this.subscribeChance = options.subscribeChance || 0.05;
  }

  /**
   * Set random volume (realistic range)
   */
  async setRandomVolume(page) {
    const volume = this._randomBetween(this.volumeRange.min, this.volumeRange.max);
    await page.evaluate((vol) => {
      const video = document.querySelector('video');
      if (video) video.volume = vol / 100;
    }, volume);
    console.log(`[MediaEngagement] Volume set: ${volume}%`);
    return volume;
  }

  /**
   * Toggle fullscreen (20% of viewers do this)
   */
  async maybeFullscreen(page) {
    if (Math.random() < this.fullscreenChance) {
      try {
        const fsButton = await page.$('.ytp-fullscreen-button');
        if (fsButton) {
          await fsButton.click();
          console.log('[MediaEngagement] Entered fullscreen');
          await page.waitForTimeout(this._randomBetween(2000, 5000));
          return true;
        }
      } catch (e) {}
    }
    return false;
  }

  /**
   * Toggle theater mode
   */
  async maybeTheaterMode(page) {
    if (Math.random() < this.theaterModeChance) {
      try {
        const theaterBtn = await page.$('.ytp-size-button');
        if (theaterBtn) {
          await theaterBtn.click();
          console.log('[MediaEngagement] Theater mode toggled');
          await page.waitForTimeout(1000);
          return true;
        }
      } catch (e) {}
    }
    return false;
  }

  /**
   * Like the video (15% chance)
   */
  async maybeLike(page) {
    if (Math.random() > this.likeChance) return false;

    try {
      // Wait a bit before liking (natural behavior)
      await page.waitForTimeout(this._randomBetween(10000, 60000));

      const likeBtn = await page.$('like-button-view-model button');
      if (!likeBtn) {
        // Fallback selectors
        const altBtn = await page.$('#segmented-like-button button, ytd-toggle-button-renderer#button[aria-label*="like"]');
        if (altBtn) {
          await altBtn.click();
          console.log('[MediaEngagement] Liked video');
          return true;
        }
      } else {
        // Check if already liked
        const isLiked = await page.evaluate((btn) => btn.getAttribute('aria-pressed') === 'true', likeBtn);
        if (!isLiked) {
          await likeBtn.click();
          console.log('[MediaEngagement] Liked video');
          return true;
        }
      }
    } catch (e) {
      console.log(`[MediaEngagement] Like failed: ${e.message}`);
    }
    return false;
  }

  /**
   * Subscribe to channel (5% chance)
   */
  async maybeSubscribe(page) {
    if (Math.random() > this.subscribeChance) return false;

    try {
      await page.waitForTimeout(this._randomBetween(30000, 120000));

      const subBtn = await page.$('ytd-subscribe-button-renderer button');
      if (subBtn) {
        const isSubscribed = await page.evaluate((btn) => {
          return btn.getAttribute('subscribed') !== null ||
            btn.textContent.toLowerCase().includes('subscribed');
        }, subBtn);

        if (!isSubscribed) {
          await subBtn.click();
          console.log('[MediaEngagement] Subscribed to channel');
          await page.waitForTimeout(2000);
          return true;
        }
      }
    } catch (e) {
      console.log(`[MediaEngagement] Subscribe failed: ${e.message}`);
    }
    return false;
  }

  /**
   * Read and interact with comments section
   */
  async browseComments(page) {
    try {
      // Scroll down to comments
      await page.evaluate(() => {
        const comments = document.querySelector('ytd-comments#comments');
        if (comments) comments.scrollIntoView({ behavior: 'smooth' });
      });
      await page.waitForTimeout(this._randomBetween(3000, 8000));

      // Scroll through some comments
      for (let i = 0; i < this._randomBetween(2, 6); i++) {
        await page.evaluate(() => window.scrollBy({ top: 200, behavior: 'smooth' }));
        await page.waitForTimeout(this._randomBetween(2000, 5000));
      }

      // Maybe like a comment (rare)
      if (Math.random() < 0.1) {
        const commentLikeBtn = await page.$('ytd-comment-renderer #like-button button');
        if (commentLikeBtn) {
          await commentLikeBtn.click();
          console.log('[MediaEngagement] Liked a comment');
        }
      }

      console.log('[MediaEngagement] Browsed comments section');
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Expand video description
   */
  async readDescription(page) {
    try {
      const expandBtn = await page.$('tp-yt-paper-button#expand, #expand');
      if (expandBtn) {
        await expandBtn.click();
        await page.waitForTimeout(this._randomBetween(3000, 8000));
        console.log('[MediaEngagement] Read description');
        return true;
      }
    } catch (e) {}
    return false;
  }

  /**
   * Handle ads naturally (don't skip immediately)
   */
  async handleAd(page, adSkipDelay = { min: 5, max: 15 }) {
    try {
      // Check if ad is playing
      const hasAd = await page.evaluate(() => {
        return document.querySelector('.ytp-ad-player-overlay') !== null ||
          document.querySelector('.ad-showing') !== null ||
          document.querySelector('.ytp-ad-skip-button-container') !== null;
      });

      if (!hasAd) return false;

      console.log('[MediaEngagement] Ad detected, watching naturally...');

      // Wait before trying to skip (humans don't skip instantly)
      const waitTime = this._randomBetween(adSkipDelay.min, adSkipDelay.max) * 1000;
      await page.waitForTimeout(waitTime);

      // Try to skip
      const skipBtn = await page.$('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
      if (skipBtn) {
        // Additional small delay to seem human
        await page.waitForTimeout(this._randomBetween(500, 2000));
        await skipBtn.click();
        console.log('[MediaEngagement] Skipped ad after waiting');
      } else {
        // No skip button, watch the full ad
        console.log('[MediaEngagement] Watching full ad (no skip available)');
        await page.waitForTimeout(this._randomBetween(15000, 30000));
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Hover over player controls (shows engagement)
   */
  async hoverPlayerControls(page) {
    try {
      // Move mouse to video player area
      const player = await page.$('#movie_player');
      if (player) {
        const box = await player.boundingBox();
        if (box) {
          // Hover near bottom (controls area)
          const x = box.x + box.width * (Math.random() * 0.6 + 0.2);
          const y = box.y + box.height * 0.85;
          await page.mouse.move(x, y, { steps: 10 });
          await page.waitForTimeout(this._randomBetween(1000, 3000));
          // Move away
          await page.mouse.move(x, box.y + box.height * 0.3, { steps: 5 });
        }
      }
    } catch (e) {}
  }

  /**
   * Simulate mini-player or picture-in-picture behavior
   */
  async simulateMiniPlayer(page) {
    if (Math.random() < 0.05) { // 5% chance
      try {
        await page.evaluate(() => {
          const video = document.querySelector('video');
          if (video && video.requestPictureInPicture) {
            // Don't actually enter PiP, just simulate the intent
          }
        });
      } catch (e) {}
    }
  }

  _randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

module.exports = MediaEngagement;
