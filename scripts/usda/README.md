# USDA SR Legacy Data Pipeline

Scripts for downloading, filtering, and importing USDA FoodData Central SR Legacy data into the `vietnamese_food_composition` table.

## Prerequisites

1. **USDA API key** — sign up at https://fdc.nal.usda.gov/api-key-signup
2. Add to `.env.local`:
   ```dotenv
   USDA_API_KEY=your_key_here
   ```
3. Python 3.10+ (for download script — no pip dependencies)
4. Bun (for import script)

## Pipeline Steps

### 1. Download USDA data → CSV

```bash
# Dry run (2 pages of list + 5 detail batches, ~100 items)
python3 scripts/usda/download_usda_sr.py \
  --api-key "$USDA_API_KEY" \
  --out data/usda_sr \
  --dry-run

# Full download (~430 API calls, takes ~10 minutes)
python3 scripts/usda/download_usda_sr.py \
  --api-key "$USDA_API_KEY" \
  --out data/usda_sr
```

**Output:**
- `data/usda_sr/usda_sr_legacy.csv` — filtered food data
- `data/usda_sr/download_stats.json` — download statistics

### 2. Verify CSV

Inspect the output before importing:
```bash
# Row count
wc -l data/usda_sr/usda_sr_legacy.csv

# Check stats
cat data/usda_sr/download_stats.json

# Sample rows
head -5 data/usda_sr/usda_sr_legacy.csv | column -t -s,
```

### 3. Import to Supabase

```bash
# Dry run (parse + show first 3 rows)
bun --env-file=.env.local scripts/usda/import_to_supabase.ts \
  --csv data/usda_sr/usda_sr_legacy.csv --dry-run

# Import
bun --env-file=.env.local scripts/usda/import_to_supabase.ts \
  --csv data/usda_sr/usda_sr_legacy.csv
```

### 4. Backfill embeddings

After import, generate embeddings for the new rows:
```bash
bun --env-file=.env.local scripts/backfill_embeddings.ts
```

The existing backfill script automatically finds rows with `embedding IS NULL` and processes them in batches.

## Filtering

The download script excludes 6 USDA food groups that don't add value for Vietnamese cooking:

| Group Code | Name | Reason |
|-----------|------|--------|
| 0300 | Baby Foods | Specialized, irrelevant |
| 2100 | Fast Foods | Branded composites |
| 2200 | Meals, Entrees, and Side Dishes | Pre-made meals |
| 2500 | Snacks | Branded products |
| 3500 | American Indian/Alaska Native Foods | Regional, niche |
| 3600 | Restaurant Foods | Branded composites |

## ID Format

- FAO items: `fao_vn_2007_{food_code}_{state}` (existing, unchanged)
- USDA items: `usda_{ndb_number}_{state}` (e.g., `usda_05009_raw`)

## Tests

```bash
python3 scripts/usda/test_download.py
```

Tests cover:
- State parsing (raw/cooked from description)
- Nutrient mapping (28 USDA nutrients → our columns)
- Unit conversions (copper mg → mcg)
- ID generation
- Food group filtering
- Deduplication logic
