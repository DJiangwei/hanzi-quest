'use client';

import { useState } from 'react';

interface Props {
  mode: 'set' | 'verify';
  next: string;
}

export function ParentUnlockForm({ mode, next }: Props) {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be 4 digits.');
      return;
    }
    if (mode === 'set' && pin !== pin2) {
      setError('PINs do not match.');
      return;
    }

    setSubmitting(true);
    const res = await fetch('/api/parent-unlock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin, mode, next }),
    });
    setSubmitting(false);

    if (res.status === 423) {
      setError('Too many wrong tries. Please wait 5 minutes.');
      return;
    }
    if (!res.ok) {
      setError(mode === 'set' ? 'Could not set PIN.' : 'Wrong PIN.');
      return;
    }
    const json = await res.json();
    window.location.href = json.next ?? '/parent';
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col items-center gap-3">
      <input
        type="password"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        className="w-40 rounded-2xl border-2 border-[var(--color-ocean-300)] bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-[var(--color-ocean-900)] focus:border-[var(--color-ocean-500)] focus:outline-none"
        aria-label="PIN"
      />
      {mode === 'set' && (
        <input
          type="password"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={pin2}
          onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
          placeholder="确认 / Confirm"
          className="w-40 rounded-2xl border-2 border-[var(--color-ocean-300)] bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-[var(--color-ocean-900)] focus:border-[var(--color-ocean-500)] focus:outline-none"
          aria-label="Confirm PIN"
        />
      )}
      {error && <p className="text-sm text-[var(--color-rust-600)]">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-[var(--color-ocean-500)] px-6 py-2.5 text-sm font-bold text-white shadow-md transition-transform active:scale-95 disabled:opacity-60"
      >
        {submitting ? '...' : mode === 'set' ? '设置 / Set' : '解锁 / Unlock'}
      </button>
    </form>
  );
}
