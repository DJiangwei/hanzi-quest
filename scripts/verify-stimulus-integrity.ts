// Read-only audit for the 2026-08-23 看图找字 stimulus-validity fix
// (docs/superpowers/specs/2026-08-23-image-stimulus-validity-design.md). Checks
// every COMPILED `image_pick` week_levels row against the same two
// disqualifiers `validStimulusWords` (src/lib/scenes/stimulus-validity.ts)
// enforces at compile time — this script re-derives ownership straight from
// the DB rather than trusting scene_config, so it's an audit of the compiled
// output, not a re-read of the same cache. A third check catches the
// "compile fell back to no wordId at all" degradation path, which measurement
// says never fires against the real corpus (see stimulus-validity.ts) — if it
// ever does, someone needs to know.
//
// Usage: pnpm tsx scripts/verify-stimulus-integrity.ts   → PASS/FAIL report, exit 1 on any FAIL.
import { config as loadEnv } from 'dotenv';

interface ImagePickLevel {
  week_id: string;
  week_number: number;
  label: string;
  level_key: string;
  scene_config: { characterId?: string; wordId?: string } | null;
}

interface Issue {
  weekNumber: number;
  label: string;
  levelKey: string;
  kind: 'ambiguous' | 'count-dependent' | 'degraded' | 'orphan-character';
  detail: string;
}

interface WeekSummary {
  weekNumber: number;
  label: string;
  levels: number;
  issues: number;
}

