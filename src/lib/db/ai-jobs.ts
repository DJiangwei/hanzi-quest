import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { aiJobs } from '@/db/schema';

export type AiJobRow = typeof aiJobs.$inferSelect;

export async function createJob(input: {
  kind: 'generate_week' | 'regenerate_char' | 'generate_sentence';
  inputJson: Record<string, unknown>;
  model: string;
}): Promise<AiJobRow> {
  const [row] = await db
    .insert(aiJobs)
    .values({
      kind: input.kind,
      input: input.inputJson,
      status: 'running',
      model: input.model,
    })
    .returning();
  return row;
}

export async function completeJob(
  id: string,
  patch: {
    output: unknown;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
  },
): Promise<void> {
  await db
    .update(aiJobs)
    .set({
      status: 'succeeded',
      output: patch.output as Record<string, unknown>,
      tokensIn: patch.tokensIn ?? null,
      tokensOut: patch.tokensOut ?? null,
      costUsd:
        patch.costUsd !== undefined ? patch.costUsd.toFixed(4) : null,
      updatedAt: sql`now()`,
    })
    .where(eq(aiJobs.id, id));
}

export async function failJob(id: string, error: string): Promise<void> {
  await db
    .update(aiJobs)
    .set({
      status: 'failed',
      error,
      updatedAt: sql`now()`,
    })
    .where(eq(aiJobs.id, id));
}
