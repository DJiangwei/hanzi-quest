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

  it('finishFinalBossAction is requireChild-gated', () => {
    const src = read('src/lib/actions/final-boss.ts');
    expect(src.trimStart()).toMatch(/^['"]use server['"]/);
    expect(src).toMatch(/requireChild\(/);
  });
});

describe('content authoring is admin-gated (Findings 1, 2, 3)', () => {
  // Pinned so a deleted or renamed export can't silently drop out of the
  // per-function assertAdmin check below (F6).
  const EXPECTED_WEEKS_EXPORTS = [
    'createWeekAction',
    'regenerateCharacterAction',
    'saveCharacterEditsAction',
    'listChildWeeks',
    'publishWeekAction',
    'createStageAction',
    'generateWeekAction',
  ];

  // Actions that legitimately reach across accounts (assertAdmin) AND then
  // scope to one child (requireChild) — the ordering matters: assertAdmin
  // MUST run first, or an unprivileged caller could reach requireChild's
  // child-lookup side effects before being rejected (F6).
  const ADMIN_THEN_CHILD_ACTIONS = ['createWeekAction', 'createStageAction'];

  it('weeks.ts exports exactly the expected action set', () => {
    const src = read('src/lib/actions/weeks.ts');
    const names = [...src.matchAll(/export async function (\w+)\(/g)].map(
      (m) => m[1],
    );
    expect(names).toEqual(EXPECTED_WEEKS_EXPORTS);
  });

  it('every exported action in weeks.ts except listChildWeeks calls assertAdmin', () => {
    const src = read('src/lib/actions/weeks.ts');
    const starts = [...src.matchAll(/export async function (\w+)\(/g)];
    expect(starts.length).toBeGreaterThan(0);
    for (let i = 0; i < starts.length; i++) {
      const name = starts[i][1];
      const bodyStart = starts[i].index!;
      const bodyEnd = i + 1 < starts.length ? starts[i + 1].index! : src.length;
      const body = src.slice(bodyStart, bodyEnd);
      if (name === 'listChildWeeks') {
        expect(body).not.toMatch(/assertAdmin/);
      } else {
        expect(body).toMatch(/assertAdmin\(\)/);
      }
    }
  });

  it('assertAdmin runs before requireChild in every action that calls both (F6)', () => {
    const src = read('src/lib/actions/weeks.ts');
    const starts = [...src.matchAll(/export async function (\w+)\(/g)];
    for (let i = 0; i < starts.length; i++) {
      const name = starts[i][1];
      if (!ADMIN_THEN_CHILD_ACTIONS.includes(name)) continue;
      const bodyStart = starts[i].index!;
      const bodyEnd = i + 1 < starts.length ? starts[i + 1].index! : src.length;
      const body = src.slice(bodyStart, bodyEnd);
      const adminIdx = body.search(/assertAdmin\(\)/);
      const childIdx = body.search(/requireChild\(/);
      expect(adminIdx, `${name}: assertAdmin() call not found`).toBeGreaterThanOrEqual(0);
      expect(childIdx, `${name}: requireChild() call not found`).toBeGreaterThanOrEqual(0);
      expect(
        adminIdx,
        `${name}: assertAdmin() must run before requireChild()`,
      ).toBeLessThan(childIdx);
    }
    // Sanity: the ordering check actually exercised both actions above,
    // not an empty set (would pass vacuously otherwise).
    const exercised = starts.filter((s) =>
      ADMIN_THEN_CHILD_ACTIONS.includes(s[1]),
    );
    expect(exercised.length).toBe(ADMIN_THEN_CHILD_ACTIONS.length);
  });

  it('images.ts gates every exported function on assertAdmin (F7)', () => {
    const src = read('src/lib/actions/images.ts');
    const starts = [...src.matchAll(/export async function (\w+)\(/g)];
    expect(starts.length).toBeGreaterThan(0);
    for (let i = 0; i < starts.length; i++) {
      const bodyStart = starts[i].index!;
      const bodyEnd = i + 1 < starts.length ? starts[i + 1].index! : src.length;
      const body = src.slice(bodyStart, bodyEnd);
      expect(body).toMatch(/assertAdmin\(\)/);
    }
  });

  it('no file under src/app/parent references /parent/stage/new or /parent/week/new — the routes moved to /admin (F2)', () => {
    const files = walk(join(ROOT, 'src/app/parent'));
    const offenders = files.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return src.includes('/parent/stage/new') || src.includes('/parent/week/new');
    });
    expect(offenders).toEqual([]);
  });

  it('no page file exists at the old /parent stage/new, week/new or week/[id]/review paths (F1)', () => {
    // Content-grepping can't catch this: a page file never contains its own
    // route path, so re-creating one of these routes under src/app/parent
    // would pass a content-only check silently. Assert on the file PATHS
    // returned by the same walk, not just their contents.
    const files = walk(join(ROOT, 'src/app/parent'));
    const offenders = files.filter(
      (f) => /[\\/](week|stage)[\\/]new[\\/]/.test(f) || /[\\/]week[\\/][^/\\]+[\\/]review[\\/]/.test(f),
    );
    expect(offenders).toEqual([]);
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
