# BUILDLOG.md — AI Usage Log

## Where AI helped

- **Project scaffolding**: Amazon Q generated the initial directory structure, package.json, and Docker Compose setup. Reviewed and adjusted service dependencies and volume mounts.

- **Crypto module**: Q suggested AES-256-GCM with random IV and the `iv:tag:ciphertext` storage format. Verified against Node.js crypto docs — the approach mirrors `lib/serverUtils.ts` from the FlyRank codebase.

- **BullMQ job options**: Q suggested `jobId: postId` for idempotent enqueue. Confirmed this is the correct BullMQ pattern for preventing duplicate jobs.

- **Webhook signature verification**: Q generated the `timingSafeEqual` comparison. This is the correct approach to prevent timing attacks — verified against the Stripe webhook pattern referenced in the brief.

- **Test structure**: Q scaffolded the Jest test files. Adjusted the mock strategy for `axios.post` to correctly simulate idempotency key behavior.

## Where AI was wrong / what I changed

- **DB path in tests**: Q initially used a shared DB path across test files, causing test interference. Fixed by using `fs.mkdtempSync` per test suite and setting `process.env.DB_PATH` before requiring modules.

- **Webhook lookup logic**: Q's initial webhook handler had redundant/conflicting lookup queries. Simplified to a clean two-step lookup: by `platform_post_id` first, then by `id`.

- **Worker rate-limit handling**: Q's first version re-threw the error immediately without waiting. Changed to `await setTimeout(retryAfter * 1000)` before re-throwing so BullMQ's retry delay is additive, not just the backoff.

- **Docker Compose worker command**: Q initially had the worker and app in the same container. Split into separate services so the worker can be killed/restarted independently for the crash-recovery demo.

## What I built myself

- Platform specifications and prompt fragment design (`src/config/platforms.js`)
- The `composeCaption` template logic ensuring genuinely different voices per platform
- The fake platform's random failure simulation and rate-limit trigger admin endpoints
- The seed script's placeholder image generation approach

## Honesty note

All generated code was read, understood, and tested before committing. At the demo I can explain any line.
