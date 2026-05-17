// src/components/ui/TreasureMapBackdrop.tsx
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  intensity?: 'medium' | 'subtle';
}

export function TreasureMapBackdrop({ children, intensity = 'medium' }: Props) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          intensity === 'medium'
            ? 'radial-gradient(ellipse at 30% 20%, rgba(200,159,94,0.12) 0%, transparent 50%), linear-gradient(180deg, #f5ead0 0%, #e6cb8e 100%)'
            : 'radial-gradient(ellipse at 30% 20%, rgba(200,159,94,0.10) 0%, transparent 50%), linear-gradient(180deg, #f5ead0 0%, #ead7a8 100%)',
      }}
    >
      {intensity === 'medium' && (
        <svg
          aria-hidden="true"
          viewBox="0 0 300 320"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
        >
          <path
            data-testid="map-route"
            d="M 20 280 Q 80 220 130 250 T 250 180 Q 280 140 270 90"
            fill="none"
            stroke="#6b4720"
            strokeWidth={2}
            strokeDasharray="4 6"
            opacity={0.5}
          />
          <g data-testid="map-compass" transform="translate(40 40)" fill="#6b4720" opacity={0.4}>
            <polygon points="0,-18 5,0 0,18 -5,0" />
            <polygon points="-18,0 0,5 18,0 0,-5" />
            <circle r={3} />
          </g>
        </svg>
      )}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center w-full">
        {children}
      </div>
    </div>
  );
}
