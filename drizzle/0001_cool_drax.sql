-- Seed scene_templates for the seven scene types defined in the registry.
-- Idempotent: only inserts a row if a (type, version) pair is missing.

INSERT INTO scene_templates (type, version, default_config, is_active)
SELECT * FROM (VALUES
    ('flashcard'::scene_type,    1::smallint, '{}'::jsonb, true),
    ('audio_pick'::scene_type,   1::smallint, '{}'::jsonb, true),
    ('visual_pick'::scene_type,  1::smallint, '{}'::jsonb, true),
    ('image_pick'::scene_type,   1::smallint, '{}'::jsonb, true),
    ('word_match'::scene_type,   1::smallint, '{}'::jsonb, true),
    ('tracing'::scene_type,      1::smallint, '{}'::jsonb, false),
    ('boss'::scene_type,         1::smallint, '{}'::jsonb, true)
) AS new_rows(t, v, c, a)
WHERE NOT EXISTS (
    SELECT 1 FROM scene_templates st
    WHERE st.type = new_rows.t AND st.version = new_rows.v
);