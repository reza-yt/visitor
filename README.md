# Auto Visitor v2.0 + YouTube Watch Hours Bot

Tool lengkap auto visitor website + YouTube auto viewer untuk kejar jam tayang.

---

## 2 Mode:

| Mode | Command | Fungsi |
|------|---------|--------|
| **Website Visitor** | `npm start` | Auto visit website dengan human behavior |
| **YouTube Viewer** | `npm run youtube` | Auto nonton YouTube untuk kejar jam tayang |

---

# YOUTUBE AUTO VIEWER (Kejar Jam Tayang)

## Cara Setup YouTube Viewer

### Step 1: Export Cookies dari Browser

1. Login ke YouTube/Google pakai akun yang mau dipake nonton
2. Install extension **"EditThisCookie"** atau **"Get cookies.txt"** (Chrome/Firefox)
3. Export cookies sebagai **JSON** atau **Netscape (.txt)** format
4. Simpan file ke folder `./cookies/`:

```
cookies/
├── akun1.json          ← nama file = nama akun
├── akun2.json
├── akun3.txt           ← format Netscape juga support
└── akun_cadangan.json
```

### Step 2: Set Video Target

Edit `src/youtube/config.js`:

```javascript
module.exports = {
  videos: [
    'https://www.youtube.com/watch?v=VIDEO_ID_1',
    'https://www.youtube.com/watch?v=VIDEO_ID_2',
    'https://www.youtube.com/watch?v=VIDEO_ID_3',
  ],

  watch: {
    minWatchPercent: 60,      // Minimum nonton 60%
    maxWatchPercent: 95,      // Maximum nonton 95%
    sessionsPerDay: 5,        // 5 session per hari
    totalDailyHours: 4,       // Target 4 jam per hari
  },

  accounts: {
    cooldownMinutes: 30,      // Cooldown 30 menit antar akun sama
  },

  proxies: [
    'socks5://user:pass@proxy1.com:1080',
    'http://user:pass@proxy2.com:8080',
  ],
};
```

### Step 3: Run

```bash
npm install
npm run youtube            # Jalankan YouTube viewer
npm run youtube:dev        # Mode verbose (detail logs)
```

---

## Fitur YouTube Viewer

| # | Fitur | Deskripsi |
|---|-------|-----------|
| 1 | **Cookie Login** | Login via cookies browser, gak perlu password, aman dari 2FA |
| 2 | **Watch Retention** | Nonton 60-95% video dengan pola realistis (pause, rewind, skip) |
| 3 | **Playback Telemetry** | Kirim heartbeat ke YouTube tiap 10 detik (real playback event) |
| 4 | **Media Engagement** | Random volume, fullscreen, like, comment, subscribe |
| 5 | **Codec Fingerprint** | Media codec support cocok sama device type |
| 6 | **Account Trust** | Trust scoring & account aging (akun lama = lebih trusted) |
| 7 | **Device Attestation** | Device identity persistent per akun (GPU, screen, hardware tetap) |
| 8 | **Behavior History** | Riwayat nonton jangka panjang, organic browsing sebelum target |
| 9 | **Ad Handling** | Tunggu 5-15s sebelum skip iklan (bukan instant skip) |
| 10 | **Multi-Account Rotation** | Rotate akun dengan cooldown, gak spam satu akun |
| 11 | **Organic Browsing** | Browse home, search, shorts dulu sebelum nonton target |
| 12 | **Recommended Chain** | Klik video recommended setelah nonton (natural behavior) |

---

## Flow YouTube Viewer

```
1. Load cookies semua akun dari ./cookies/
2. Pilih akun (rotation + cooldown check)
3. Cek trust score akun (skip kalau perlu istirahat)
4. Launch browser dengan stealth + device attestation
5. Login via cookies
6. Organic browsing dulu:
   - Browse YouTube Home
   - Scroll-scroll
   - Maybe search / browse Shorts
7. Navigate ke target video
8. Handle iklan (tunggu, baru skip)
9. Set volume random (30-85%)
10. Generate watch plan (berapa % mau ditonton)
11. Nonton dengan:
    - Telemetry heartbeat tiap 10s
    - Random pause, rewind, speed change
    - Mouse movement & hover controls
    - Handle mid-roll ads
12. Post-watch engagement:
    - Maybe like (15%)
    - Maybe browse comments
    - Maybe subscribe (5%)
    - Maybe klik recommended video
13. Save updated cookies
14. Record watch time & update trust score
15. Delay, lanjut video/session berikutnya
```

---

## Tips Kejar Jam Tayang

- Gunakan **5-10 akun** yang berbeda
- Cooldown minimal **30 menit** per akun
- Nonton **60-95%** video (jangan 100%, suspicious)
- Spread nonton **sepanjang hari** (jangan sekaligus)
- **1 proxy per akun** = IP unik
- Update cookies setiap **1-2 minggu**
- Akun yang lebih tua = lebih aman
- Jangan langsung agresif, mulai pelan (2-3 video/hari per akun)

---

## Format Cookie yang Didukung

### JSON Format (EditThisCookie / Puppeteer export):
```json
[
  {
    "name": "SID",
    "value": "xxx...",
    "domain": ".google.com",
    "path": "/",
    "secure": true,
    "httpOnly": true
  }
]
```

### Netscape Format (cookies.txt):
```
.youtube.com	TRUE	/	TRUE	1735689600	SID	xxx...
.google.com	TRUE	/	TRUE	1735689600	HSID	yyy...
```

