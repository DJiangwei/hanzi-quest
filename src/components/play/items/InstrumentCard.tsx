import { makeVocabCard } from './VocabCard';
import { INSTRUMENTS_BY_SLUG, INSTRUMENT_GROUP_LABELS } from '@/lib/collections/instrumentsData';
export const InstrumentCard = makeVocabCard({ bySlug: INSTRUMENTS_BY_SLUG, fallbackEmoji: '🎵', groupLabels: INSTRUMENT_GROUP_LABELS, testId: 'instrument-card' });
