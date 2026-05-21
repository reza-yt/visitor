'use strict';

/**
 * Human Behavior Simulation Module
 * Simulates realistic human interactions: scroll, click, mouse movement, timing
 */

class HumanBehavior {
  constructor(page, options = {}) {
    this.page = page;
    this.options = {
      minDelay: options.minDelay || 1000,
      maxDelay: options.maxDelay || 5000,
      scrollDuration: options.scrollDuration || 30000, // 30 seconds random scroll
      readingSpeed: options.readingSpeed || 200, // words per minute
      ...options
    };
  }

  /**
   * Random delay between min and max (ms)
   */
  async randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await this.page.waitForTimeout(delay);
    return delay;
  }

  /**
   * Simulate slow/natural scrolling (30s random scroll)
   */
  async naturalScroll() {
    const duration = this.options.scrollDuration;
    const startTime = Date.now();
    const pageHeight = await this.page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await this.page.evaluate(() => window.innerHeight);

    let currentScroll = 0;
    const maxScroll = pageHeight - viewportHeight;

    console.log(`[HumanBehavior] Starting natural scroll (${duration / 1000}s, page height: ${pageHeight}px)`);

    while (Date.now() - startTime < duration && currentScroll < maxScroll) {
      // Random scroll distance (50-300px, like a human)
      const scrollAmount = Math.floor(Math.random() * 250) + 50;

      // Sometimes scroll up a bit (10% chance)
      const direction = Math.random() < 0.1 ? -1 : 1;
      const actualScroll = scrollAmount * direction;

      await this.page.evaluate((scroll) => {
        window.scrollBy({ top: scroll, behavior: 'smooth' });
      }, actualScroll);

      currentScroll += actualScroll;

      // Random pause between scrolls (simulates reading)
      const pause = Math.floor(Math.random() * 3000) + 500;
      await this.page.waitForTimeout(pause);

      // Occasionally pause longer (simulates reading a paragraph)
      if (Math.random() < 0.15) {
        const longPause = Math.floor(Math.random() * 5000) + 3000;
        await this.page.waitForTimeout(longPause);
      }
    }

    console.log(`[HumanBehavior] Scroll complete (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);
  }

  /**
   * Simulate mouse movement (natural bezier-like paths)
   */
  async randomMouseMove() {
    const viewportSize = await this.page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));

    const moves = Math.floor(Math.random() * 5) + 2;

    for (let i = 0; i < moves; i++) {
      const x = Math.floor(Math.random() * viewportSize.width * 0.8) + viewportSize.width * 0.1;
      const y = Math.floor(Math.random() * viewportSize.height * 0.8) + viewportSize.height * 0.1;

      // Move in steps for more natural movement
      const steps = Math.floor(Math.random() * 10) + 5;
      await this.page.mouse.move(x, y, { steps });

      await this.randomDelay(200, 800);
    }
  }

  /**
   * Click on random internal links (navigate to another article)
   */
  async clickRandomLink() {
    const links = await this.page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      const currentHost = window.location.hostname;

      return allLinks
        .filter(link => {
          const href = link.href;
          try {
            const url = new URL(href);
            return url.hostname === currentHost &&
              !href.includes('#') &&
              !href.includes('javascript:') &&
              !href.includes('mailto:') &&
              link.offsetParent !== null; // visible
          } catch {
            return false;
          }
        })
        .map(link => ({
          href: link.href,
          text: link.textContent.trim().substring(0, 50)
        }))
        .slice(0, 20);
    });

    if (links.length === 0) {
      console.log('[HumanBehavior] No internal links found');
      return null;
    }

    const randomLink = links[Math.floor(Math.random() * links.length)];
    console.log(`[HumanBehavior] Clicking link: "${randomLink.text}" -> ${randomLink.href}`);

    try {
      await this.page.goto(randomLink.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.randomDelay(2000, 5000);
      return randomLink.href;
    } catch (err) {
      console.log(`[HumanBehavior] Failed to navigate: ${err.message}`);
      return null;
    }
  }

  /**
   * Simulate reading behavior (time based on content length)
   */
  async simulateReading() {
    const wordCount = await this.page.evaluate(() => {
      const text = document.body.innerText || '';
      return text.split(/\s+/).length;
    });

    // Calculate reading time (realistic: 200-300 WPM but we only "read" a portion)
    const readingPortion = Math.random() * 0.4 + 0.2; // Read 20-60% of content
    const wordsToRead = Math.floor(wordCount * readingPortion);
    const readingTimeMs = (wordsToRead / this.options.readingSpeed) * 60 * 1000;

    // Cap at reasonable time (5-60 seconds)
    const cappedTime = Math.min(Math.max(readingTimeMs, 5000), 60000);

    console.log(`[HumanBehavior] Simulating reading (${(cappedTime / 1000).toFixed(1)}s for ~${wordsToRead} words)`);
    await this.page.waitForTimeout(cappedTime);
  }

  /**
   * Full human-like visit session
   */
  async simulateVisit() {
    // Initial page load wait
    await this.randomDelay(2000, 4000);

    // Random mouse movements
    await this.randomMouseMove();

    // Natural scroll through page
    await this.naturalScroll();

    // Simulate reading
    await this.simulateReading();

    // Random mouse movements again
    await this.randomMouseMove();

    // Maybe click another article (50% chance)
    if (Math.random() < 0.5) {
      const newPage = await this.clickRandomLink();
      if (newPage) {
        await this.randomDelay(2000, 4000);
        await this.naturalScroll();
        await this.randomMouseMove();
      }
    }

    // Final delay before leaving
    await this.randomDelay(1000, 3000);
  }

  /**
   * Simulate tab switching behavior
   */
  async simulateTabBehavior() {
    // Simulate losing focus (user switches tab)
    if (Math.random() < 0.3) {
      console.log('[HumanBehavior] Simulating tab switch (blur/focus)');
      await this.page.evaluate(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await this.randomDelay(5000, 15000);
      await this.page.evaluate(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }
  }
}

module.exports = HumanBehavior;
