'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertParent } from '@/lib/auth/guards';
import {
  createChildProfile,
  deleteChildOwnedBy,
  updateChildOwnedBy,
} from '@/lib/db/children';
import { getDefaultSharedPackId } from '@/lib/db/curriculum';

const currentYear = new Date().getFullYear();

const ChildInputSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(60, 'Name is too long'),
  gender: z
    .union([z.literal('boy'), z.literal('girl'), z.literal('')])
    .nullish()
    .transform((v) => (v == null || v === '' ? null : v)),
  birthYear: z
    .union([z.string().trim(), z.literal('')])
    .transform((v) => (v === '' ? null : Number(v)))
    .pipe(
      z
        .union([z.number().int().min(2000).max(currentYear), z.null()])
        .nullable(),
    ),
});

export type ChildActionState = { error?: string };

export async function createChildAction(
  _prev: ChildActionState,
  formData: FormData,
): Promise<ChildActionState> {
  const parsed = ChildInputSchema.safeParse({
    displayName: formData.get('displayName'),
    gender: formData.get('gender') ?? '',
    birthYear: formData.get('birthYear') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const parent = await assertParent();
  // Auto-enroll the new child in the default shared curriculum pack so the
  // parent doesn't have to author anything before play. If the pack is missing
  // (rare — only happens in a fresh env without the seed), child still gets
  // created but with no enrollment; parent can pick a pack later.
  const defaultPackId = await getDefaultSharedPackId();
  await createChildProfile({
    parentUserId: parent.id,
    displayName: parsed.data.displayName,
    gender: parsed.data.gender,
    birthYear: parsed.data.birthYear,
    currentCurriculumPackId: defaultPackId,
  });

  revalidatePath('/parent/children');
  revalidatePath('/parent');
  return {};
}

export async function updateChildAction(
  childId: string,
  _prev: ChildActionState,
  formData: FormData,
): Promise<ChildActionState> {
  const parsed = ChildInputSchema.safeParse({
    displayName: formData.get('displayName'),
    gender: formData.get('gender') ?? '',
    birthYear: formData.get('birthYear') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const parent = await assertParent();
  const updated = await updateChildOwnedBy(childId, parent.id, {
    displayName: parsed.data.displayName,
    gender: parsed.data.gender,
    birthYear: parsed.data.birthYear,
  });
  if (!updated) {
    return { error: 'Child not found' };
  }

  revalidatePath('/parent/children');
  revalidatePath(`/parent/children/${childId}`);
  return {};
}

export async function deleteChildAction(childId: string): Promise<void> {
  const parent = await assertParent();
  await deleteChildOwnedBy(childId, parent.id);
  revalidatePath('/parent/children');
  revalidatePath('/parent');
  redirect('/parent/children');
}
