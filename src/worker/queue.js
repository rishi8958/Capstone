const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const publishQueue = new Queue('social-publish', { connection });

/**
 * Enqueue a social post for publishing.
 * @param {string} postId - social_posts.id
 * @param {number} delayMs - milliseconds from now (0 = immediate)
 */
async function schedulePost(postId, delayMs = 0) {
  await publishQueue.add(
    'publish',
    { postId },
    {
      jobId: postId, // idempotent: same postId = same job, no duplicate enqueue
      delay: delayMs,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
    }
  );
}

module.exports = { publishQueue, schedulePost, connection };
