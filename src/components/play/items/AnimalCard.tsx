import { makeVocabCard } from './VocabCard';
import { ANIMALS_BY_SLUG } from '@/lib/collections/animalsData';
export const AnimalCard = makeVocabCard({ bySlug: ANIMALS_BY_SLUG, fallbackEmoji: '🐾', testId: 'animal-card' });
