const axios = require('axios');
const fs = require('fs');
const { SocialPublisher, RateLimitError } = require('./SocialPublisher');
const { encrypt, decrypt } = require('../lib/crypto');
const { getDb } = require('../db');

const FAKE_URL = process.env.FAKE_PLATFORM_URL || 'http://localhost:4000';

class FakeBaseAdapter extends SocialPublisher {
  constructor(platformId) {
    super();
    this.platformId = platformId;
  }

  async getToken() {
    const db = getDb();
    const row = await db('platform_tokens').where({ platform: this.platformId }).first();

    if (row) return decrypt(row.encrypted_token);

    const res = await axios.post(`${FAKE_URL}/oauth/token`, {
      platform: this.platformId,
      grant_type: 'client_credentials',
    });
    const token = res.data.access_token;
    await this._storeToken(token);
    return token;
  }

  async _storeToken(token) {
    const db = getDb();
    await db('platform_tokens')
      .insert({ platform: this.platformId, encrypted_token: encrypt(token), updated_at: new Date().toISOString() })
      .onConflict('platform').merge();
  }

  async _clearToken() {
    const db = getDb();
    await db('platform_tokens').where({ platform: this.platformId }).delete();
  }

  async publish(post) {
    const token = await this.getToken();

    const imageBuffer = post.imagePath && fs.existsSync(post.imagePath)
      ? fs.readFileSync(post.imagePath).toString('base64')
      : null;

    let res;
    try {
      res = await axios.post(
        `${FAKE_URL}/publish`,
        { platform: this.platformId, caption: post.caption, image: imageBuffer },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': post.idempotencyKey,
          },
        }
      );
    } catch (err) {
      if (err.response?.status === 429) {
        const retryAfter = parseInt(err.response.headers['retry-after'] ?? '30', 10);
        throw new RateLimitError(retryAfter);
      }
      if (err.response?.status === 401) {
        await this._clearToken();
        return this.publish(post);
      }
      throw err;
    }

    return { platformPostId: res.data.post_id ?? res.data.id };
  }
}

class FakeInstagramAdapter extends FakeBaseAdapter {
  constructor() { super('instagram'); }
}

class FakeXAdapter extends FakeBaseAdapter {
  constructor() { super('x'); }
}

module.exports = { FakeInstagramAdapter, FakeXAdapter };
