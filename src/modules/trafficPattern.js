'use strict';

/**
 * Traffic Pattern Simulation Module
 * Simulates realistic traffic patterns with peak hours, gradual ramp-up, etc.
 */

class TrafficPattern {
  constructor(options = {}) {
    this.timezone = options.timezone || 'Asia/Jakarta';
    // Default traffic distribution (Indonesian audience)
    this.hourlyWeights = options.hourlyWeights || {
      0: 0.1, 1: 0.05, 2: 0.03, 3: 0.02, 4: 0.02, 5: 0.05,
      6: 0.15, 7: 0.3, 8: 0.5, 9: 0.7, 10: 0.8, 11: 0.9,
      12: 1.0, 13: 0.85, 14: 0.7, 15: 0.6, 16: 0.5, 17: 0.6,
      18: 0.75, 19: 0.9, 20: 1.0, 21: 0.85, 22: 0.5, 23: 0.25,
    };
    // Day of week weights (0=Sunday)
    this.dailyWeights = options.dailyWeights || {
      0: 0.7, 1: 0.9, 2: 1.0, 3: 1.0, 4: 0.95, 5: 0.85, 6: 0.75,
    };
  }

  /**
   * Get current traffic multiplier (0.0 - 1.0)
   */
  getCurrentMultiplier() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    const hourWeight = this.hourlyWeights[hour] || 0.5;
    const dayWeight = this.dailyWeights[day] || 0.8;

    // Add slight randomness (±10%)
    const noise = 1 + (Math.random() * 0.2 - 0.1);

    return Math.min(1.0, hourWeight * dayWeight * noise);
  }

  /**
   * Calculate how many visits to run based on current traffic pattern
   * @param {number} baseVisits - Base number of visits per batch
   */
  getVisitCount(baseVisits) {
    const multiplier = this.getCurrentMultiplier();
    const visits = Math.max(1, Math.round(baseVisits * multiplier));
    return visits;
  }

  /**
   * Calculate delay between visits based on traffic pattern
   * More traffic = shorter delays
   */
  getDelay(baseMinDelay, baseMaxDelay) {
    const multiplier = this.getCurrentMultiplier();
    // Invert: high traffic = shorter delay
    const factor = 1 + (1 - multiplier);
    const min = Math.round(baseMinDelay * factor);
    const max = Math.round(baseMaxDelay * factor);
    return { min, max };
  }

  /**
   * Should we run visits now? (based on traffic weight)
   * Returns false during very low traffic hours to look natural
   */
  shouldRunNow() {
    const multiplier = this.getCurrentMultiplier();
    // Skip if traffic is very low and random chance
    if (multiplier < 0.1) return Math.random() < 0.3;
    return true;
  }

  /**
   * Get estimated next peak time
   */
  getNextPeakHour() {
    const now = new Date();
    const currentHour = now.getHours();
    let maxWeight = 0;
    let peakHour = currentHour;

    for (let h = currentHour + 1; h < currentHour + 24; h++) {
      const hour = h % 24;
      if (this.hourlyWeights[hour] > maxWeight) {
        maxWeight = this.hourlyWeights[hour];
        peakHour = hour;
      }
    }
    return peakHour;
  }

  /**
   * Generate a full day visit schedule
   * @param {number} totalDailyVisits - Total visits for the day
   */
  generateDaySchedule(totalDailyVisits) {
    const schedule = [];
    let totalWeight = 0;

    // Calculate total weight for distribution
    for (let h = 0; h < 24; h++) {
      totalWeight += this.hourlyWeights[h] || 0.5;
    }

    // Distribute visits across hours
    for (let h = 0; h < 24; h++) {
      const weight = this.hourlyWeights[h] || 0.5;
      const hourVisits = Math.round((weight / totalWeight) * totalDailyVisits);
      if (hourVisits > 0) {
        schedule.push({
          hour: h,
          visits: hourVisits,
          weight,
        });
      }
    }

    return schedule;
  }

  /**
   * Get traffic status label
   */
  getTrafficStatus() {
    const m = this.getCurrentMultiplier();
    if (m >= 0.8) return 'PEAK';
    if (m >= 0.5) return 'HIGH';
    if (m >= 0.2) return 'MEDIUM';
    return 'LOW';
  }
}

module.exports = TrafficPattern;
