require('dotenv').config();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { getDb } = require('./index');
const { generateAllVariants } = require('../lib/imageVariants');
const { composeAllCaptions } = require('../lib/captionComposer');
const { PLATFORMS } = require('../config/platforms');

async function seed() {
  const db = getDb();

  const campaignId = uuidv4();
  const post = {
    title: 'How FlyRank Doubled Organic Traffic in 90 Days',
    body: 'We analyzed 500 campaigns and found three patterns that consistently drive organic growth: consistent publishing cadence, data-driven keyword targeting, and platform-native content formats. Here is exactly what we did and how you can replicate it.',
    url: 'https://flyrank.com/blog/doubled-organic-traffic',
  };

  const sourcePath = path.join(process.cwd(), 'generated', 'seed_source.jpg');
  await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 30, g: 80, b: 200 } },
  }).jpeg().toFile(sourcePath);

  const variants = await generateAllVariants(sourcePath, campaignId);
  const captions = composeAllCaptions(post);

  await db('campaigns').insert({
    id: campaignId,
    title: post.title,
    body: post.body,
    url: post.url,
    source_image_path: sourcePath,
  }).onConflict('id').ignore();

  for (const platformId of Object.keys(PLATFORMS)) {
    const postId = uuidv4();
    const idempotencyKey = `${campaignId}:${platformId}`;
    await db('social_posts').insert({
      id: postId,
      campaign_id: campaignId,
      platform: platformId,
      caption: captions[platformId],
      image_path: variants[platformId],
      status: 'queued',
      idempotency_key: idempotencyKey,
      scheduled_at: new Date(Date.now() + 60000).toISOString(),
    }).onConflict('idempotency_key').ignore();
  }

  console.log(`Seeded campaign ${campaignId}`);
  await db.destroy();
}

seed().catch(console.error);
