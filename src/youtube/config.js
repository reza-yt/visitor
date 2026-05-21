'use strict';

/**
 * YouTube Auto Viewer Configuration
 * Kejar jam tayang dengan behavior realistis manusia
 */
module.exports = {
  // Video targets (YouTube URL or Video IDs)
  videos: [
    // 'https://www.youtube.com/watch?v=VIDEO_ID',
  ],

  // Channel URL (for browsing behavior)
  channelUrl: '',

  // Cookie files directory (exported dari browser)
  cookiesDir: './cookies',

  // Watch settings
  watch: {
    minWatchPercent: 60,        // Minimum watch 60% video
    maxWatchPercent: 95,        // Maximum watch 95% video
    minWatchDuration: 120,      // Minimum 2 menit nonton (seconds)
    maxWatchDuration: 1800,     // Maximum 30 menit (seconds)
    sessionsPerDay: 5,          // Sessions per account per day
    totalDailyHours: 4,         // Target jam tayang per hari (hours)
    quality: 'auto',            // 'auto', '360p', '480p', '720p', '1080p'
  },

  // Account settings
  accounts: {
    maxAccountsPerSession: 3,   // Max accounts used simultaneously
    rotateAccounts: true,       // Rotate between accounts
    cooldownMinutes: 30,        // Cooldown between same account usage
    ageMinDays: 7,              // Minimum account age (for trust)
  },

  // Retention settings (key for watch hours)
  retention: {
    targetRetention: 0.7,       // 70% average retention
    dropOffVariance: 0.15,      // ±15% variance in drop-off
    rewindChance: 0.2,          // 20% chance to rewind
    skipAheadChance: 0.05,      // 5% chance to skip ahead (rare)
    pauseChance: 0.3,           // 30% chance to pause during video
    pauseDuration: { min: 3, max: 30 }, // Pause 3-30 seconds
  },

  // Engagement settings
  engagement: {
    likeChance: 0.15,           // 15% chance to like
    commentChance: 0.03,        // 3% chance to comment
    subscribeChance: 0.05,      // 5% chance to subscribe
    volumeRange: { min: 30, max: 85 }, // Volume 30-85%
    fullscreenChance: 0.2,      // 20% chance fullscreen
    theaterModeChance: 0.3,     // 30% theater mode
  },

  // Behavior patterns (organic browsing)
  behavior: {
    browseHomeFirst: true,         // Browse home page before video
    browseRecommended: true,      // Click recommended videos
    maxRecommendedClicks: 3,      // Max recommended videos
    readComments: true,            // Scroll to comments
    readDescription: true,         // Expand description
    watchAdsNaturally: true,      // Don't skip ads immediately
    adSkipDelay: { min: 5, max: 15 }, // Delay before skip (seconds)
  },

  // Timing (realistic human patterns)
  timing: {
    sessionGap: { min: 900, max: 7200 },    // 15min-2hr between sessions
    betweenVideos: { min: 5000, max: 30000 }, // 5-30s between videos
    pageLoadWait: { min: 2000, max: 5000 },
    beforePlay: { min: 1000, max: 4000 },
    scrollDelay: { min: 500, max: 2000 },
  },

  // Browser & proxy settings
  browser: {
    headless: 'new',
    timeout: 90000,
    mobileRatio: 0.4,           // 40% mobile viewers
  },

  // Playlist support
  playlists: [
    // 'https://www.youtube.com/playlist?list=PLAYLIST_ID',
  ],
  playlistOptions: {
    enabled: true,
    shuffle: true,
    maxVideosPerSession: 8,
    minVideosPerSession: 2,
  },

  // Embed view settings
  embed: {
    enabled: true,
    ratio: 0.15, // 15% views from embed
  },

  // Multi-day scheduler
  multiDay: {
    enabled: false,
    dailyTargetHours: 4,
    maxDailyHours: 8,
    activeHours: { start: 7, end: 23 },
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },

  // Watch history bypass
  historyBypass: {
    maxRepeats: 3,        // Max times to watch same video per account per week
    cooldownHours: 24,    // Min hours between same video+account
  },

  // IP-Account binding
  ipBinding: {
    enabled: true,
    maxProxiesPerAccount: 2,
  },

  // Network filter
  network: {
    mode: 'natural', // 'natural' (allow all), 'stealth' (block 3rd party), 'minimal'
  },

  // Mute detection
  mute: {
    minVolume: 0.05,      // 5% minimum volume
    checkInterval: 30000, // Check every 30s
  },

  // Watch hours target
  dashboard: {
    targetHours: 4000,    // YouTube monetization requirement
  },

  // Proxy (reuse from main config or separate)
  proxies: [],

  // Logging
  logging: {
    verbose: true,
    saveStats: true,
    statsDir: './logs/youtube',
  },

  // Webhook
  webhook: {
    enabled: false,
    telegram: null,
    discord: null,
  },
};
