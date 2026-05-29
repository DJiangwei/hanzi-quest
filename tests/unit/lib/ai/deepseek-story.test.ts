import { describe, expect, it, vi, beforeEach } from 'vitest';

const aiMock = vi.hoisted(() => ({
  generateObject: vi.fn(),
}));
vi.mock('ai', () => aiMock);

const deepseekMock = vi.hoisted(() => ({
  deepseek: vi.fn(() => 'deepseek-model-handle'),
}));
vi.mock('@ai-sdk/deepseek', () => deepseekMock);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildStoryUserPrompt', () => {
  it('injects the heroAppearance narrative line', async () => {
    const { buildStoryUserPrompt } = await import('@/lib/ai/deepseek-story');
    const prompt = buildStoryUserPrompt({
      heroName: 'Yinuo',
      heroAppearance: 'a red bandana and a striped sailor shirt',
      petHint: 'a chatty parrot',
      availableChars: ['我', '你', '红'],
      newCharsThisWeek: ['红'],
      priorSummary: '- Last chapter ended on the docks.',
      tone: 'triumphant',
    });
    expect(prompt).toContain('Yinuo');
    expect(prompt).toContain('a red bandana');
    expect(prompt).toContain('a chatty parrot');
    expect(prompt).toContain('我, 你, 红');
    expect(prompt).toContain('红');
    expect(prompt).toContain('triumphant');
    expect(prompt).toContain('Last chapter ended');
  });

  it('uses the first-chapter fallback when priorSummary is empty', async () => {
    const { buildStoryUserPrompt } = await import('@/lib/ai/deepseek-story');
    const prompt = buildStoryUserPrompt({
      heroName: 'Yinuo',
      heroAppearance: 'a young pirate kid',
      petHint: null,
      availableChars: ['我'],
      newCharsThisWeek: ['我'],
      priorSummary: '',
      tone: 'standard',
    });
    expect(prompt).toContain('first chapter');
  });
});

describe('generateStoryChapterWithAI', () => {
  it('calls generateObject with the deepseek model + system + user prompts', async () => {
    aiMock.generateObject.mockResolvedValueOnce({
      object: {
        body_zh: '小红花开。',
        body_en: 'A small red flower bloomed.',
        summary_for_next: '- She picked the red flower.',
      },
    });
    const { generateStoryChapterWithAI } = await import(
      '@/lib/ai/deepseek-story'
    );
    const result = await generateStoryChapterWithAI({
      heroName: 'Yinuo',
      heroAppearance: 'a young pirate kid',
      petHint: null,
      availableChars: ['我', '红', '花'],
      newCharsThisWeek: ['红', '花'],
      priorSummary: '',
      tone: 'standard',
    });
    expect(result).toEqual({
      bodyZh: '小红花开。',
      bodyEn: 'A small red flower bloomed.',
      summaryForNext: '- She picked the red flower.',
    });
    expect(aiMock.generateObject).toHaveBeenCalledOnce();
    const call = aiMock.generateObject.mock.calls[0]![0];
    expect(call.model).toBe('deepseek-model-handle');
    expect(call.system).toContain("children's book author");
    expect(call.prompt).toContain('Yinuo');
  });

  it('throws StoryGenerationError on parse failure', async () => {
    aiMock.generateObject.mockRejectedValueOnce(new Error('schema mismatch'));
    const { generateStoryChapterWithAI } = await import(
      '@/lib/ai/deepseek-story'
    );
    const { StoryGenerationError } = await import(
      '@/lib/errors/story-errors'
    );
    await expect(
      generateStoryChapterWithAI({
        heroName: 'Yinuo',
        heroAppearance: 'a young pirate kid',
        petHint: null,
        availableChars: ['我'],
        newCharsThisWeek: ['我'],
        priorSummary: '',
        tone: 'standard',
      }),
    ).rejects.toThrow(StoryGenerationError);
  });
});
