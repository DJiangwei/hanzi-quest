import { makeVocabCard } from './VocabCard';
import { OLYMPICS_BY_SLUG, OLYMPIC_GROUP_LABELS } from '@/lib/collections/olympicsData';
export const OlympicCard = makeVocabCard({ bySlug: OLYMPICS_BY_SLUG, fallbackEmoji: '🏅', groupLabels: OLYMPIC_GROUP_LABELS, testId: 'olympic-card' });
