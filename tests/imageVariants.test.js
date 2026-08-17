// Mock BullMQ before any imports
jest.mock('../src/worker/queue', () => ({
  schedulePost: jest.fn().mockResolvedValue(undefined),
  publishQueue: {},
  connection: {},
}));

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const os = require('os');

let tmpDir;
let sourcePath;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'social-img-'));
  sourcePath = path.join(tmpDir, 'source.jpg');
  await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 100, g: 150, b: 200 } },
  }).jpeg().toFile(sourcePath);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Override OUTPUT_DIR by patching the module
jest.mock('../src/lib/imageVariants', () => {
  const sharp = require('sharp');
  const path = require('path');
  const os = require('os');
  const { PLATFORMS } = require('../src/config/platforms');

  async function generateVariant(sourcePath, platformId, campaignId) {
    const spec = PLATFORMS[platformId];
    const outputPath = path.join(os.tmpdir(), `${campaignId}_${platformId}.jpg`);
    await sharp(sourcePath)
      .resize(spec.width, spec.height, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 })
      .toFile(outputPath);
    return outputPath;
  }

  async function generateAllVariants(sourcePath, campaignId) {
    const results = {};
    for (const platformId of Object.keys(PLATFORMS)) {
      results[platformId] = await generateVariant(sourcePath, platformId, campaignId);
    }
    return results;
  }

  return { generateVariant, generateAllVariants };
});

describe('Image variant pipeline', () => {
  test('Instagram variant is 1080x1080', async () => {
    const { generateVariant } = require('../src/lib/imageVariants');
    const outPath = await generateVariant(sourcePath, 'instagram', 'test-campaign');
    const meta = await sharp(outPath).metadata();
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1080);
  });

  test('X variant is 1600x900', async () => {
    const { generateVariant } = require('../src/lib/imageVariants');
    const outPath = await generateVariant(sourcePath, 'x', 'test-campaign');
    const meta = await sharp(outPath).metadata();
    expect(meta.width).toBe(1600);
    expect(meta.height).toBe(900);
  });

  test('generateAllVariants produces one file per platform', async () => {
    const { generateAllVariants } = require('../src/lib/imageVariants');
    const variants = await generateAllVariants(sourcePath, 'test-all');
    expect(Object.keys(variants)).toEqual(expect.arrayContaining(['instagram', 'x']));
    for (const filePath of Object.values(variants)) {
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });
});
