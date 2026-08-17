/**
 * Integration tests for webhook endpoint and idempotent publish.
 */
process.env.ENCRYPTION_KEY = 'b'.repeat(64);
process.env.WEBHOOK_SECRET = 'test-webhook-secret';

const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'social-int-'));
process.env.DB_PATH = path.join(tmpDir, 'test.db');

// Mock BullMQ queue so tests don't need Redis
jest.mock('../src/worker/queue', () => ({
  schedulePost: jest.fn().mockResolvedValue(undefined),
  publishQueue: {},
  connection: {},
}));

const request = require('supertest');
const app = require('../src/index');
const { getDb, resetDb } = require('../src/db');

beforeAll(async () => {
  // Run migrations inline
  const db = getDb();
  await db.schema.createTableIfNotExists('campaigns', (t) => {
    t.string('id').primary();
    t.string('title').notNullable();
    t.text('body').notNullable();
    t.string('url').notNullable();
    t.string('source_image_path');
    t.datetime('created_at').defaultTo(db.fn.now());
  });
  await db.schema.createTableIfNotExists('social_posts', (t) => {
    t.string('id').primary();
    t.string('campaign_id').notNullable();
    t.string('platform').notNullable();
    t.text('caption').notNullable();
    t.string('image_path');
    t.string('status').notNullable().defaultTo('queued');
    t.string('idempotency_key').notNullable().unique();
    t.string('platform_post_id');
    t.datetime('scheduled_at');
    t.datetime('published_at');
    t.text('error');
    t.datetime('created_at').defaultTo(db.fn.now());
    t.datetime('updated_at').defaultTo(db.fn.now());
  });
  await db.schema.createTableIfNotExists('platform_tokens', (t) => {
    t.string('platform').primary();
    t.text('encrypted_token').notNullable();
    t.datetime('updated_at').defaultTo(db.fn.now());
  });
});

afterAll(async () => {
  await new Promise(r => setTimeout(r, 500)); // let SQLite close
  resetDb();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
});

function makeWebhookSig(body) {
  return 'sha256=' + crypto.createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');
}

describe('Webhook endpoint', () => {
  let postId;

  beforeEach(async () => {
    const { v4: uuidv4 } = require('uuid');
    const db = getDb();
    const campId = uuidv4();
    postId = uuidv4();
    await db('campaigns').insert({ id: campId, title: 'T', body: 'B', url: 'http://x.com' });
    await db('social_posts').insert({
      id: postId,
      campaign_id: campId,
      platform: 'instagram',
      caption: 'cap',
      status: 'publishing',
      idempotency_key: `${campId}:instagram`,
      platform_post_id: 'plat-post-123',
    });
  });

  test('valid webhook flips status to published', async () => {
    const payload = JSON.stringify({
      platform_post_id: 'plat-post-123',
      status: 'delivered',
    });
    const sig = makeWebhookSig(payload);

    const res = await request(app)
      .post('/webhook/social-delivery')
      .set('Content-Type', 'application/json')
      .set('X-Signature', sig)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');

    const db = getDb();
    const post = await db('social_posts').where({ id: postId }).first();
    expect(post.status).toBe('published');
  });

  test('forged webhook returns 400 and does not change status', async () => {
    const payload = JSON.stringify({ platform_post_id: 'plat-post-123', status: 'delivered' });
    const forgedSig = 'sha256=' + 'a'.repeat(64);

    const res = await request(app)
      .post('/webhook/social-delivery')
      .set('Content-Type', 'application/json')
      .set('X-Signature', forgedSig)
      .send(payload);

    expect(res.status).toBe(400);

    const db = getDb();
    const post = await db('social_posts').where({ id: postId }).first();
    expect(post.status).toBe('publishing'); // unchanged
  });
});

describe('Idempotent publish (adapter layer)', () => {
  test('publishing same idempotency key twice yields one post on fake platform', async () => {
    const axios = require('axios');
    const calls = [];
    const mockPost = jest.spyOn(axios, 'post').mockImplementation(async (url, _data, config) => {
      if (url.includes('/oauth/token')) return { data: { access_token: 'tok' } };
      if (url.includes('/publish')) {
        const key = config?.headers?.['Idempotency-Key'];
        if (!calls.includes(key)) calls.push(key);
        return { data: { id: 'post-abc', post_id: 'post-abc' } };
      }
    });

    const { FakeInstagramAdapter } = require('../src/adapters/FakePlatformAdapters');
    const adapter = new FakeInstagramAdapter();
    const post = {
      id: 'test-post-1', campaignId: 'camp-1', platform: 'instagram',
      caption: 'Test caption', imagePath: null, idempotencyKey: 'camp-1:instagram',
    };

    const r1 = await adapter.publish(post);
    const r2 = await adapter.publish(post);

    expect(r1.platformPostId).toBe(r2.platformPostId);
    expect(calls.length).toBe(1); // only one unique key

    mockPost.mockRestore();
  });
});
