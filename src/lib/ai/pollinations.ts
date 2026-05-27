// Pollinations.ai is a free, key-less image-gen API. Reference:
// https://image.pollinations.ai/prompt/<urlencoded>?<params>

export const POLLINATIONS_STYLE_PREAMBLE =
  'cartoon illustration for children, bright colors, simple, single subject, no text:';

export function buildPollinationsUrl(imageHook: string, wordId: string): string {
  const prompt = `${POLLINATIONS_STYLE_PREAMBLE} ${imageHook}`;
  const seed = parseInt(wordId.replace(/-/g, '').slice(0, 8), 16);
  const params = new URLSearchParams({
    model: 'flux',
    width: '512',
    height: '512',
    nologo: 'true',
    enhance: 'true',
    seed: String(seed),
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}
