import { describe, expect, it } from 'vitest';
import { computeZoomCrop, subjectBBox } from '../../scripts/zoom-collectible-art';

/** Build a raw RGB buffer of `w`×`h` on a white background with one dark rect. */
function canvasWithRect(
  w: number,
  h: number,
  rect: { x: number; y: number; w: number; h: number },
): Buffer {
  const buf = Buffer.alloc(w * h * 3, 255);
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const i = (y * w + x) * 3;
      buf[i] = 10;
      buf[i + 1] = 10;
      buf[i + 2] = 10;
    }
  }
  return buf;
}

describe('subjectBBox', () => {
  it('finds the bounding box of the non-background subject', () => {
    const data = canvasWithRect(100, 100, { x: 30, y: 40, w: 20, h: 10 });
    expect(subjectBBox(data, 100, 100, 3)).toEqual({
      minX: 30,
      minY: 40,
      width: 20,
      height: 10,
    });
  });

  it('returns null for a blank canvas', () => {
    expect(subjectBBox(Buffer.alloc(100 * 100 * 3, 255), 100, 100, 3)).toBeNull();
  });

  it('ignores near-background noise within the tolerance', () => {
    const data = Buffer.alloc(100 * 100 * 3, 255);
    // A pixel only 5/channel off white — JPEG ringing, not subject.
    data[(50 * 100 + 50) * 3] = 250;
    expect(subjectBBox(data, 100, 100, 3)).toBeNull();
  });
});

describe('computeZoomCrop', () => {
  it('crops a square that makes the subject fill the target fraction', () => {
    // 200×200 subject centred in a 1000×1000 canvas (fill 0.2).
    const { extract, extend } = computeZoomCrop(
      { minX: 400, minY: 400, width: 200, height: 200 },
      1000,
      1000,
      0.8,
    );
    // side = 200 / 0.8 = 250, centred on (500,500).
    expect(extract).toEqual({ left: 375, top: 375, width: 250, height: 250 });
    expect(extend).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it('keeps the crop square for a non-square subject (drives off the longest edge)', () => {
    const { extract } = computeZoomCrop(
      { minX: 300, minY: 450, width: 400, height: 100 },
      1000,
      1000,
      0.8,
    );
    expect(extract.width).toBe(extract.height);
    expect(extract.width).toBe(500); // 400 / 0.8
  });

  it('pads instead of shifting when the ideal square runs off-canvas', () => {
    // Subject flush against the left edge — the square would start at x < 0.
    const { extract, extend } = computeZoomCrop(
      { minX: 0, minY: 400, width: 200, height: 200 },
      1000,
      1000,
      0.8,
    );
    expect(extract.left).toBe(0);
    expect(extend.left).toBe(25);
    // Extract stays inside the canvas, and extract+extend is still a square.
    expect(extract.left + extract.width).toBeLessThanOrEqual(1000);
    expect(extract.width + extend.left + extend.right).toBe(
      extract.height + extend.top + extend.bottom,
    );
  });

  it('never extracts outside the canvas for a subject filling the whole frame', () => {
    const { extract, extend } = computeZoomCrop(
      { minX: 0, minY: 0, width: 1000, height: 1000 },
      1000,
      1000,
      0.8,
    );
    expect(extract.left).toBeGreaterThanOrEqual(0);
    expect(extract.top).toBeGreaterThanOrEqual(0);
    expect(extract.left + extract.width).toBeLessThanOrEqual(1000);
    expect(extract.top + extract.height).toBeLessThanOrEqual(1000);
    expect(extend.left + extend.right).toBeGreaterThan(0);
  });
});
