import { makeVocabCard } from './VocabCard';
import { TRANSPORT_BY_SLUG, TRANSPORT_GROUP_LABELS } from '@/lib/collections/transportData';
export const TransportCard = makeVocabCard({ bySlug: TRANSPORT_BY_SLUG, fallbackEmoji: '🚗', groupLabels: TRANSPORT_GROUP_LABELS, testId: 'transport-card' });
