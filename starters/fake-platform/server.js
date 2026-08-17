/**
 * Fake Social Platform Server
 * Simulates: OAuth token issuance, idempotent publish, 429 rate limits,
 * random failures, and signed delivery webhooks.
 */
const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const https = require('https');

const app = express();
app.use(express.json({ limit: '10mb' }));

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-secret';
const WEBHOOK_CALLBACK_URL = process.env.WEBHOOK_CALLBACK_URL || 'http://localhost:3000/webhook/social-delivery';

// In-memory state
const tokens = new Set();
const publishedPosts = new Map(); // idempotencyKey → post record
let requestCount = 0;
const RATE_LIMIT_EVERY = parseInt(process.env.RATE_LIMIT_EVERY || '10', 10); // every N requests

// POST /oauth/token — issue a fake access token
app.post('/oauth/token', (req, res) => {
  const token = `fake_token_${uuidv4()}`;
  tokens.add(token);
  res.json({ access_token: token, token_type: 'Bearer', expires_in: 3600 });
});

// POST /publish — idempotent publish endpoint
app.post('/publish', (req, res) => {
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!tokens.has(token)) return res.status(401).json({ error: 'Unauthorized' });

  // Simulate rate limiting
  requestCount++;
  if (requestCount % RATE_LIMIT_EVERY === 0) {
    return res.status(429).set('Retry-After', '5').json({ error: 'Rate limit exceeded' });
  }

  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key header required' });

  // Idempotency: return existing result for duplicate keys
  if (publishedPosts.has(idempotencyKey)) {
    const existing = publishedPosts.get(idempotencyKey);
    console.log(`[fake-platform] Idempotent hit for key=${idempotencyKey}`);
    return res.status(200).json(existing);
  }

  // Simulate random failure (~10% of the time)
  if (Math.random() < 0.1) {
    return res.status(500).json({ error: 'Simulated platform error' });
  }

  const postId = uuidv4();
  const record = {
    id: postId,
    post_id: postId,
    platform: req.body.platform,
    caption: req.body.caption,
    created_at: new Date().toISOString(),
  };
  publishedPosts.set(idempotencyKey, record);

  console.log(`[fake-platform] Published post_id=${postId} platform=${req.body.platform}`);

  // Fire delivery webhook asynchronously
  setTimeout(() => sendDeliveryWebhook(postId, req.body.platform), 500);

  res.status(201).json(record);
});

// GET /posts — list all published posts (for verification)
app.get('/posts', (req, res) => {
  res.json([...publishedPosts.values()]);
});

// POST /admin/reset-rate-limit — test helper
app.post('/admin/reset-rate-limit', (req, res) => {
  requestCount = 0;
  res.json({ reset: true });
});

// POST /admin/trigger-rate-limit — force next request to 429
app.post('/admin/trigger-rate-limit', (req, res) => {
  requestCount = RATE_LIMIT_EVERY - 1;
  res.json({ triggered: true });
});

function sendDeliveryWebhook(platformPostId, platform) {
  const payload = JSON.stringify({
    post_id: platformPostId,
    platform_post_id: platformPostId,
    platform,
    status: 'delivered',
    timestamp: new Date().toISOString(),
  });

  const sig = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');

  const url = new URL(WEBHOOK_CALLBACK_URL);
  const lib = url.protocol === 'https:' ? https : http;

  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'X-Signature': sig,
    },
  };

  const req = lib.request(options, (res) => {
    console.log(`[fake-platform] Webhook delivered → ${res.statusCode}`);
  });
  req.on('error', (e) => console.error(`[fake-platform] Webhook error: ${e.message}`));
  req.write(payload);
  req.end();
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Fake platform server running on :${PORT}`));
