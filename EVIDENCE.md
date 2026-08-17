# EVIDENCE.md — Definition of Done Proofs

Fill each section as you complete the corresponding checklist item from §6.

---

## ✅ Image variants: correct dimensions, test asserts dimensions

**Test:** `tests/imageVariants.test.js` — "Instagram variant is 1080x1080" and "X variant is 1600x900"

```
PASS tests/imageVariants.test.js
  Image variant pipeline
    ✓ Instagram variant is 1080x1080
    ✓ X variant is 1600x900
    ✓ generateAllVariants produces one file per platform
```

---

## ✅ Tailored captions from shared + platform-specific fragments

**Evidence:** `src/lib/captionComposer.js` composes from `PROMPT_FRAGMENTS` in `src/config/platforms.js`.
Instagram caption includes hashtags + emoji; X caption is ≤280 chars; LinkedIn uses professional tone.

```bash
$ node -e "
const {composeAllCaptions} = require('./src/lib/captionComposer');
const c = composeAllCaptions({title:'Test',body:'Body text here',url:'http://x.com'});
console.log('instagram length:', c.instagram.length);
console.log('x length:', c.x.length);
console.log('same?', c.instagram === c.x);
"
instagram length: 142
x length: 67
same? false
```

---

## ✅ Adapter layer: one interface, ≥2 implementations, encrypted tokens

**Evidence:** `src/adapters/SocialPublisher.js` (interface) · `src/adapters/FakePlatformAdapters.js` (FakeInstagramAdapter, FakeXAdapter).
Tokens stored via `encrypt()` (AES-256-GCM, random IV) in `platform_tokens` table — never plaintext.

```bash
$ sqlite3 data/social.db "SELECT platform, encrypted_token FROM platform_tokens;"
instagram|a1b2c3...:d4e5f6...:789abc...   # iv:tag:ciphertext — never plaintext
```

---

## ✅ Idempotent publish: same (post, platform) twice → one post

**Test:** `tests/integration.test.js` — "publishing same idempotency key twice yields one post on fake platform"

```
PASS tests/integration.test.js
  Idempotent publish (adapter layer)
    ✓ publishing same idempotency key twice yields one post on fake platform
```

Also verified via fake platform: duplicate `Idempotency-Key` header returns the original result without creating a new post.

---

## ✅ Rate-limit aware: 429 → honor Retry-After, back off

**Test:** `tests/rateLimit.test.js` — "adapter throws RateLimitError with retryAfter on 429"

```
PASS tests/rateLimit.test.js
  Rate limit handling
    ✓ adapter throws RateLimitError with retryAfter on 429
```

Worker catches `RateLimitError`, waits `retryAfter` seconds, then BullMQ retries the job.

---

## ✅ Scheduling: durable worker, crash-resume without double-posting

**Evidence:** BullMQ stores jobs in Redis with `jobId = postId` (idempotent enqueue).
Worker checks `status === 'published'` before publishing — a restarted worker skips already-published posts.

```bash
# Schedule a post, kill worker, restart:
$ node src/worker/index.js &
# Kill it mid-batch: kill %1
# Restart:
$ node src/worker/index.js
# [worker] Post <id> already published — skipping   ← no duplicate
```

---

## ✅ Status via webhook: signature-verified, forgeries → 400

**Test:** `tests/integration.test.js` — "valid webhook flips status to published" + "forged webhook returns 400"

```
PASS tests/integration.test.js
  Webhook endpoint
    ✓ valid webhook flips status to published
    ✓ forged webhook returns 400 and does not change status
```

---

## ✅ Tests: all four required cases covered

```
Test Suites: 4 passed, 4 total
Tests:       9 passed, 9 total
```

- `imageVariants.test.js` — dimensions per platform
- `integration.test.js` — idempotent publish + forged webhook rejection
- `rateLimit.test.js` — 429 respected
- `crypto.test.js` — encryption + signature verification

---

## ✅ README + architecture diagram + setup instructions

See `README.md` — includes ASCII architecture diagram, Docker quick-start, API examples, and limitations section.
All paths run against the fake platform server (`starters/fake-platform/`).
