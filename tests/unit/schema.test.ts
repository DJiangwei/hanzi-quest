import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from '@/db/schema';

const EXPECTED_TABLES = [
  'users',
  'child_profiles',
  'characters',
  'words',
  'character_word',
  'example_sentences',
  'character_sentence',
  'curriculum_packs',
  'weeks',
  'week_characters',
  'scene_templates',
  'week_levels',
  'play_sessions',
  'scene_attempts',
  'week_progress',
  'streaks',
  'coin_balances',
  'coin_transactions',
  'shop_items',
  'shop_purchases',
  'gacha_pulls',
  'collection_packs',
  'collectible_items',
  'child_collections',
  'shard_balances',
  'avatar_slots',
  'avatar_items',
  'child_avatar_inventory',
  'child_avatar_equipped',
  'powerup_inventory',
  'ai_jobs',
  'audit_log',
] as const;

describe('db/schema', () => {
  it('exports every PLAN.md §4 table', () => {
    const exportedTableNames = Object.values(schema).flatMap((v) => {
      try {
        return [getTableConfig(v as never).name];
      } catch {
        return [];
      }
    });

    for (const name of EXPECTED_TABLES) {
      expect(exportedTableNames, `missing table ${name}`).toContain(name);
    }
  });

  it('users.id is the Clerk text PK (not uuid)', () => {
    const cfg = getTableConfig(schema.users);
    const idCol = cfg.columns.find((c) => c.name === 'id');
    expect(idCol).toBeDefined();
    expect(idCol?.dataType).toBe('string');
    expect(idCol?.primary).toBe(true);
  });

  it('characters has unique (hanzi, script) index', () => {
    const cfg = getTableConfig(schema.characters);
    const unique = cfg.indexes.find((i) => i.config.name === 'characters_hanzi_script_unique');
    expect(unique).toBeDefined();
    expect(unique?.config.unique).toBe(true);
  });

  it('week_status enum matches PLAN', () => {
    expect(schema.weekStatus.enumValues).toEqual([
      'draft',
      'ai_generating',
      'awaiting_review',
      'published',
      'archived',
    ]);
  });

  it('scene_type enum covers all 7 PLAN scene types', () => {
    expect(schema.sceneType.enumValues).toEqual([
      'flashcard',
      'audio_pick',
      'visual_pick',
      'image_pick',
      'word_match',
      'tracing',
      'boss',
    ]);
  });

  it('week_progress uses composite (child_id, week_id) PK', () => {
    const cfg = getTableConfig(schema.weekProgress);
    expect(cfg.primaryKeys).toHaveLength(1);
    expect(cfg.primaryKeys[0].columns.map((c) => c.name).sort()).toEqual([
      'child_id',
      'week_id',
    ]);
  });
});
