// Pure error classes for the story-mode flow — safe to import from client
// components per the 'use server'-file landmine in CLAUDE.md. No DB /
// postgres imports here.

export class StoryGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StoryGenerationError';
  }
}

export class ChapterNotReadyError extends Error {
  constructor(public readonly weekId: string) {
    super(`Chapter not ready for week ${weekId}`);
    this.name = 'ChapterNotReadyError';
  }
}
