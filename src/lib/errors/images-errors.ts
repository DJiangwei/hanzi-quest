// Pure error classes — safe to import from client components per the
// 'use server'-file landmine in CLAUDE.md. No DB / postgres imports here.

export class PollinationsError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
  ) {
    super(`Pollinations request failed: ${status} for ${url}`);
    this.name = 'PollinationsError';
  }
}

export class BlobUploadError extends Error {
  constructor(public readonly cause: unknown) {
    super(
      `Vercel Blob upload failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = 'BlobUploadError';
  }
}
