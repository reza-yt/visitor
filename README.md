# Auto Visitor - Human Behavior Bot

Tool auto visitor website dengan fitur human behavior, organic behavior, dan proxy rotator.

## Features

- **Human Behavior Simulation** - Scroll pelan, random delay, simulasi baca
- **Organic Behavior** - Buka artikel lain, mouse movement natural
- **Proxy Rotator** - Rotate proxy/IP untuk unique IP per visit
- **Random Viewport** - Ukuran layar acak (mobile & desktop)
- **Random Referer** - Referer dari Google, Facebook, Twitter, dll
- **Mobile Emulation** - Mobile user-agent + touch simulation
- **Rotate User-Agent** - UA berbeda setiap kunjungan
- **Random Scroll 30s** - Scroll natural selama 30 detik
- **Realistic Timing** - Delay realistis seperti manusia
- **Anti-Detection** - Puppeteer stealth plugin

## Installation

```bash
cd visitor
npm install
```

## Configuration

Edit file `src/config.js`:

```javascript
module.exports = {
  // Target URLs
  targets: [
    'https://your-website.com',
    'https://your-website.com/article-1',
    'https://your-website.com/article-2',
  ],

  // Proxy list
  proxies: [
    'http://user:pass@proxy1.com:8080',
    'socks5://user:pass@proxy2.com:1080',
    '103.xxx.xxx.xxx:8080',
  ],

  // Visit settings
  visits: {
    totalVisits: 50,
    concurrentVisits: 2,
    delayBetweenVisits: { min: 5000, max: 15000 },
  },

  // Behavior
  behavior: {
    scrollDuration: 30000,  // 30s scroll
    clickInternalLinks: true,
    maxInternalClicks: 3,
  },

  // Mobile ratio (0.6 = 60% mobile)
  mobile: { ratio: 0.6 },
};
```

## Usage

```bash
# Run visitor
npm start

# Run with verbose logging
npm run dev
```

## Proxy Format

Support format proxy:
- `http://user:pass@host:port`
- `socks5://user:pass@host:port`
- `host:port`
- `user:pass@host:port`

## How It Works

1. Bot mengambil random proxy, user-agent, viewport, dan referer
2. Buka browser dengan stealth mode (anti-detection)
3. Navigate ke target URL dengan referer realistis
4. Simulasi scroll pelan (~30 detik)
5. Random mouse movement
6. Klik artikel internal (opsional)
7. Tunggu random delay sebelum visit berikutnya
8. Rotate semua parameter untuk visit selanjutnya

## Module Structure

```
src/
├── index.js                  # Main orchestrator
├── config.js                 # Configuration
└── modules/
    ├── proxyRotator.js       # Proxy management & rotation
    ├── userAgentRotator.js   # UA rotation (mobile/desktop)
    ├── viewportRandomizer.js # Random viewport sizes
    ├── refererRandomizer.js  # Random referer headers
    └── humanBehavior.js      # Human behavior simulation
```

## Important Notes

- Gunakan proxy berkualitas untuk hasil terbaik
- Jangan set concurrent terlalu tinggi (2-5 recommended)
- Pastikan proxy support HTTPS
- Tool ini untuk educational purposes only
