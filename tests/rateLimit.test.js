process.env.ENCRYPTION_KEY = 'c'.repeat(64);
process.env.WEBHOOK_SECRET = 'test-secret';

// Mock BullMQ
jest.mock('../src/worker/queue', () => ({
  schedulePost: jest.fn().mockResolvedValue(undefined),
  publishQueue: {},
  connection: {},
}));

// Mock DB so adapter doesn't need a real database
const mockDb = Object.assign(
  jest.fn().mockReturnValue({
    where: () => ({ first: async () => null }),
    insert: () => ({ onConflict: () => ({ merge: async () => {} }) }),
    delete: async () => {},
  }),
  { destroy: jest.fn() }
);

jest.mock('../src/db', () => ({
  getDb: () => mockDb,
  resetDb: jest.fn(),
}));

const axios = require('axios');
const { FakeInstagramAdapter } = require('../src/adapters/FakePlatformAdapters');

describe('Rate limit handling', () => {
  test('adapter throws RateLimitError with retryAfter on 429', async () => {
    const mockPost = jest.spyOn(axios, 'post').mockImplementation(async (url) => {
      if (url.includes('/oauth/token')) return { data: { access_token: 'tok' } };
      const err = new Error('Rate limited. Retry after 30s');
      err.response = { status: 429, headers: { 'retry-after': '30' } };
      throw err;
    });

    const adapter = new FakeInstagramAdapter();
    const post = {
      id: 'p1', campaignId: 'c1', platform: 'instagram',
      caption: 'cap', imagePath: null, idempotencyKey: 'c1:instagram',
    };

    let caught;
    try {
      await adapter.publish(post);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeTruthy();
    expect(caught.retryAfter).toBe(30);
    expect(caught.message).toContain('Rate limited');

    mockPost.mockRestore();
  });
});
