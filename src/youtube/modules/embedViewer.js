'use strict';

/**
 * Embed View Module
 * Simulates watching YouTube videos embedded on external websites
 * Mix of direct + embed views looks more organic
 */

class EmbedViewer {
  constructor(options = {}) {
    this.embedRatio = options.embedRatio || 0.15; // 15% of views from embed
    this.referrerSites = options.referrerSites || [
      'https://www.reddit.com/', 'https://medium.com/',
      'https://www.wordpress.com/', 'https://www.blogger.com/',
      'https://www.facebook.com/', 'https://t.co/',
    ];
  }

  /**
   * Should this view be an embed view?
   */
  shouldUseEmbed() {
    return Math.random() < this.embedRatio;
  }

  /**
   * Create a local HTML page with embedded YouTube video
   */
  getEmbedHtml(videoId, options = {}) {
    const autoplay = options.autoplay !== false ? 1 : 0;
    const startTime = options.startTime || 0;
    const width = options.width || 854;
    const height = options.height || 480;

    return `<!DOCTYPE html>
<html>
<head><title>Video - Article Page</title>
<style>
body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
h1 { font-size: 24px; color: #333; }
.video-container { position: relative; padding-bottom: 56.25%; height: 0; margin: 20px 0; }
.video-container iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
p { color: #666; line-height: 1.6; }
</style></head>
<body>
<h1>Check out this video</h1>
<p>Here's an interesting video I found:</p>
<div class="video-container">
<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=${autoplay}&start=${startTime}&rel=0&modestbranding=1"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen></iframe>
</div>
<p>What do you think about this content? Leave your thoughts below.</p>
</body></html>`;
  }

  /**
   * Watch video via embed (create temp HTML page)
   */
  async watchViaEmbed(page, videoId, duration) {
    const html = this.getEmbedHtml(videoId, { autoplay: true });

    // Set a random referrer
    const referer = this.referrerSites[Math.floor(Math.random() * this.referrerSites.length)];
    await page.setExtraHTTPHeaders({ 'Referer': referer });

    // Load the embed page
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    console.log(`[EmbedViewer] Watching via embed (referrer: ${referer})`);

    // Wait for iframe to load
    const iframe = await page.$('iframe');
    if (iframe) {
      const frame = await iframe.contentFrame();
      if (frame) {
        // Wait for video to play
        await page.waitForTimeout(duration * 1000);
        return true;
      }
    }

    // Fallback: just wait the duration
    await page.waitForTimeout(duration * 1000);
    return true;
  }

  /**
   * Get embed URL for a video
   */
  getEmbedUrl(videoId, params = {}) {
    const base = `https://www.youtube.com/embed/${videoId}`;
    const queryParams = new URLSearchParams({
      autoplay: '1',
      rel: '0',
      modestbranding: '1',
      ...params,
    });
    return `${base}?${queryParams.toString()}`;
  }
}

module.exports = EmbedViewer;
