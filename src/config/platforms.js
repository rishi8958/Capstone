// Platform specifications: dimensions, aspect ratio, voice rules
const PLATFORMS = {
  instagram: {
    id: 'instagram',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    maxCaptionLength: 2200,
    voice: 'visual, emoji-friendly, community-focused',
  },
  x: {
    id: 'x',
    width: 1600,
    height: 900,
    aspectRatio: '16:9',
    maxCaptionLength: 280,
    voice: 'punchy, direct, conversation-starting',
  },
};

// Prompt fragments — shared brand voice + per-platform rules
const PROMPT_FRAGMENTS = {
  brandVoice: `You are writing for FlyRank, a growth-focused marketing platform. 
Tone: confident, helpful, data-driven. Never use jargon. Always end with a clear value proposition.`,

  instagram: `Platform: Instagram. 
Rules: Use 3–5 relevant hashtags. Include 1–2 emojis. Keep it visual and community-focused. 
Max ${PLATFORMS.instagram.maxCaptionLength} characters.`,

  x: `Platform: X (Twitter). 
Rules: Max ${PLATFORMS.x.maxCaptionLength} characters total including spaces. 
Be punchy and direct. One strong hook. No hashtag spam (max 2). Spark conversation.`,

  linkedin: `Platform: LinkedIn. 
Rules: Professional tone. Lead with insight. Use line breaks for readability. 
Include a question to drive comments. Max 3000 characters.`,
};

module.exports = { PLATFORMS, PROMPT_FRAGMENTS };
