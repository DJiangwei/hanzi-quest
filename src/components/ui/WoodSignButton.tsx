'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Size = 'sm' | 'md' | 'lg';
type Variant = 'primary' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: Size;
  variant?: Variant;
}

const sizeMap: Record<Size, string> = {
  sm: 'px-5 py-2 text-sm',
  md: 'px-7 py-3 text-base',
  lg: 'px-9 py-5 text-lg',
};

const primaryBase =
  // grain stripes via repeating gradient + warm wood gradient
  "relative bg-[linear-gradient(180deg,#d6a868_0%,#b07f3e_100%)] " +
  // overlay grain (CSS background isn't composable cleanly without inline style — we layer with before)
  'text-[#fff8e1] font-extrabold rounded-2xl ' +
  'border-2 border-[#6b4720] ' +
  'shadow-[inset_0_-3px_0_rgba(107,71,32,0.3),0_4px_0_#6b4720,0_6px_14px_rgba(0,0,0,0.25)] ' +
  '[text-shadow:0_1px_0_rgba(0,0,0,0.35)] ' +
  'transition-transform duration-150 active:translate-y-0.5 active:shadow-[inset_0_-2px_0_rgba(107,71,32,0.3),0_1px_0_#6b4720,0_2px_6px_rgba(0,0,0,0.2)] ' +
  'hover:-translate-y-px ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ocean-500)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-sand-50)]';

const ghostBase =
  'relative bg-transparent text-[var(--color-sand-900)] font-bold rounded-2xl ' +
  'border-2 border-[#6b4720]/60 ' +
  'transition-colors hover:bg-[var(--color-sand-100)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ocean-500)] focus-visible:ring-offset-2';

const nailPseudoClasses =
  'before:content-[""] before:absolute before:top-1/2 before:left-2 before:-translate-y-1/2 before:w-1 before:h-1 before:rounded-full before:bg-[#4a2e10] ' +
  'after:content-[""] after:absolute after:top-1/2 after:right-2 after:-translate-y-1/2 after:w-1 after:h-1 after:rounded-full after:bg-[#4a2e10]';

export const WoodSignButton = forwardRef<HTMLButtonElement, Props>(
  function WoodSignButton({ size = 'md', variant = 'primary', className = '', children, ...rest }, ref) {
    const base = variant === 'primary' ? primaryBase : ghostBase;
    const nails = variant === 'primary' ? nailPseudoClasses : '';
    return (
      <button
        ref={ref}
        type={rest.type ?? 'button'}
        className={[base, sizeMap[size], nails, className].filter(Boolean).join(' ')}
        {...rest}
      >
        {/* grain stripes layer — sits under the text via z-index */}
        {variant === 'primary' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              backgroundImage:
                'repeating-linear-gradient(180deg, transparent 0, transparent 5px, rgba(107,71,32,0.12) 5px, rgba(107,71,32,0.12) 6px)',
            }}
          />
        )}
        <span className="relative">{children}</span>
      </button>
    );
  },
);
