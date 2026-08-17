const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sharp = require('sharp');
const { getDb } = require('../db');
const { generateAllVariants } = require('../lib/imageVariants');
const { composeAllCaptions } = require('../lib/captionComposer');
const { schedulePost } = require('../worker/queue');
const { PLATFORMS } = require('../config/platforms');

const router = express.Router();

router.post('/', async (req, res) => {
  const { title, body, url, scheduledAt } = req.body;
  if (!title || !body || !url) {
    return res.status(400).json({ error: 'title, body, and url are required' });
  }

  const campaignId = uuidv4();
  const sourcePath = path.join(process.cwd(), 'generated', `${campaignId}_source.jpg`);

  await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 30, g: 80, b: 200 } },
  }).jpeg().toFile(sourcePath);

  const [variants, captions] = await Promise.all([
    generateAllVariants(sourcePath, campaignId),
    Promise.resolve(composeAllCaptions({ title, body, url })),
  ]);

  const db = getDb();
  await db('campaigns').insert({ id: campaignId, title, body, url, source_image_path: sourcePath });

  const postIds = [];
  for (const platformId of Object.keys(PLATFORMS)) {
    const postId = uuidv4();
    const idempotencyKey = `${campaignId}:${platformId}`;
    const delayMs = scheduledAt ? Math.max(0, new Date(scheduledAt) - Date.now()) : 0;

    await db('social_posts').insert({
      id: postId,
      campaign_id: campaignId,
      platform: platformId,
      caption: captions[platformId],
      image_path: variants[platformId],
      status: 'queued',
      idempotency_key: idempotencyKey,
      scheduled_at: scheduledAt ?? null,
    });

    await schedulePost(postId, delayMs);
    postIds.push({ postId, platform: platformId });
  }

  res.status(201).json({ campaignId, posts: postIds });
});

router.get('/', async (req, res) => {
  const db = getDb();
  const campaigns = await db('campaigns').orderBy('created_at', 'desc');
  const result = await Promise.all(campaigns.map(async (c) => ({
    ...c,
    posts: await db('social_posts')
      .where({ campaign_id: c.id })
      .select('id', 'platform', 'status', 'scheduled_at', 'published_at', 'error'),
  })));
  res.json(result);
});

router.get('/:id', async (req, res) => {
  const db = getDb();
  const campaign = await db('campaigns').where({ id: req.params.id }).first();
  if (!campaign) return res.status(404).json({ error: 'Not found' });
  campaign.posts = await db('social_posts').where({ campaign_id: campaign.id });
  res.json(campaign);
});

router.post('/:id/publish', async (req, res) => {
  const db = getDb();
  const posts = await db('social_posts')
    .where({ campaign_id: req.params.id })
    .whereNotIn('status', ['published']);

  if (!posts.length) return res.json({ message: 'All posts already published or campaign not found' });

  for (const post of posts) {
    await schedulePost(post.id, 0);
  }

  res.json({ queued: posts.map((p) => p.id) });
});

module.exports = router;
