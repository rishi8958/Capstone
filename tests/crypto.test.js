const { encrypt, decrypt, verifyWebhookSignature } = require('../src/lib/crypto');

// Set a test key (32 bytes = 64 hex chars)
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.WEBHOOK_SECRET = 'test-webhook-secret';

describe('Encryption', () => {
  test('encrypt/decrypt round-trips correctly', () => {
    const plaintext = 'fake_token_abc123';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  test('each encryption produces a unique ciphertext (random IV)', () => {
    const plaintext = 'same-token';
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);
    expect(enc1).not.toBe(enc2);
  });
});

describe('Webhook signature verification', () => {
  const crypto = require('crypto');
  const secret = 'test-webhook-secret';

  function makeSignature(body) {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  test('valid signature passes', () => {
    const body = Buffer.from(JSON.stringify({ event: 'delivered' }));
    const sig = makeSignature(body);
    expect(verifyWebhookSignature(body, sig)).toBe(true);
  });

  test('forged signature is rejected', () => {
    const body = Buffer.from(JSON.stringify({ event: 'delivered' }));
    const forgedSig = 'sha256=' + 'f'.repeat(64);
    expect(verifyWebhookSignature(body, forgedSig)).toBe(false);
  });

  test('tampered body is rejected', () => {
    const body = Buffer.from(JSON.stringify({ event: 'delivered' }));
    const sig = makeSignature(body);
    const tamperedBody = Buffer.from(JSON.stringify({ event: 'delivered', injected: true }));
    expect(verifyWebhookSignature(tamperedBody, sig)).toBe(false);
  });

  test('missing signature is rejected', () => {
    const body = Buffer.from('{}');
    expect(verifyWebhookSignature(body, '')).toBe(false);
  });
});
