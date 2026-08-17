const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { PLATFORMS } = require('../config/platforms');

const OUTPUT_DIR = path.join(process.cwd(), 'generated');

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate a platform image variant from a source image.
 * Uses cover fit to fill the target dimensions, keeping the subject in the safe zone (center).
 * @param {string} sourcePath - absolute path to source image
 * @param {string} platformId - 'instagram' | 'x'
 * @param {string} campaignId - used for output filename
 * @returns {Promise<string>} absolute path to generated variant
 */
async function generateVariant(sourcePath, platformId, campaignId) {
  ensureOutputDir();
  const spec = PLATFORMS[platformId];
  if (!spec) throw new Error(`Unknown platform: ${platformId}`);

  const outputPath = path.join(OUTPUT_DIR, `${campaignId}_${platformId}.jpg`);

  await sharp(sourcePath)
    .resize(spec.width, spec.height, {
      fit: 'cover',       // fills exact dimensions, crops excess
      position: 'centre', // keeps subject in safe zone (center)
    })
    .jpeg({ quality: 85 })
    .toFile(outputPath);

  return outputPath;
}

/**
 * Generate all platform variants for a campaign.
 * @param {string} sourcePath
 * @param {string} campaignId
 * @returns {Promise<Record<string, string>>} { platformId: outputPath }
 */
async function generateAllVariants(sourcePath, campaignId) {
  const results = {};
  for (const platformId of Object.keys(PLATFORMS)) {
    results[platformId] = await generateVariant(sourcePath, platformId, campaignId);
  }
  return results;
}

module.exports = { generateVariant, generateAllVariants };
