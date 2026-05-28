// Pollinations.ai image-gen API. Reference:
// https://image.pollinations.ai/prompt/<urlencoded>?<params>
//
// Free tier (no key): `model=turbo` plus the default (no model) generator.
// Paid tier (returns 402 without auth): `model=flux`, `enhance=true`.
// We use `turbo` because `flux` + `enhance` cost money and `turbo` produces
// perfectly serviceable cartoon images for our 192px-tall scene container.

import { put } from '@vercel/blob';
import { BlobUploadError, PollinationsError } from '@/lib/errors/images-errors';

export const POLLINATIONS_STYLE_PREAMBLE =
  'cartoon illustration for children, bright colors, simple, single subject, no text:';

export function buildPollinationsUrl(imageHook: string, wordId: string): string {
  const prompt = `${POLLINATIONS_STYLE_PREAMBLE} ${imageHook}`;
  const seed = parseInt(wordId.replace(/-/g, '').slice(0, 8), 16);
  const params = new URLSearchParams({
    model: 'turbo',
    width: '512',
    height: '512',
    nologo: 'true',
    seed: String(seed),
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

const FETCH_TIMEOUT_MS = 30_000;

export async function fetchAndUploadImage(
  imageHook: string,
  wordId: string,
): Promise<string> {
  const url = buildPollinationsUrl(imageHook, wordId);

  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    throw new PollinationsError(res.status, url);
  }
  const bytes = await res.arrayBuffer();

  let blob;
  try {
    blob = await put(`words/${wordId}.png`, bytes, {
      access: 'public',
      contentType: 'image/png',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (err) {
    throw new BlobUploadError(err);
  }
  return blob.url;
}
