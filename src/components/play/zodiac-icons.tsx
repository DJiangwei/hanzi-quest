// src/components/play/zodiac-icons.tsx
import type { CSSProperties } from 'react';

export const ZODIAC_SLUGS = [
  'rat',
  'ox',
  'tiger',
  'rabbit',
  'dragon',
  'snake',
  'horse',
  'sheep',
  'monkey',
  'rooster',
  'dog',
  'pig',
] as const;

export type ZodiacSlug = (typeof ZODIAC_SLUGS)[number];

export const ZODIAC_HANZI: Record<ZodiacSlug, string> = {
  rat: '鼠', ox: '牛', tiger: '虎', rabbit: '兔', dragon: '龙', snake: '蛇',
  horse: '马', sheep: '羊', monkey: '猴', rooster: '鸡', dog: '狗', pig: '猪',
};

export const ZODIAC_NAME_EN: Record<ZodiacSlug, string> = {
  rat: 'Rat', ox: 'Ox', tiger: 'Tiger', rabbit: 'Rabbit', dragon: 'Dragon', snake: 'Snake',
  horse: 'Horse', sheep: 'Sheep', monkey: 'Monkey', rooster: 'Rooster', dog: 'Dog', pig: 'Pig',
};

const hiddenSvg: CSSProperties = { position: 'absolute' };