async function main() {
  loadEnv({ path: '.env.local' });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  const host = new URL(process.env.DATABASE_URL).hostname.split('.')[0];
  console.log(`Stimulus integrity checks against ${host}\n`);

  // Dynamic imports AFTER env load (hard rule #5). stimulus-validity.ts is
  // pure (no @/db), safe to import from a script.
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const { isCountingChar } = await import('../src/lib/scenes/stimulus-validity');

  // Every compiled image_pick level, whatever week it belongs to (compiled
  // rows only exist post-authoring, so this is implicitly "published or
  // ai_generated-then-compiled" — no separate status filter needed).
  const levels = await sql<ImagePickLevel[]>`
    SELECT wl.week_id, w.week_number, w.label, wl.level_key, wl.scene_config
    FROM week_levels wl
    JOIN scene_templates st ON st.id = wl.scene_template_id
    JOIN weeks w ON w.id = wl.week_id
    WHERE st.type = 'image_pick'
    ORDER BY w.week_number, wl.level_key
  `;

  if (levels.length === 0) {
    console.log('No compiled image_pick levels found — nothing to check.');
    await sql.end();
    return;
  }

  // characterId -> hanzi, for every character (small table, cheap to load whole).
  const charRows = await sql<{ id: string; hanzi: string }[]>`
    SELECT id, hanzi FROM characters
  `;
  const hanziById = new Map(charRows.map((r) => [r.id, r.hanzi]));

  // Word ownership, rebuilt fresh from the DB (mirrors compile-week.ts's
  // buildWordOwners, but this is the ground truth being audited against, not
  // a copy of it): for each week, word TEXT -> the set of hanzi taught that
  // week that own it, and wordId -> its text (to resolve a compiled wordId).
  const ownershipRows = await sql<
    { week_id: string; hanzi: string; word_id: string; word_text: string }[]
  >`
    SELECT wc.week_id, c.hanzi, wd.id AS word_id, wd.text AS word_text
    FROM week_characters wc
    JOIN characters c ON c.id = wc.character_id
    JOIN character_word cw ON cw.character_id = c.id
    JOIN words wd ON wd.id = cw.word_id
  `;
  const ownersByWeek = new Map<string, Map<string, Set<string>>>();
  const wordTextByWeek = new Map<string, Map<string, string>>();
  for (const r of ownershipRows) {
    const owners = ownersByWeek.get(r.week_id) ?? new Map<string, Set<string>>();
    const ownerSet = owners.get(r.word_text) ?? new Set<string>();
    ownerSet.add(r.hanzi);
    owners.set(r.word_text, ownerSet);
    ownersByWeek.set(r.week_id, owners);

    const texts = wordTextByWeek.get(r.week_id) ?? new Map<string, string>();
    texts.set(r.word_id, r.word_text);
    wordTextByWeek.set(r.week_id, texts);
  }

  await sql.end();

  const issues: Issue[] = [];
  const weekSummaries = new Map<string, WeekSummary>();

  for (const lvl of levels) {
    const summaryKey = lvl.week_id;
    const summary =
      weekSummaries.get(summaryKey) ??
      ({ weekNumber: lvl.week_number, label: lvl.label, levels: 0, issues: 0 } as WeekSummary);
    summary.levels++;
    weekSummaries.set(summaryKey, summary);

    const cfg = lvl.scene_config ?? {};
    const characterId = cfg.characterId;
    const wordId = cfg.wordId;
    const hanzi = characterId ? hanziById.get(characterId) : undefined;

    if (!characterId || !hanzi) {
      issues.push({
        weekNumber: lvl.week_number,
        label: lvl.label,
        levelKey: lvl.level_key,
        kind: 'orphan-character',
        detail: `characterId ${characterId ?? '(missing)'} not found in characters`,
      });
      summary.issues++;
      continue;
    }

    const counting = isCountingChar(hanzi);

    // Count-dependent: a counting character should render procedurally
    // (Task 3's CountingBalloons) and never carry a diffusion wordId at all.
    if (counting && wordId) {
      issues.push({
        weekNumber: lvl.week_number,
        label: lvl.label,
        levelKey: lvl.level_key,
        kind: 'count-dependent',
        detail: `${hanzi} is a counting character but compiled a wordId (${wordId}) — should have none`,
      });
      summary.issues++;
    }

    // Silently degraded: a non-counting character with no wordId fell through
    // compile-week's "no valid word" fallback, which leaves pickStimulusImage's
    // unguarded first-with-URL scan in charge at render time — exactly the
    // failure mode this whole fix exists to close.
    if (!counting && !wordId) {
      issues.push({
        weekNumber: lvl.week_number,
        label: lvl.label,
        levelKey: lvl.level_key,
        kind: 'degraded',
        detail: `${hanzi} has no compiled wordId — render falls back to the unguarded first-word-with-a-URL scan`,
      });
      summary.issues++;
    }

    // Ambiguous: the compiled word's text is linked to ≥2 characters taught
    // this same week, so a distractor drawn from the pool could also be correct.
    if (wordId) {
      const text = wordTextByWeek.get(lvl.week_id)?.get(wordId);
      const owners = text ? ownersByWeek.get(lvl.week_id)?.get(text) : undefined;
      if (owners && owners.size > 1) {
        issues.push({
          weekNumber: lvl.week_number,
          label: lvl.label,
          levelKey: lvl.level_key,
          kind: 'ambiguous',
          detail: `word "${text}" (compiled for ${hanzi}) is also taught by ${[...owners]
            .filter((h) => h !== hanzi)
            .join('/')} this week — no unique correct answer`,
        });
        summary.issues++;
      }
    }
  }

  // Per-week table so a human can see where a failure is at a glance.
  console.log('Week  Label                                    levels  bad');
  console.log('----  ---------------------------------------  ------  ---');
  const sorted = [...weekSummaries.values()].sort((a, b) => a.weekNumber - b.weekNumber);
  for (const w of sorted) {
    const mark = w.issues > 0 ? '❌' : '  ';
    console.log(
      `${mark}W${String(w.weekNumber).padEnd(3)} ${w.label.padEnd(40)} ${String(w.levels).padStart(6)}  ${String(w.issues).padStart(3)}`,
    );
  }

  if (issues.length > 0) {
    console.log(`\n${issues.length} bad stimuli found:\n`);
    for (const iss of issues) {
      console.log(`  ❌ W${iss.weekNumber} ${iss.label} [${iss.levelKey}] (${iss.kind}): ${iss.detail}`);
    }
  }

  console.log(
    `\n${issues.length === 0 ? '✅ PASS' : '❌ FAIL'} — ${levels.length} image_pick levels checked across ${sorted.length} weeks, ${issues.length} bad stimuli`,
  );
  if (issues.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
