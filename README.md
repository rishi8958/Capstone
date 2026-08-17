# FlyRank Social Studio — Multi-Platform Social Campaign Publisher

Turn one blog post into a complete social media campaign: platform-correct image variants, tailored captions, scheduled publishing through a clean adapter layer — idempotent, rate-limit-aware, and webhook-verified.

## Architecture

```
[POST /campaigns]
      │
      ├─► Caption Composer (shared brand voice + platform fragments)
      │         └─► instagram caption · x caption
      │
      └─► Image Variant Pipeline (sharp)
                └─► 1080×1080 (instagram) · 1600×900 (x)

Campaign created → social_posts rows (status: queued)
      │
      └─► BullMQ Queue (Redis) ──(worker, at scheduled time)──► SocialPublisher interface
                                                                    ├── FakeInstagramAdapter
                                                                    └── FakeXAdapter
                                                                          │
                                                              idempotency key · 429/Retry-After · encrypted token
                                                                          │
                                                              FAKE PLATFORM SERVER (:4000)
                                                                          │
                                                              signed delivery webhook
                                                                          │
                                                              POST /webhook/social-delivery
                                                              verify HMAC signature
                                                                    ├── valid   → status: published
                                                                    └── forged  → 400 rejected
```

## Stack

| Concern | Tool |
|---|---|
| API | Node.js + Express |
| DB | SQLite (better-sqlite3) |
| Queue / Scheduler | BullMQ + Redis |
| Image processing | sharp |
| Encryption | Node.js crypto (AES-256-GCM) |
| Fake platform | Custom Express server (starters/fake-platform) |

## Quick Start

### Prerequisites
- Docker + Docker Compose
- Node.js 20+ (for local dev)

### Run with Docker

```bash
# 1. Copy env file and set your keys
cp .env.example .env
# Edit .env: set ENCRYPTION_KEY (64 hex chars) and WEBHOOK_SECRET

# 2. Start everything
docker compose up --build

# 3. Seed demo data
docker compose exec app node src/db/seed.js
```

### Run locally (without Docker)

```bash
# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Install deps
npm install
cd starters/fake-platform && npm install && cd ../..

# Start fake platform
node starters/fake-platform/server.js &

# Migrate DB
node src/db/migrate.js

# Start API
node src/index.js &

# Start worker
node src/worker/index.js &

# Seed
node src/db/seed.js
```

## API

### Create a campaign
```bash
curl -X POST http://localhost:3000/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "title": "How We Doubled Traffic",
    "body": "We analyzed 500 campaigns and found three patterns...",
    "url": "https://flyrank.com/blog/doubled-traffic",
    "scheduledAt": "2025-12-01T09:00:00Z"
  }'
```

### List campaigns
```bash
curl http://localhost:3000/campaigns
```

### Trigger publish manually (idempotent)
```bash
curl -X POST http://localhost:3000/campaigns/<id>/publish
```

## Tests

```bash
npm test
```

Covers: image dimensions per platform · forged webhook rejection · rate-limit RateLimitError · encryption round-trip · idempotent publish.

## Limitations

- Caption generation uses template composition (no LLM). AI caption generation is an optional enhancement.
- Source images are generated as solid-color placeholders. Bring your own image by replacing the `source_image_path` in the seed.
- The fake platform server simulates ~10% random failures and rate limits every 10 requests (configurable via `RATE_LIMIT_EVERY`).
- LinkedIn adapter is not implemented in the core (two platforms required: instagram + x).
