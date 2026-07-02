import { makeVocabCard } from './VocabCard';
import { CHAMPIONS_BY_SLUG } from '@/lib/collections/championsData';

export const ChampionCard = makeVocabCard({
  bySlug: CHAMPIONS_BY_SLUG,
  fallbackEmoji: '👑',
  testId: 'champion-card',
});
