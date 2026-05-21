# Auto Visitor v2.0 - Full Feature Bot

Tool auto visitor website dengan 16+ fitur termasuk human behavior, organic behavior, proxy rotator, fingerprint randomization, dan anti-detection lengkap.

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | Cookie & Session Management | Auto-accept cookie popup, save/load session, inject GA/FB cookies |
| 2 | Timezone & Geolocation Spoofing | 20+ timezone profiles, match proxy location |
| 3 | Canvas/WebGL Fingerprint | Randomize canvas noise, WebGL vendor/renderer, audio context |
| 4 | Error Recovery & Retry | Exponential backoff, error categorization, smart retry |
| 5 | Scheduler / Cron | Schedule visits by hour, interval, or cron pattern |
| 6 | Traffic Pattern Simulation | Peak hours, day-of-week weights, realistic distribution |
| 7 | DNS over HTTPS (DoH) | Cloudflare/Google DoH, prevent DNS leaks |
| 8 | Stats Dashboard & Logging | JSON/CSV logs, real-time dashboard, visit tracking |
| 9 | Multi-Browser Engine | Puppeteer (Chromium) + Playwright (Firefox, WebKit) |
| 10 | CAPTCHA Detection & Skip | Detect Cloudflare, reCAPTCHA, hCaptcha, auto-skip |
| 11 | Bandwidth Throttling | Simulate 2G/3G/4G/WiFi speeds per device type |
| 12 | Warm-up Phase | Gradual traffic ramp-up (5 phases) |
| 13 | Proxy Health Checker | Test latency, filter dead proxies, score ranking |
| 14 | .env & CLI Config | Environment variables + CLI arguments |
| 15 | Docker Support | Dockerfile + docker-compose, resource limits |
| 16 | Webhook Notifications | Telegram & Discord alerts (complete/error/captcha) |

## Quick Start

```bash
# Clone & install
cd visitor
npm install

# Copy env file
cp .env.example .env
# Edit .env with your settings

# Run
npm start
```

## Configuration

### Via .env file (recommended)

```bash
cp .env.example .env
nano .env
```

Key settings:
```env
TARGET_URLS=https://your-site.com,https://your-site.com/blog
PROXIES=http://user:pass@proxy1.com:8080,socks5://user:pass@proxy2.com:1080
TOTAL_VISITS=100
CONCURRENT_VISITS=3
MOBILE_RATIO=0.6
WARMUP_ENABLED=true
TRAFFIC_PATTERN_ENABLED=true
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### Via CLI arguments

```bash
node src/index.js --total-visits=100 --concurrent-visits=3 --mobile-ratio=0.7
node src/index.js --scheduled  # Run in scheduler mode
```

## Commands

```bash
npm start            # Run visitor
npm run dev          # Run with verbose logging
npm run scheduled    # Run with scheduler (auto repeat)
npm run health-check # Test all proxies

# Docker
npm run docker:build  # Build image
npm run docker:up     # Start container
npm run docker:down   # Stop container
npm run docker:logs   # View logs
```

## Docker

```bash
# Build & run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## How It Works

```
1. Load config (.env → CLI → defaults)
2. Health check all proxies
3. Start warm-up phase (gradual ramp-up)
4. For each visit:
   a. Pick random proxy (unique IP)
   b. Pick random user-agent (mobile/desktop)
   c. Pick random viewport (30+ devices)
   d. Pick random referer (Google/Facebook/direct)
   e. Pick matching timezone & geolocation
   f. Apply fingerprint randomization (canvas/WebGL/audio)
   g. Apply bandwidth throttling (3G/4G/WiFi)
   h. Resolve DNS via DoH
   i. Launch stealth browser
   j. Inject cookies, set headers
   k. Navigate to target
   l. Detect & handle CAPTCHA
   m. Accept cookie consent popup
   n. Simulate human behavior:
      - Natural scroll (30s)
      - Random mouse movements
      - Simulate reading
      - Click internal articles
      - Tab switch simulation
   o. Log stats & close
5. Apply traffic pattern delays
6. Save stats (JSON/CSV)
7. Send webhook notification
```

## Project Structure

```
visitor/
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
└── src/
    ├── index.js                    # Main orchestrator (v2)
    ├── config.js                   # Default config
    ├── envConfig.js                # .env & CLI parser
    ├── tools/
    │   └── proxyCheck.js           # Standalone proxy tester
    └── modules/
        ├── proxyRotator.js         # Proxy rotation & management
        ├── userAgentRotator.js     # UA rotation (20+ agents)
        ├── viewportRandomizer.js   # Random viewport (30+ devices)
        ├── refererRandomizer.js    # Random referer headers
        ├── humanBehavior.js        # Human behavior simulation
        ├── cookieManager.js        # Cookie & session management
        ├── timezoneSpoofer.js      # Timezone & geo spoofing
        ├── fingerprintRandomizer.js# Canvas/WebGL/Audio fingerprint
        ├── retryHandler.js         # Error recovery & retry
        ├── scheduler.js            # Cron/interval scheduler
        ├── trafficPattern.js       # Traffic pattern simulation
        ├── dnsOverHttps.js         # DNS over HTTPS
        ├── statsLogger.js          # Stats & file logging
        ├── browserEngine.js        # Multi-browser engine
        ├── captchaDetector.js      # CAPTCHA detection & skip
        ├── bandwidthThrottle.js    # Bandwidth throttling
        ├── warmupPhase.js          # Warm-up phase
        ├── proxyHealthChecker.js   # Proxy health testing
        └── webhookNotifier.js      # Telegram/Discord webhook
```

## Webhook Setup

### Telegram
1. Create bot via @BotFather
2. Get chat ID via @userinfobot
3. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in .env

### Discord
1. Server Settings → Integrations → Webhooks → New
2. Copy webhook URL
3. Set `DISCORD_WEBHOOK_URL` in .env

## Notes

- Gunakan Node.js 18+ 
- Proxy berkualitas = hasil lebih baik
- Concurrent 2-5 recommended (sesuai RAM)
- Warm-up phase mencegah sudden spike
- Traffic pattern membuat pola visit lebih natural
- Tool ini untuk educational purposes only
