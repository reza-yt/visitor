'use strict';

/**
 * Warm-up Phase Module
 * Gradually increases traffic volume to avoid sudden spikes
 */

class WarmupPhase {
  constructor(options = {}) {
    this.phases = options.phases || [
      { visits: 2, delay: 30000, label: 'Phase 1: Warming up (2 visits)' },
      { visits: 5, delay: 20000, label: 'Phase 2: Light traffic (5 visits)' },
      { visits: 10, delay: 15000, label: 'Phase 3: Normal traffic (10 visits)' },
      { visits: 20, delay: 10000, label: 'Phase 4: Ramping up (20 visits)' },
      { visits: -1, delay: 8000, label: 'Phase 5: Full speed (max visits)' }, // -1 = unlimited
    ];
    this.currentPhase = 0;
    this.phaseVisitsDone = 0;
    this.totalVisitsDone = 0;
    this.startTime = null;
    this.warmupDuration = options.warmupDuration || 300000; // 5 minutes default
  }

  /**
   * Start warm-up tracking
   */
  start() {
    this.startTime = Date.now();
    this.currentPhase = 0;
    this.phaseVisitsDone = 0;
    this.totalVisitsDone = 0;
    console.log(`[WarmUp] Starting warm-up phase (${this.phases.length} phases)`);
    console.log(`[WarmUp] ${this.getCurrentPhase().label}`);
  }

  /**
   * Get current phase config
   */
  getCurrentPhase() {
    return this.phases[Math.min(this.currentPhase, this.phases.length - 1)];
  }

  /**
   * Report a visit completed, advance phase if needed
   */
  recordVisit() {
    this.phaseVisitsDone++;
    this.totalVisitsDone++;

    const phase = this.getCurrentPhase();
    if (phase.visits !== -1 && this.phaseVisitsDone >= phase.visits) {
      this._advancePhase();
    }
  }

  /**
   * Get current allowed concurrent visits
   */
  getConcurrentLimit() {
    const phase = this.getCurrentPhase();
    if (phase.visits === -1) return Infinity;
    return Math.max(1, Math.ceil(phase.visits / 5));
  }

  /**
   * Get current delay between visits
   */
  getDelay() {
    const phase = this.getCurrentPhase();
    // Add randomness (±30%)
    const jitter = phase.delay * (Math.random() * 0.6 - 0.3);
    return Math.max(2000, phase.delay + jitter);
  }

  /**
   * Check if warm-up is complete
   */
  isWarmupComplete() {
    return this.currentPhase >= this.phases.length - 1;
  }

  /**
   * Get warmup progress (0.0 - 1.0)
   */
  getProgress() {
    if (this.isWarmupComplete()) return 1.0;
    return this.currentPhase / (this.phases.length - 1);
  }

  /**
   * Get status string
   */
  getStatus() {
    const phase = this.getCurrentPhase();
    return {
      phase: this.currentPhase + 1,
      totalPhases: this.phases.length,
      label: phase.label,
      visitsInPhase: this.phaseVisitsDone,
      totalVisits: this.totalVisitsDone,
      warmupComplete: this.isWarmupComplete(),
      currentDelay: phase.delay,
      elapsed: this.startTime ? ((Date.now() - this.startTime) / 1000).toFixed(0) + 's' : '0s',
    };
  }

  _advancePhase() {
    if (this.currentPhase < this.phases.length - 1) {
      this.currentPhase++;
      this.phaseVisitsDone = 0;
      const phase = this.getCurrentPhase();
      console.log(`[WarmUp] Advanced to ${phase.label}`);
    }
  }
}

module.exports = WarmupPhase;
