const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX = process.env.ENCRYPTION_KEY || '0'.repeat(64);
const KEY = Buffer.from(KEY_HEX, 'hex');

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(stored) {
  const [ivHex, tagHex, dataHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.WEBHOOK_SECRET || 'default-secret';
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader?.replace('sha256=', '') ?? '';
  // Constant-time comparison to prevent timing attacks
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
}

module.exports = { encrypt, decrypt, verifyWebhookSignature };
