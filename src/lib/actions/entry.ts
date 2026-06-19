'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';
import { listChildrenForUser } from '@/lib/db/children';
import {
  ENTRY_COOKIE,
  ENTRY_MAX_AGE_SECONDS,
  kidEntryValue,
} from '@/lib/auth/entry-pref';

async function setEntryPref(value: string): Promise<void> {
  const jar = await cookies();
  jar.set(ENTRY_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ENTRY_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });
}

/**
 * Remember "enter the kid game as <childId>" and go there (no PIN). Validates
 * the child belongs to the signed-in user before storing/redirecting.
 */
export async function chooseKidEntryAction(childId: string): Promise<void> {
  const user = await ensureUserBootstrapped();
  if (!user) redirect('/sign-in');
  const children = await listChildrenForUser(user.id);
  const child = children.find((c) => c.id === childId);
  if (!child) redirect('/'); // not owned → re-show the chooser
  await setEntryPref(kidEntryValue(child.id));
  redirect(`/play/${child.id}`);
}

/**
 * Remember "enter parent control" and go to `/parent` (the secured layout then
 * applies the 4-digit PIN gate).
 */
export async function chooseParentEntryAction(): Promise<void> {
  const user = await ensureUserBootstrapped();
  if (!user) redirect('/sign-in');
  await setEntryPref('parent');
  redirect('/parent');
}
