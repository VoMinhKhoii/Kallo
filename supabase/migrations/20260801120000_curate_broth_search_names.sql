-- Curate Vietnamese names and cooking variants for USDA broth/stock rows.
--
-- These rows already exist in the reference dataset. Updating the names lets
-- the trigger rebuild search_text/search_text_ascii, while clearing embedding
-- queues the rows for the external gemini-embedding-001 backfill that runs
-- after migrations in the production deploy workflow.

SET search_path TO public, extensions;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM vietnamese_food_composition
    WHERE id IN (
      'usda_6008_raw', 'usda_6170_raw', 'usda_6172_raw',
      'usda_6174_raw', 'usda_6183_raw', 'usda_6188_raw',
      'usda_6194_raw', 'usda_6413_raw', 'usda_6432_raw',
      'usda_6475_raw', 'usda_6476_raw', 'usda_6480_raw',
      'usda_6481_raw', 'usda_6611_raw', 'usda_6615_raw',
      'usda_6700_raw', 'usda_6963_raw', 'usda_6970_raw'
    )
  ) <> 18 THEN
    RAISE EXCEPTION
      'Expected all 18 curated broth rows to exist before updating';
  END IF;
END $$;

UPDATE vietnamese_food_composition AS vfc
SET
  name_primary = curated.name_primary,
  name_alt = curated.name_alt,
  embedding = NULL
FROM (
  VALUES
    (
      'usda_6008_raw',
      'Nước dùng hoặc bouillon bò đóng hộp, dùng ngay',
      ARRAY['nước dùng', 'nước dùng bò', 'bouillon bò', 'nước lèo bò']::text[]
    ),
    (
      'usda_6170_raw',
      'Nước hầm xương bò tự nấu',
      ARRAY['nước dùng', 'nước dùng bò', 'nước hầm xương bò', 'nước lèo bò']::text[]
    ),
    (
      'usda_6172_raw',
      'Nước hầm gà tự nấu',
      ARRAY['nước dùng', 'nước dùng gà', 'nước lèo gà', 'nước luộc gà']::text[]
    ),
    (
      'usda_6174_raw',
      'Nước hầm cá tự nấu',
      ARRAY['nước dùng', 'nước dùng cá', 'nước lèo cá']::text[]
    ),
    (
      'usda_6183_raw',
      'Nước dùng gà giảm natri, dùng ngay',
      ARRAY['nước dùng', 'nước dùng gà', 'nước dùng gà ít natri', 'nước lèo gà']::text[]
    ),
    (
      'usda_6188_raw',
      'Nước dùng bò giảm natri, dùng ngay',
      ARRAY['nước dùng', 'nước dùng bò', 'nước dùng bò ít natri', 'nước lèo bò']::text[]
    ),
    (
      'usda_6194_raw',
      'Nước dùng gà, dùng ngay',
      ARRAY['nước dùng', 'nước dùng gà', 'nước lèo gà']::text[]
    ),
    (
      'usda_6413_raw',
      'Nước dùng gà đóng hộp, pha với lượng nước tương đương',
      ARRAY['nước dùng', 'nước dùng gà', 'nước dùng gà đóng hộp', 'nước lèo gà']::text[]
    ),
    (
      'usda_6432_raw',
      'Nước dùng, bouillon hoặc consommé bò, pha với lượng nước tương đương',
      ARRAY['nước dùng', 'nước dùng bò', 'bouillon bò', 'consommé bò', 'nước lèo bò']::text[]
    ),
    (
      'usda_6475_raw',
      'Bột nước dùng hoặc bouillon bò, pha với nước',
      ARRAY['nước dùng', 'nước dùng bò dạng bột', 'bột bouillon bò', 'nước lèo bò']::text[]
    ),
    (
      'usda_6476_raw',
      'Viên nước dùng bò, pha với nước',
      ARRAY['nước dùng', 'nước dùng bò dạng viên', 'viên bouillon bò', 'nước lèo bò']::text[]
    ),
    (
      'usda_6480_raw',
      'Bột nước dùng hoặc bouillon gà, pha với nước',
      ARRAY['nước dùng', 'nước dùng gà dạng bột', 'bột bouillon gà', 'nước lèo gà']::text[]
    ),
    (
      'usda_6481_raw',
      'Viên nước dùng gà khô, pha với nước',
      ARRAY['nước dùng', 'nước dùng gà dạng viên', 'viên bouillon gà', 'nước lèo gà']::text[]
    ),
    (
      'usda_6611_raw',
      'Nước dùng bò SWANSON giảm natri',
      ARRAY['nước dùng', 'nước dùng bò', 'nước dùng bò ít natri', 'nước lèo bò']::text[]
    ),
    (
      'usda_6615_raw',
      'Nước dùng rau củ SWANSON',
      ARRAY['nước dùng', 'nước dùng rau củ', 'nước lèo rau củ']::text[]
    ),
    (
      'usda_6700_raw',
      'Nước dùng rau củ, dùng ngay',
      ARRAY['nước dùng', 'nước dùng rau củ', 'nước lèo rau củ']::text[]
    ),
    (
      'usda_6963_raw',
      'Nước dùng cá',
      ARRAY['nước dùng', 'nước dùng cá', 'nước lèo cá']::text[]
    ),
    (
      'usda_6970_raw',
      'Nước dùng gà ít natri đóng hộp',
      ARRAY['nước dùng', 'nước dùng gà', 'nước dùng gà giảm natri', 'nước lèo gà']::text[]
    )
) AS curated(id, name_primary, name_alt)
WHERE vfc.id = curated.id;
