/**
 * Preview the AI-generated week content for a list of characters.
 *
 * Usage:
 *   pnpm tsx scripts/preview-week-gen.ts <space-separated chars> [--label <text>]
 *
 * Example:
 *   pnpm tsx scripts/preview-week-gen.ts 人 口 大 中 小 哭 笑 一 上 下 --label "Lesson 1-1"
 *
 * Reads-only: does not write to the database. Useful for iterating on the
 * prompt or the model choice before productising.
 */

import { deepseek } from '@ai-sdk/deepseek';
import { generateObject } from 'ai';
import { config as loadEnv } from 'dotenv';
import {
  GENERATE_WEEK_SYSTEM_PROMPT,
  buildUserPrompt,
} from '../src/lib/ai/prompts/generate-week-v1';
import { WeekContentSchemaV1 } from '../src/lib/ai/schemas';
import { extractHanzi } from '../src/lib/hanzi/extract';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DEEPSEEK_API_KEY) {
  console.error('DEEPSEEK_API_KEY not set in .env.local');
  process.exit(2);
}

const MODEL = deepseek('deepseek-v4-pro');
const MODEL_LABEL = 'deepseek/deepseek-v4-pro';

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let label = 'Preview';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--label' && argv[i + 1]) {
      label = argv[i + 1];
      i++;
    } else {
      positional.push(argv[i]);
    }
  }
  const chars = extractHanzi(positional.join(' '));
  return { chars, label };
}

async function main() {
  const { chars, label } = parseArgs(process.argv.slice(2));
  if (chars.length === 0) {
    console.error('Pass at least one Chinese character.');
    process.exit(2);
  }
  console.error(
    `[gen] ${chars.length} chars · model=${MODEL_LABEL} · label="${label}"`,
  );
  console.error(`[gen] chars: ${chars.join(' ')}`);

  const t0 = Date.now();
  const result = await generateObject({
    model: MODEL,
    schema: WeekContentSchemaV1,
    schemaName: 'WeekContent',
    schemaDescription:
      'Per-character pinyin, three example words, one example sentence, and an image hook for a weekly batch of Chinese characters.',
    system: GENERATE_WEEK_SYSTEM_PROMPT,
    prompt: buildUserPrompt({ characters: chars, childAge: 6, weekLabel: label }),
    temperature: 0.4,
  });
  const ms = Date.now() - t0;
  console.error(
    `[gen] done in ${ms}ms · tokens in=${result.usage.inputTokens} out=${result.usage.outputTokens}`,
  );

  console.log('\n=== AI OUTPUT ===\n');
  for (const c of result.object.perCharacter) {
    console.log(`【${c.hanzi}】 ${c.pinyin.join(' ')} — ${c.meaningEn} / ${c.meaningZh}`);
    for (const w of c.words) {
      console.log(`  · ${w.word.padEnd(6)} ${w.pinyin.join(' ').padEnd(20)} ${w.meaningEn}`);
    }
    console.log(`  ✎ ${c.sentence.text}`);
    console.log(`    ${c.sentence.pinyin.join(' ')}`);
    console.log(`    ${c.sentence.meaningEn}`);
    console.log(`  🎨 ${c.imageHook}\n`);
  }

  console.log('---\nFull JSON:\n');
  console.log(JSON.stringify(result.object, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
