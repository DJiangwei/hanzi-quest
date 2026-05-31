import { deepseek } from '@ai-sdk/deepseek';
import { generateObject } from 'ai';
import { z } from 'zod';
import { StoryGenerationError } from '@/lib/errors/story-errors';

const MODEL_ID = 'deepseek-v4-pro';
const model = deepseek(MODEL_ID);

export const StoryChapterOutputSchema = z.object({
  body_zh: z.string().min(1),
  body_en: z.string().min(1),
  summary_for_next: z.string().min(1),
});

export type StoryToneLiteral = 'triumphant' | 'standard' | 'narrow_escape';

export interface BuildPromptInput {
  heroName: string;
  heroAppearance: string;
  petHint: string | null;
  availableChars: string[];
  newCharsThisWeek: string[];
  priorSummary: string;
  tone: StoryToneLiteral;
}

const SYSTEM_PROMPT = `You are a children's book author writing a bilingual pirate adventure chapter book for a 6-year-old English-native heritage learner of Mandarin Chinese. The hero is always the same child. Each chapter is a short scene in their ongoing adventure.

Output strict JSON with three fields:
- body_zh: Chinese text, 2-3 short sentences. Use only Chinese characters from the provided "available characters" list. Favor characters from "this week's new vocab" — they should appear at least once each. Sentences must be natural and readable at age-6 level.
- body_en: English text, 40-60 words. Tells the same scene as body_zh but with richer detail and warmth. Names characters and places by name. Conveys the requested tone strongly.
- summary_for_next: 2 bullets (each prefixed "- ") summarizing what just happened in this chapter, written so the next chapter's author can pick up the thread. Mention any objects, allies, or locations introduced.

Do not use any character outside the available list in body_zh. Do not write more than 3 sentences in body_zh.`;

const TONE_INSTRUCTIONS: Record<StoryToneLiteral, string> = {
  triumphant:
    'Yinuo crushed the boss with no mistakes. Write a victorious scene where she emerges in glory, the crew cheers, the treasure is rich.',
  standard:
    "Yinuo cleared the boss with a few stumbles. Write a satisfying scene where she finds what she's looking for through cleverness.",
  narrow_escape:
    'Yinuo barely cleared the boss. Write a scene where things went sideways but she scraped through with quick thinking. The treasure is modest but real.',
};

export function buildStoryUserPrompt(input: BuildPromptInput): string {
  const petLine = input.petHint
    ? `Her companion is ${input.petHint}.`
    : '';
  const priorLine = input.priorSummary.trim()
    ? `Previous chapter ended with:\n${input.priorSummary}`
    : 'Previous chapter ended with:\n[This is the first chapter — start the adventure on the docks of a sunny port town.]';
  return [
    `Hero name: ${input.heroName}`,
    `Hero appearance: ${input.heroAppearance}. ${petLine}`.trim(),
    '',
    'Available Chinese characters (use only these in body_zh):',
    input.availableChars.join(', '),
    '',
    "This week's new vocab (favor these in body_zh):",
    input.newCharsThisWeek.join(', '),
    '',
    priorLine,
    '',
    `Tone for this chapter: ${input.tone}`,
    TONE_INSTRUCTIONS[input.tone],
    '',
    'Output strict JSON only. No commentary.',
  ].join('\n');
}

export interface StoryChapterOutput {
  bodyZh: string;
  bodyEn: string;
  summaryForNext: string;
}

export async function generateStoryChapterWithAI(
  input: BuildPromptInput,
): Promise<StoryChapterOutput> {
  try {
    const { object } = await generateObject({
      model,
      schema: StoryChapterOutputSchema,
      system: SYSTEM_PROMPT,
      prompt: buildStoryUserPrompt(input),
    });
    return {
      bodyZh: object.body_zh,
      bodyEn: object.body_en,
      summaryForNext: object.summary_for_next,
    };
  } catch (err) {
    throw new StoryGenerationError(
      `DeepSeek story generation failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
      err,
    );
  }
}
