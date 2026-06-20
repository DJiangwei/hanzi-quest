import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('trust-caller endpoints are not exported from use-server action files', () => {
  it('gacha.ts no longer exports pullCardForChild or claimWeeklyGiftIfDue', () => {
    const src = read('src/lib/actions/gacha.ts');
    expect(src).not.toMatch(/export\s+async\s+function\s+pullCardForChild/);
    expect(src).not.toMatch(/export\s+async\s+function\s+claimWeeklyGiftIfDue/);
  });

  it('play.ts no longer exports triggerEagerStoryGeneration', () => {
    const src = read('src/lib/actions/play.ts');
    expect(src).not.toMatch(/export\s+async\s+function\s+triggerEagerStoryGeneration/);
  });

  it('card-grants.ts (the new home) is NOT a use-server module', () => {
    const src = read('src/lib/play/card-grants.ts');
    expect(src.trimStart()).not.toMatch(/^['"]use server['"]/);
  });

  it('finishStudyLessonAction is requireChild-gated', () => {
    const src = read('src/lib/actions/study.ts');
    expect(src.trimStart()).toMatch(/^['"]use server['"]/);
    expect(src).toMatch(/requireChild\(/);
  });
});

describe('no family-specific strings in rendered surfaces', () => {
  const files = [...walk(join(ROOT, 'src/app')), ...walk(join(ROOT, 'src/components'))];
  it('contains no "海盗班" or "Yinuo" in src/app or src/components', () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return src.includes('海盗班') || src.includes('Yinuo');
    });
    expect(offenders).toEqual([]);
  });
});
