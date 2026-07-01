-- Persist Open Food Facts serving/package sizing on cached barcode products so
-- the "amount" step can offer serving- and package-based logging consistently
-- whether the product is freshly fetched or served from the local cache.
--
-- Both columns are per-item gram weights (nullable — many OFF products omit
-- serving/package quantity). Additive and idempotent; safe to re-run.
ALTER TABLE vietnamese_food_composition
  ADD COLUMN IF NOT EXISTS serving_size_g numeric,
  ADD COLUMN IF NOT EXISTS package_size_g numeric;
