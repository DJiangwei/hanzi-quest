import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const putMock = vi.hoisted(() => vi.fn());
vi.mock('@vercel/blob', () => ({ put: putMock }));

import { fetchAndUploadImage } from '@/lib/ai/pollinations';
import { PollinationsError, BlobUploadError } from '@/lib/errors/images-errors';

const originalFetch = global.fetch;

beforeEach(() => {
  putMock.mockReset();
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.useRealTimers();
});

describe('fetchAndUploadImage', () => {
  const wordId = '8b2c3f47-1234-5678-9abc-def012345678';
  const hook = 'a tiny crab waving its claws on a sunny beach';
  const fakeBytes = new ArrayBuffer(128);

  function mockFetch(response: Partial<Response>) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      arrayBuffer: vi.fn().mockResolvedValue(response.arrayBuffer ?? fakeBytes),
      ...response,
    } as unknown as Response);
  }

  it('fetches the Pollinations URL, uploads bytes to Vercel Blob, returns the public URL', async () => {
    mockFetch({ ok: true });
    putMock.mockResolvedValue({ url: 'https://store.public.blob.vercel-storage.com/words/abc.png' });

    const url = await fetchAndUploadImage(hook, wordId);

    expect(global.fetch).toHaveBeenCalledOnce();
    const fetchedUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(fetchedUrl).toMatch(/^https:\/\/image\.pollinations\.ai\/prompt\//);

    expect(putMock).toHaveBeenCalledOnce();
    const [pathArg, bytesArg, optionsArg] = putMock.mock.calls[0];
    expect(pathArg).toBe(`words/${wordId}.png`);
    expect(bytesArg).toBe(fakeBytes);
    expect(optionsArg).toMatchObject({
      access: 'public',
      contentType: 'image/png',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    expect(url).toBe('https://store.public.blob.vercel-storage.com/words/abc.png');
  });

  it('throws PollinationsError when fetch returns non-ok', async () => {
    mockFetch({ ok: false, status: 503 });
    await expect(fetchAndUploadImage(hook, wordId)).rejects.toBeInstanceOf(PollinationsError);
  });

  it('throws BlobUploadError when put() rejects', async () => {
    mockFetch({ ok: true });
    putMock.mockRejectedValue(new Error('blob token invalid'));
    await expect(fetchAndUploadImage(hook, wordId)).rejects.toBeInstanceOf(BlobUploadError);
  });

  it('passes an AbortSignal with a 30s timeout to fetch', async () => {
    mockFetch({ ok: true });
    putMock.mockResolvedValue({ url: 'x' });
    await fetchAndUploadImage(hook, wordId);
    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1]).toBeDefined();
    expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
  });
});
