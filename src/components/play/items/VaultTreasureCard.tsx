import { makeVocabCard } from './VocabCard';
import { VAULT_TREASURES_BY_SLUG } from '@/lib/collections/keyVaultData';

export const VaultTreasureCard = makeVocabCard({
  bySlug: VAULT_TREASURES_BY_SLUG,
  fallbackEmoji: '💎',
  testId: 'vault-treasure-card',
});
