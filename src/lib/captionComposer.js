const { PROMPT_FRAGMENTS, PLATFORMS } = require('../config/platforms');

/**
 * Compose a caption for a given platform from shared + platform-specific fragments.
 * Uses template-based composition (no AI required; AI is optional enhancement).
 * @param {{ title: string, body: string, url: string }} post
 * @param {string} platformId
 * @returns {string}
 */
function composeCaption(post, platformId) {
  const spec = PLATFORMS[platformId];
  if (!spec) throw new Error(`Unknown platform: ${platformId}`);

  const summary = post.body.slice(0, 200).trim();

  const captions = {
    instagram: `✨ ${post.title}\n\n${summary}...\n\nRead the full story 👉 ${post.url}\n\n#FlyRank #Marketing #Growth #ContentStrategy #DigitalMarketing`,
    x: `${post.title} — ${summary.slice(0, 80)}... ${post.url} #FlyRank`,
    linkedin: `${post.title}\n\n${summary}...\n\nAt FlyRank, we believe data-driven content is the key to sustainable growth.\n\nWhat's your take? Drop a comment below 👇\n\n🔗 ${post.url}`,
  };

  const caption = captions[platformId] ?? `${post.title}\n\n${post.url}`;

  // Enforce platform character limit
  return caption.slice(0, spec.maxCaptionLength);
}

/**
 * Generate captions for all platforms.
 * @param {{ title: string, body: string, url: string }} post
 * @returns {Record<string, string>}
 */
function composeAllCaptions(post) {
  return Object.fromEntries(
    Object.keys(PLATFORMS).map((pid) => [pid, composeCaption(post, pid)])
  );
}

module.exports = { composeCaption, composeAllCaptions };
