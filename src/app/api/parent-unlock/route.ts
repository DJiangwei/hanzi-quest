import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import {
  getParentSettings,
  setParentPin,
  recordFailedAttempt,
  clearFailedAttempts,
} from '@/lib/db/parent-settings';
import { hashPin, verifyPin, isLocked } from '@/lib/auth/parent-pin';

const COOKIE_MAX_AGE_SECONDS = 15 * 60;

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { pin?: string; mode?: 'set' | 'verify'; next?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_body' }, { status: 400 });
  }

  const pin = body.pin ?? '';
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'invalid_format' }, { status: 400 });
  }

  const settings = await getParentSettings(userId);

  // First-time SET: no row, treat first-ever POST as set.
  if (!settings) {
    const hash = await hashPin(pin);
    await setParentPin(userId, hash);
    await setUnlockCookie();
    return NextResponse.json({ status: 'set', next: body.next ?? '/parent' });
  }

  // Locked?
  if (isLocked(settings.lockedUntil)) {
    return NextResponse.json(
      { error: 'locked', until: settings.lockedUntil },
      { status: 423 },
    );
  }

  // Verify
  const ok = await verifyPin(pin, settings.parentPinHash);
  if (!ok) {
    await recordFailedAttempt(userId, settings.failedAttempts);
    return NextResponse.json({ error: 'wrong_pin' }, { status: 401 });
  }

  await clearFailedAttempts(userId);
  await setUnlockCookie();
  return NextResponse.json({ status: 'ok', next: body.next ?? '/parent' });
}

async function setUnlockCookie(): Promise<void> {
  const jar = await cookies();
  jar.set('parent_unlocked', '1', {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });
}
