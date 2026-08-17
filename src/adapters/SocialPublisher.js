/**
 * SocialPublisher interface contract.
 * All platform adapters must implement these methods.
 *
 * publish(post): Promise<{ platformPostId: string }>
 *   - post: { id, campaignId, platform, caption, imagePath, idempotencyKey }
 *   - Must be idempotent: same idempotencyKey → same result, no duplicate post
 *   - Must handle 429 Retry-After by throwing RateLimitError
 *
 * getToken(): Promise<string>
 *   - Returns a valid decrypted access token, refreshing if needed
 */
class SocialPublisher {
  async publish(_post) {
    throw new Error('publish() not implemented');
  }

  async getToken() {
    throw new Error('getToken() not implemented');
  }
}

class RateLimitError extends Error {
  constructor(retryAfterSeconds) {
    super(`Rate limited. Retry after ${retryAfterSeconds}s`);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfterSeconds;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

module.exports = { SocialPublisher, RateLimitError };