export function ZodiacIconDefs() {
  return (
    <svg width="0" height="0" style={hiddenSvg} aria-hidden="true">
      <defs>
        {/* 1. Rat — warm gray body, pink inner ears, pink-tinged tail base */}
        <symbol id="z-rat" viewBox="0 0 64 64">
          <ellipse cx="32" cy="40" rx="14" ry="10" fill="#6b5b4a" />
          <circle cx="22" cy="29" r="9" fill="#6b5b4a" />
          <circle cx="16" cy="21" r="4" fill="#6b5b4a" />
          <circle cx="26" cy="21" r="4" fill="#6b5b4a" />
          <circle cx="16" cy="21" r="2" fill="#e8a8a8" />
          <circle cx="26" cy="21" r="2" fill="#e8a8a8" />
          <circle cx="20" cy="30" r="1.6" fill="#0c3d3a" />
          <path d="M 45 41 Q 56 41 56 30 Q 56 23 50 23" stroke="#6b5b4a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse cx="32" cy="44" rx="3" ry="1.5" fill="#e8a8a8" />
        </symbol>

        {/* 2. Ox — deep brown 3/4 head, cream horns + muzzle */}
        <symbol id="z-ox" viewBox="0 0 64 64">
          <path d="M 18 22 Q 8 18 6 6" stroke="#fef9ef" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <path d="M 46 22 Q 56 18 58 6" stroke="#fef9ef" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <ellipse cx="14" cy="30" rx="5" ry="3" fill="#6b3914" transform="rotate(-25 14 30)" />
          <ellipse cx="50" cy="30" rx="5" ry="3" fill="#6b3914" transform="rotate(25 50 30)" />
          <path d="M 18 30 Q 18 22 32 22 Q 46 22 46 30 L 48 46 Q 46 54 32 54 Q 18 54 16 46 Z" fill="#6b3914" />
          <path d="M 28 22 Q 30 18 32 22 Q 34 18 36 22" stroke="#2a1a08" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <ellipse cx="32" cy="46" rx="12" ry="6" fill="#fef9ef" />
          <ellipse cx="28" cy="46" rx="1.4" ry="2.2" fill="#6b3914" />
          <ellipse cx="36" cy="46" rx="1.4" ry="2.2" fill="#6b3914" />
          <path d="M 28 51 Q 32 53 36 51" stroke="#6b3914" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <circle cx="26" cy="34" r="2" fill="#fef9ef" />
          <circle cx="38" cy="34" r="2" fill="#fef9ef" />
          <circle cx="26" cy="34" r="1.1" fill="#0c3d3a" />
          <circle cx="38" cy="34" r="1.1" fill="#0c3d3a" />
        </symbol>

        {/* 3. Tiger — sunset orange body, dark stripes, cream face, 王 forehead */}
        <symbol id="z-tiger" viewBox="0 0 64 64">
          <circle cx="32" cy="34" r="16" fill="#ed7536" />
          <path d="M 18 22 L 21 14 L 24 22 Z" fill="#ed7536" />
          <path d="M 40 22 L 43 14 L 46 22 Z" fill="#ed7536" />
          <circle cx="20.5" cy="20" r="1.8" fill="#2a1a08" />
          <circle cx="43.5" cy="20" r="1.8" fill="#2a1a08" />
          <ellipse cx="32" cy="38" rx="11" ry="8" fill="#fef9ef" />
          <circle cx="26" cy="32" r="2" fill="#2a1a08" />
          <circle cx="38" cy="32" r="2" fill="#2a1a08" />
          <ellipse cx="32" cy="40" rx="2.5" ry="1.6" fill="#2a1a08" />
          <path d="M 28 44 Q 32 46 36 44" stroke="#2a1a08" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M 14 30 L 18 30 M 14 36 L 18 36 M 14 42 L 18 42" stroke="#2a1a08" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 46 30 L 50 30 M 46 36 L 50 36 M 46 42 L 50 42" stroke="#2a1a08" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 28 24 L 36 24 M 30 27 L 34 27 M 28 30 L 36 30 M 32 24 L 32 30" stroke="#2a1a08" strokeWidth="1.5" strokeLinecap="round" />
        </symbol>

        {/* 4. Rabbit — cream body, pink inner ears, gray outline */}
        <symbol id="z-rabbit" viewBox="0 0 64 64">
          <ellipse cx="32" cy="44" rx="14" ry="11" fill="#fef9ef" stroke="#6b5b4a" strokeWidth="1.5" />
          <circle cx="32" cy="30" r="10" fill="#fef9ef" stroke="#6b5b4a" strokeWidth="1.5" />
          <ellipse cx="26" cy="14" rx="3.5" ry="10" fill="#fef9ef" stroke="#6b5b4a" strokeWidth="1.5" />
          <ellipse cx="38" cy="14" rx="3.5" ry="10" fill="#fef9ef" stroke="#6b5b4a" strokeWidth="1.5" />
          <ellipse cx="26" cy="15" rx="2" ry="7" fill="#f4a8a8" />
          <ellipse cx="38" cy="15" rx="2" ry="7" fill="#f4a8a8" />
          <circle cx="28" cy="30" r="1.5" fill="#0c3d3a" />
          <circle cx="36" cy="30" r="1.5" fill="#0c3d3a" />
          <ellipse cx="32" cy="33.5" rx="1.5" ry="1" fill="#f4a8a8" />
          <path d="M 30 36 Q 32 38 34 36" stroke="#6b5b4a" strokeWidth="2" fill="none" strokeLinecap="round" />
        </symbol>

        {/* 5. Dragon — serpentine emerald body, gold scales, horns + whiskers */}
        <symbol id="z-dragon" viewBox="0 0 64 64">
          <path d="M 6 52 Q 12 42 22 44 Q 32 46 36 38 Q 40 30 50 30" stroke="#1e7e4a" strokeWidth="10" fill="none" strokeLinecap="round" />
          <circle cx="14" cy="46" r="1.6" fill="#f5c537" />
          <circle cx="22" cy="42" r="1.6" fill="#f5c537" />
          <circle cx="30" cy="42" r="1.6" fill="#f5c537" />
          <circle cx="36" cy="36" r="1.6" fill="#f5c537" />
          <circle cx="42" cy="32" r="1.6" fill="#f5c537" />
          <path d="M 6 52 Q 2 50 2 56 Q 4 58 8 56 Z" fill="#1e7e4a" />
          <ellipse cx="54" cy="26" rx="8" ry="6.5" fill="#1e7e4a" />
          <path d="M 58 30 L 62 30 L 60 34 Z" fill="#1e7e4a" />
          <path d="M 50 22 Q 46 14 50 10" stroke="#1e7e4a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M 56 20 Q 56 12 60 10" stroke="#1e7e4a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <circle cx="54" cy="24" r="2.2" fill="#fef9ef" />
          <circle cx="54" cy="24" r="1.1" fill="#0c3d3a" />
          <path d="M 60 30 Q 64 32 62 38" stroke="#1e7e4a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M 58 32 Q 60 38 56 42" stroke="#1e7e4a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </symbol>

        {/* 6. Snake — olive S-curve with gold dots, red tongue */}
        <symbol id="z-snake" viewBox="0 0 64 64">
          <path d="M 14 50 Q 14 36 26 36 Q 38 36 38 24 Q 38 14 48 14" stroke="#6a7d2f" strokeWidth="7" fill="none" strokeLinecap="round" />
          <circle cx="48" cy="14" r="6" fill="#6a7d2f" />
          <circle cx="50" cy="13" r="1.4" fill="#0c3d3a" />
          <circle cx="46" cy="13" r="1.4" fill="#0c3d3a" />
          <path d="M 52 14 L 56 11 M 56 17 L 52 14" stroke="#d83d3d" strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="18" cy="46" r="2" fill="#f5c537" />
          <circle cx="26" cy="38" r="2" fill="#f5c537" />
          <circle cx="34" cy="32" r="2" fill="#f5c537" />
          <circle cx="38" cy="24" r="2" fill="#f5c537" />
          <circle cx="44" cy="16" r="2" fill="#f5c537" />
        </symbol>

        {/* 7. Horse — chibi cute: big round head, big eyes, blush, smile */}
        <symbol id="z-horse" viewBox="0 0 64 64">
          <ellipse cx="30" cy="50" rx="14" ry="6" fill="#8b4513" />
          <rect x="20" y="50" width="4" height="6" rx="2" fill="#8b4513" />
          <rect x="28" y="50" width="4" height="6" rx="2" fill="#8b4513" />
          <rect x="36" y="50" width="4" height="6" rx="2" fill="#8b4513" />
          <rect x="20" y="54" width="4" height="2.5" rx="1" fill="#2a1a08" />
          <rect x="28" y="54" width="4" height="2.5" rx="1" fill="#2a1a08" />
          <rect x="36" y="54" width="4" height="2.5" rx="1" fill="#2a1a08" />
          <path d="M 44 48 Q 52 44 50 38 Q 48 42 46 44" stroke="#2a1a08" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="38" cy="30" r="16" fill="#8b4513" />
          <ellipse cx="30" cy="16" rx="3" ry="5" fill="#8b4513" />
          <ellipse cx="44" cy="16" rx="3" ry="5" fill="#8b4513" />
          <ellipse cx="30" cy="17" rx="1.4" ry="3" fill="#e8a8a8" />
          <ellipse cx="44" cy="17" rx="1.4" ry="3" fill="#e8a8a8" />
          <path d="M 33 18 Q 32 14 36 14 Q 38 12 40 14 Q 42 12 44 16" stroke="#2a1a08" strokeWidth="2.5" fill="#2a1a08" strokeLinecap="round" />
          <path d="M 50 22 Q 56 22 54 28 Q 56 28 56 34 Q 54 38 52 38 Z" fill="#2a1a08" />
          <circle cx="32" cy="30" r="3.5" fill="#fef9ef" />
          <circle cx="44" cy="30" r="3.5" fill="#fef9ef" />
          <circle cx="32" cy="31" r="2.4" fill="#0c3d3a" />
          <circle cx="44" cy="31" r="2.4" fill="#0c3d3a" />
          <circle cx="33" cy="30" r="0.9" fill="#fef9ef" />
          <circle cx="45" cy="30" r="0.9" fill="#fef9ef" />
          <circle cx="27" cy="38" r="2.5" fill="#e8a8a8" opacity="0.6" />
          <circle cx="49" cy="38" r="2.5" fill="#e8a8a8" opacity="0.6" />
          <ellipse cx="38" cy="38" rx="6" ry="4.5" fill="#c89f5e" />
          <ellipse cx="35.5" cy="38" rx="0.9" ry="1.3" fill="#2a1a08" />
          <ellipse cx="40.5" cy="38" rx="0.9" ry="1.3" fill="#2a1a08" />
          <path d="M 35 42 Q 38 44 41 42" stroke="#2a1a08" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </symbol>

        {/* 8. Sheep — cream wool body, brown face, brown horns */}
        <symbol id="z-sheep" viewBox="0 0 64 64">
          <path d="M 16 40 Q 14 32 20 30 Q 18 22 28 22 Q 30 16 38 18 Q 46 16 48 24 Q 54 26 52 34 Q 54 42 46 44 Q 44 50 36 48 Q 28 52 22 46 Q 14 46 16 40 Z" fill="#fef9ef" stroke="#6b5b4a" strokeWidth="1.5" />
          <ellipse cx="32" cy="34" rx="7" ry="6" fill="#6b3914" />
          <circle cx="29" cy="34" r="1.2" fill="#fef9ef" />
          <circle cx="35" cy="34" r="1.2" fill="#fef9ef" />
          <ellipse cx="32" cy="38" rx="1.5" ry="1" fill="#2a1a08" />
          <path d="M 24 24 Q 20 22 20 18 Q 22 16 24 18" stroke="#2a1a08" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M 42 24 Q 46 22 46 18 Q 44 16 42 18" stroke="#2a1a08" strokeWidth="2" fill="none" strokeLinecap="round" />
        </symbol>

        {/* 9. Monkey — warm brown body, light face, curly tail */}
        <symbol id="z-monkey" viewBox="0 0 64 64">
          <ellipse cx="32" cy="38" rx="14" ry="14" fill="#a05f2e" />
          <ellipse cx="32" cy="40" rx="10" ry="10" fill="#f5c89e" />
          <circle cx="18" cy="32" r="5" fill="#a05f2e" />
          <circle cx="46" cy="32" r="5" fill="#a05f2e" />
          <circle cx="18" cy="32" r="2.5" fill="#f5c89e" />
          <circle cx="46" cy="32" r="2.5" fill="#f5c89e" />
          <circle cx="27" cy="38" r="1.6" fill="#0c3d3a" />
          <circle cx="37" cy="38" r="1.6" fill="#0c3d3a" />
          <ellipse cx="32" cy="42" rx="1.2" ry="0.8" fill="#0c3d3a" />
          <path d="M 28 46 Q 32 48 36 46" stroke="#4a2e10" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M 46 50 Q 56 50 56 42 Q 56 36 52 36" stroke="#a05f2e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </symbol>

        {/* 10. Rooster — cream body, red comb, gold beak, orange tail */}
        <symbol id="z-rooster" viewBox="0 0 64 64">
          <ellipse cx="28" cy="40" rx="12" ry="13" fill="#fef9ef" stroke="#6b5b4a" strokeWidth="1.5" />
          <circle cx="28" cy="22" r="8" fill="#fef9ef" stroke="#6b5b4a" strokeWidth="1.5" />
          <path d="M 24 14 Q 22 10 24 8 Q 26 12 28 10 Q 28 12 30 10 Q 32 12 32 8 Q 34 12 32 16 Z" fill="#d83d3d" />
          <path d="M 34 24 L 40 24 L 36 28 Z" fill="#f5c537" />
          <ellipse cx="30" cy="28" rx="2" ry="3" fill="#d83d3d" />
          <circle cx="26" cy="22" r="1.6" fill="#0c3d3a" />
          <path d="M 40 36 Q 56 30 54 14 Q 52 22 46 28 Q 50 18 44 16 Q 46 26 42 30 Q 48 22 40 22" fill="#ed7536" />
          <path d="M 42 32 Q 52 28 52 18 Q 50 24 46 26" fill="#f5c537" opacity="0.7" />
          <path d="M 22 52 L 22 56 M 24 52 L 24 56 M 32 52 L 32 56 M 34 52 L 34 56" stroke="#f5c537" strokeWidth="2" strokeLinecap="round" />
        </symbol>

        {/* 11. Dog — tan body, brown ears, dark nose */}
        <symbol id="z-dog" viewBox="0 0 64 64">
          <circle cx="32" cy="36" r="14" fill="#c89f5e" />
          <path d="M 16 22 Q 12 26 14 38 Q 16 42 22 36 Q 22 28 20 24 Z" fill="#8b4513" />
          <path d="M 48 22 Q 52 26 50 38 Q 48 42 42 36 Q 42 28 44 24 Z" fill="#8b4513" />
          <ellipse cx="32" cy="42" rx="7" ry="4.5" fill="#fef9ef" />
          <circle cx="32" cy="40" r="2" fill="#0c3d3a" />
          <circle cx="26" cy="34" r="1.6" fill="#0c3d3a" />
          <circle cx="38" cy="34" r="1.6" fill="#0c3d3a" />
          <path d="M 28 46 Q 32 48 36 46" stroke="#4a2e10" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <ellipse cx="42" cy="46" rx="2" ry="1.5" fill="#8b4513" />
        </symbol>

        {/* 12. Pig — pink body, darker snout + hooves */}
        <symbol id="z-pig" viewBox="0 0 64 64">
          <circle cx="32" cy="36" r="15" fill="#e8a8a8" />
          <path d="M 18 22 L 22 16 L 26 24 Z" fill="#e8a8a8" />
          <path d="M 46 22 L 42 16 L 38 24 Z" fill="#e8a8a8" />
          <path d="M 20 20 L 23 17 L 26 21 Z" fill="#d99090" />
          <path d="M 44 20 L 41 17 L 38 21 Z" fill="#d99090" />
          <ellipse cx="32" cy="40" rx="9" ry="6" fill="#d99090" />
          <ellipse cx="29" cy="40" rx="1.3" ry="2" fill="#6b3914" />
          <ellipse cx="35" cy="40" rx="1.3" ry="2" fill="#6b3914" />
          <circle cx="26" cy="32" r="1.6" fill="#0c3d3a" />
          <circle cx="38" cy="32" r="1.6" fill="#0c3d3a" />
          <path d="M 28 46 Q 32 48 36 46" stroke="#6b3914" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </symbol>
      </defs>
    </svg>
  );
}

interface ZodiacIconProps {
  slug: ZodiacSlug;
  className?: string;
}

export function ZodiacIcon({ slug, className }: ZodiacIconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <use href={`#z-${slug}`} />
    </svg>
  );
}