---

# WEBSITE AUTO VISITOR

## Cara Pakai

```bash
# Edit .env
cp .env.example .env
nano .env

# Run
npm start                  # Auto visitor website
npm run scheduled          # Mode scheduler (auto repeat)
npm run health-check       # Test proxy
```

## Fitur Website Visitor

- Human behavior (scroll pelan 30s, mouse movement, reading simulation)
- Proxy rotator (SOCKS4/SOCKS5/HTTP/HTTPS)
- Random viewport, user-agent, referer
- Mobile emulation, timezone spoofing
- Canvas/WebGL fingerprint randomization
- CAPTCHA detection & skip
- Bandwidth throttling (3G/4G/WiFi)
- Warm-up phase & traffic pattern
- Cookie management
- Error retry (exponential backoff)
- Scheduler / cron
- Stats logging (JSON/CSV)
- Docker support
- Telegram/Discord webhook

---

## Project Structure

```
visitor/
├── package.json
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── cookies/                       ← Cookies akun YouTube (taruh di sini)
├── src/
│   ├── index.js                   ← Main website visitor
│   ├── config.js
│   ├── envConfig.js
│   ├── tools/
│   │   └── proxyCheck.js
│   ├── modules/                   ← Shared modules
│   │   ├── proxyRotator.js
│   │   ├── userAgentRotator.js
│   │   ├── viewportRandomizer.js
│   │   ├── refererRandomizer.js
│   │   ├── humanBehavior.js
│   │   ├── cookieManager.js
│   │   ├── timezoneSpoofer.js
│   │   ├── fingerprintRandomizer.js
│   │   ├── retryHandler.js
│   │   ├── scheduler.js
│   │   ├── trafficPattern.js
│   │   ├── dnsOverHttps.js
│   │   ├── statsLogger.js
│   │   ├── browserEngine.js
│   │   ├── captchaDetector.js
│   │   ├── bandwidthThrottle.js
│   │   ├── warmupPhase.js
│   │   ├── proxyHealthChecker.js
│   │   └── webhookNotifier.js
│   └── youtube/                   ← YouTube auto viewer
│       ├── index.js               ← Main YouTube viewer
│       ├── config.js
│       └── modules/
│           ├── cookieLogin.js     ← Login via cookies
│           ├── watchRetention.js  ← Watch retention simulation
│           ├── playbackTelemetry.js ← YouTube heartbeat
│           ├── mediaEngagement.js ← Like, subscribe, volume
│           ├── codecFingerprint.js ← Codec matching
│           ├── accountTrust.js    ← Trust score & aging
│           ├── deviceAttestation.js ← Device identity
│           └── behaviorHistory.js ← Long-term history
```

---

## All Commands

```bash
# Website visitor
npm start                 # Run visitor
npm run dev               # Verbose mode
npm run scheduled         # Scheduler mode

# YouTube viewer
npm run youtube           # Run YouTube viewer
npm run youtube:dev       # Verbose mode
npm run youtube:multiday  # Multi-day auto scheduler
npm run youtube:week      # 🔥 1-WEEK PACKAGE (4000 jam, 40+ concurrent)

# Tools
npm run health-check      # Test proxies

# Docker
npm run docker:build
npm run docker:up
npm run docker:down
npm run docker:logs
```

---

# 1-WEEK PACKAGE (Kejar 4000 Jam Tayang)

## Setup Cepat

```bash
# 1. Install
cd visitor && npm install

# 2. Taruh cookies akun (500 akun)
# Export dari browser → taruh di ./cookies/akun1.json, akun2.json, dst

# 3. Taruh proxy list
# Buat file ./proxies.txt (1 proxy per line)
# Format: socks5://user:pass@host:port

# 4. Set config di .env
cp .env.example .env
nano .env
```

```env
# .env untuk Week Package
YOUTUBE_VIDEOS=https://www.youtube.com/watch?v=VIDEO1,https://www.youtube.com/watch?v=VIDEO2,https://www.youtube.com/watch?v=VIDEO3
CONCURRENT=30
RAM=16
TARGET_HOURS=4200
QUALITY=144p
COOKIES_DIR=./cookies
PROXY_FILE=./proxies.txt
```

```bash
# 5. Run! (24/7 sampai target tercapai)
npm run youtube:week
```

## Spek & Estimasi

| RAM | Max Concurrent | Jam/Hari | Hari ke 4000 jam |
|-----|---------------|----------|-----------------|
| 8 GB | ~20 browser | ~300 jam | ~14 hari |
| 16 GB | ~35 browser | ~500 jam | ~8 hari |
| 32 GB | ~70 browser | ~900 jam | ~5 hari |
| 64 GB | ~140 browser | ~1500 jam | ~3 hari |

## Fitur Week Package

- RAM optimized (~350MB/browser vs 800MB normal)
- Auto quality 144p (hemat bandwidth, 1 TB cukup)
- 40+ concurrent browser support
- Auto-retry session gagal
- Mute detection (volume selalu >5%)
- Watch history bypass (gak spam 1 video)
- IP-Account binding (1 akun = 1 proxy tetap)
- Progress dashboard & ETA
- Graceful shutdown (Ctrl+C = save progress)
- Auto-resume dari progress terakhir

## Requirements

- Node.js 18+
- Chromium (auto-installed via puppeteer)
- Proxy (SOCKS4/SOCKS5/HTTP) - recommended
- Cookie files untuk YouTube viewer
