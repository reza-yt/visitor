'use strict';

/**
 * Playlist Support Module
 * Watch videos from playlists for more natural viewing patterns
 * YouTube counts watch hours from playlist views as organic
 */

class PlaylistSupport {
  constructor(options = {}) {
    this.shufflePlaylist = options.shuffle !== false;
    this.maxVideosPerSession = options.maxVideosPerSession || 8;
    this.minVideosPerSession = options.minVideosPerSession || 2;
    this.skipChance = options.skipChance || 0.1; // 10% skip a video
  }

  /**
   * Navigate to a playlist and get video list
   */
  async loadPlaylist(page, playlistUrl) {
    console.log(`[Playlist] Loading: ${playlistUrl}`);
    await page.goto(playlistUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Scroll to load more videos
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy({ top: 500, behavior: 'smooth' }));
      await page.waitForTimeout(1500);
    }

    // Extract video list from playlist
    const videos = await page.evaluate(() => {
      const items = document.querySelectorAll('ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer');
      return Array.from(items).map((item, index) => {
        const link = item.querySelector('a#video-title, a.ytd-playlist-panel-video-renderer');
        const title = item.querySelector('#video-title');
        const duration = item.querySelector('span.ytd-thumbnail-overlay-time-status-renderer');
        return {
          url: link ? 'https://www.youtube.com' + link.getAttribute('href') : null,
          title: title ? title.textContent.trim() : `Video ${index + 1}`,
          duration: duration ? duration.textContent.trim() : '',
          index,
        };
      }).filter(v => v.url);
    });

    console.log(`[Playlist] Found ${videos.length} videos`);
    return videos;
  }

  /**
   * Get a watch plan from playlist (which videos to watch, in what order)
   */
  generatePlaylistPlan(videos) {
    let selected = [...videos];

    // Shuffle if enabled (but keep first video sometimes for natural feel)
    if (this.shufflePlaylist && Math.random() > 0.3) {
      const first = selected.shift();
      selected.sort(() => Math.random() - 0.5);
      if (Math.random() < 0.5) selected.unshift(first);
    }

    // Pick number of videos to watch
    const count = this._randomBetween(this.minVideosPerSession, 
      Math.min(this.maxVideosPerSession, selected.length));
    selected = selected.slice(0, count);

    // Mark some for skip (natural behavior - not everyone watches all)
    const plan = selected.map((video, i) => ({
      ...video,
      action: i === 0 || Math.random() > this.skipChance ? 'watch' : 'skip',
      watchPercent: this._getWatchPercent(i, count),
    }));

    console.log(`[Playlist] Plan: watch ${plan.filter(p => p.action === 'watch').length}/${plan.length} videos`);
    return plan;
  }

  /**
   * Click "Play All" or start playlist from beginning
   */
  async startPlaylist(page, playlistUrl) {
    await page.goto(playlistUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Try clicking "Play All" button
    const playAllBtn = await page.$('ytd-button-renderer a[href*="&list="], a.ytd-playlist-header-renderer');
    if (playAllBtn) {
      await playAllBtn.click();
      await page.waitForTimeout(5000);
      console.log('[Playlist] Started via Play All');
      return true;
    }

    // Fallback: click first video
    const firstVideo = await page.$('ytd-playlist-video-renderer a#video-title');
    if (firstVideo) {
      await firstVideo.click();
      await page.waitForTimeout(5000);
      console.log('[Playlist] Started via first video click');
      return true;
    }

    return false;
  }

  /**
   * Click next video in playlist panel
   */
  async nextInPlaylist(page) {
    try {
      // Check for next button in playlist panel
      const nextBtn = await page.$('.ytp-next-button, a.ytp-next-button');
      if (nextBtn) {
        await nextBtn.click();
        await page.waitForTimeout(3000);
        console.log('[Playlist] Clicked next video');
        return true;
      }

      // Alternative: click next in playlist sidebar
      const nextInPanel = await page.$('ytd-playlist-panel-video-renderer[selected] + ytd-playlist-panel-video-renderer a');
      if (nextInPanel) {
        await nextInPanel.click();
        await page.waitForTimeout(3000);
        return true;
      }
    } catch (e) {}
    return false;
  }

  /**
   * Check if autoplay/playlist is still active
   */
  async isPlaylistActive(page) {
    return page.evaluate(() => {
      const panel = document.querySelector('ytd-playlist-panel-renderer');
      return panel !== null;
    });
  }

  /**
   * Extract playlist ID from URL
   */
  extractPlaylistId(url) {
    const match = url.match(/[?&]list=([^&]+)/);
    return match ? match[1] : null;
  }

  /**
   * Generate playlist URL from ID
   */
  getPlaylistUrl(playlistId) {
    return `https://www.youtube.com/playlist?list=${playlistId}`;
  }

  _getWatchPercent(index, total) {
    // First videos get higher retention, drops off naturally
    const base = 0.75 - (index * 0.05);
    const variance = Math.random() * 0.2 - 0.1;
    return Math.max(0.3, Math.min(0.95, base + variance));
  }

  _randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

module.exports = PlaylistSupport;
