require('dotenv').config();
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { getDb } = require('../db');
const { getAdapter } = require('../adapters/registry');
const { RateLimitError } = require('../adapters/SocialPublisher');

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  'social-publish',
  async (job) => {
    const { postId } = job.data;
    const db = getDb();

    const post = await db('social_posts').where({ id: postId }).first();
    if (!post) throw new Error(`Post ${postId} not found`);

    // Idempotency guard: skip if already published
    if (post.status === 'published') {
      console.log(`[worker] Post ${postId} already published — skipping`);
      return;
    }

    await db('social_posts').where({ id: postId }).update({ status: 'publishing', updated_at: new Date().toISOString() });

    const adapter = getAdapter(post.platform);

    try {
      const { platformPostId } = await adapter.publish({
        id: post.id,
        campaignId: post.campaign_id,
        platform: post.platform,
        caption: post.caption,
        imagePath: post.image_path,
        idempotencyKey: post.idempotency_key,
      });

      await db('social_posts').where({ id: postId }).update({
        platform_post_id: platformPostId,
        status: 'publishing', // final flip happens via webhook
        updated_at: new Date().toISOString(),
      });

      console.log(`[worker] Published post ${postId} → platform_post_id=${platformPostId}`);
    } catch (err) {
      if (err instanceof RateLimitError) {
        console.log(`[worker] Rate limited on post ${postId}, retrying in ${err.retryAfter}s`);
        await new Promise((r) => setTimeout(r, err.retryAfter * 1000));
        throw err; // BullMQ retries
      }

      await db('social_posts').where({ id: postId }).update({
        status: 'failed',
        error: err.message,
        updated_at: new Date().toISOString(),
      });
      throw err;
    }
  },
  { connection, concurrency: 3 }
);

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed: ${err.message}`);
});

console.log('[worker] Social publish worker started');
module.exports = worker;
