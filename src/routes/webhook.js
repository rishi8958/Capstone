const express = require('express');
const { verifyWebhookSignature } = require('../lib/crypto');
const { getDb } = require('../db');

const router = express.Router();

router.post('/social-delivery', express.raw({ type: '*/*' }), async (req, res) => {
  const signature = req.headers['x-signature'] ?? req.headers['x-hub-signature-256'] ?? '';
  const rawBody = req.body; // Buffer from express.raw

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { platform_post_id, status } = payload;
  if (!platform_post_id || !status) {
    return res.status(400).json({ error: 'Missing platform_post_id or status' });
  }

  const db = getDb();
  const target = await db('social_posts').where({ platform_post_id }).first();
  if (!target) return res.status(404).json({ error: 'Post not found' });

  const newStatus = status === 'delivered' ? 'published' : 'failed';
  await db('social_posts').where({ id: target.id }).update({
    status: newStatus,
    published_at: newStatus === 'published' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  });

  console.log(`[webhook] Post ${target.id} → ${newStatus}`);
  res.json({ received: true, status: newStatus });
});

module.exports = router;
