import { redirect } from 'next/navigation';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';

/**
 * Base parent layout — AUTH ONLY (sign-in gate). The 4-digit PIN gate lives in
 * the `(secured)` route group's layout, NOT here, so that `/parent/unlock`
 * (which renders directly under THIS layout) is reachable without being gated.
 * Putting the PIN redirect here caused an infinite `/parent/unlock → /parent/unlock`
 * redirect loop once the unlock cookie expired (the unlock page re-triggered its
 * own gate). See `(secured)/layout.tsx`.
 */
export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await ensureUserBootstrapped();
  if (!user) redirect('/sign-in');

  return <div className="flex flex-1 flex-col bg-[var(--color-sand-50)]">{children}</div>;
}
