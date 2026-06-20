import { makeVocabCard } from './VocabCard';
import { MINIBEASTS_BY_SLUG } from '@/lib/collections/minibeastsData';
export const MinibeastCard = makeVocabCard({ bySlug: MINIBEASTS_BY_SLUG, fallbackEmoji: '🐛', testId: 'minibeast-card' });
