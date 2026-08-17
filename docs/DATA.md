# Data Sources

## Diagnosing a food that finds no candidates

When an ingredient comes back with `candidates: []`, settle first whether the
row is **absent** or **present but unreachable** — the two have opposite fixes.

```bash
bun --env-file=.env.local scripts/db/probe_food_coverage.ts "mì gói" "mì ăn liền"
```

The script lists up to 20 rows carrying the phrase, then re-runs the lexical arm
(`fuzzy_match_ingredients_all_sources`) at the loose SQL floor and marks which
rows would survive the much stricter JS acceptance floors in
`lib/ai/matching/match-constants.ts` (FAO vector `0.80`, USDA vector `0.70`,
fuzzy `0.70`). Postgres returning a row at `0.15` says nothing about whether
the matcher will accept it.

| Verdict | Fix | Precedent migration |
|---|---|---|
| `NO LEXICAL NAME MATCH` | Re-probe the English name and scan the category first — an untranslated USDA row keeps its English `name_primary`. Only if that is empty too, insert a curated row citing a verified source ID | `20260729130000_add_banh_uot_row.sql` |
| `PRESENT BUT UNREACHABLE` | Curate `name_primary` / `name_alt`; set `embedding = NULL` to re-queue the backfill | `20260801120000_curate_broth_search_names.sql` |

Do **not** lower the acceptance floors to rescue one food — they are shared by
every ingredient, so loosening them trades a silent miss for silent wrong
matches everywhere.

## VTN FCT 2007 — Vietnamese Food Composition Table

### Overview

- **Source**: FAO/WHO Vietnamese Food Composition Table 2007
- **Records**: 526 food items
- **Location**: `data/vtn_fct_2007/`
- **Extraction script**: `scripts/data/vtn_fct/extract_vtn_fct_2007.py`
- **Enrichment script**: `scripts/data/vtn_fct/enrich_extracted_data.py`

### Output Files

| File | Description |
|------|-------------|
| `extracted_ingredients.json` | 526 records with full nutritional data |
| `extracted_ingredients.csv` | Same data in flat CSV format |
| `extraction_report.json` | Extraction statistics and error log |
| `page_index.json` | Mapping of record `id` → PDF source page (for validation) |

### Re-extraction

```bash
# Full extraction (no OCR)
python3 scripts/data/vtn_fct/extract_vtn_fct_2007.py \
  --pdf "data/vtn_fct_2007/source/VTN FCT 2007.pdf" \
  --out data/vtn_fct_2007

# With OCR header fallback for mojibake repair
python3 scripts/data/vtn_fct/extract_vtn_fct_2007.py \
  --pdf "data/vtn_fct_2007/source/VTN FCT 2007.pdf" \
  --out data/vtn_fct_2007 \
  --ocr-header-fallback

# Enrich with food group types (type_vn, type_en)
python3 scripts/data/vtn_fct/enrich_extracted_data.py

# Run quality validation
python3 scripts/data/vtn_fct/validate_extraction_quality.py
```

### JSON Record Schema

Each record in `extracted_ingredients.json` follows this structure:

```jsonc
{
  "id": "fao_vn_2007_{food_code}_{state}",
  "name_primary": "string",    // Vietnamese name with diacritics (Unicode)
  "name_alt": ["string"],      // Alternate names (original TCVN3 if different)
  "name_en": "string",         // English name from PDF
  "type_vn": "string",         // Food group name in Vietnamese
  "type_en": "string",         // Food group name in English
  "source": "FAO_VN_2007",     // Always this value
  "state": "raw | cooked",     // Inferred from name keywords
  "inedible_portion_pct": 0.0, // Waste/inedible portion percentage ("Thải bỏ %")
  "per_100g": {
    // ── Macros ──
    "calories_kcal": 344.0,       // Energy in kilocalories
    "protein_g": 8.6,             // Protein in grams
    "carbohydrate_g": 74.5,       // Carbohydrate in grams
    "fat_g": 1.5,                 // Total fat in grams
    "fiber_g": 0.6,               // Dietary fiber in grams

    // ── Minerals ──
    "sodium_mg": 3.0,             // Sodium in milligrams
    "calcium_mg": 32.0,           // Calcium in milligrams
    "iron_mg": 1.2,               // Iron in milligrams
    "magnesium_mg": 17.0,         // Magnesium in milligrams
    "phosphorus_mg": 98.0,        // Phosphorus in milligrams
    "potassium_mg": 282.0,        // Potassium in milligrams
    "zinc_mg": 2.2,               // Zinc in milligrams
    "copper_mcg": 280.0,          // Copper in micrograms
    "manganese_mg": 1.1,          // Manganese in milligrams

    // ── Fat-soluble vitamins & precursors ──
    "beta_carotene_mcg": 0.0,     // Beta-carotene in micrograms
    "vitamin_a_mcg": 0.0,         // Vitamin A (Retinol) in micrograms
    "vitamin_d_mcg": 0.0,         // Vitamin D (Calciferol) in micrograms
    "vitamin_e_mg": null,         // Vitamin E (Alpha-tocopherol) in milligrams
    "vitamin_k_mcg": null,        // Vitamin K (Phylloquinone) in micrograms

    // ── Water-soluble vitamins ──
    "vitamin_c_mg": 0.0,          // Vitamin C (Ascorbic acid) in milligrams
    "vitamin_b1_mg": 0.14,        // Vitamin B1 (Thiamine) in milligrams
    "vitamin_b2_mg": 0.06,        // Vitamin B2 (Riboflavin) in milligrams
    "vitamin_pp_mg": 2.4,         // Vitamin PP (Niacin/B3) in milligrams
    "vitamin_b5_mg": null,        // Vitamin B5 (Pantothenic acid) in milligrams
    "vitamin_b6_mg": null,        // Vitamin B6 (Pyridoxine) in milligrams
    "vitamin_b9_mcg": null,       // Vitamin B9 (Folic acid) in micrograms
    "vitamin_b12_mcg": null,      // Vitamin B12 (Cyanocobalamin) in micrograms
    "vitamin_h_mcg": null         // Vitamin H (Biotin) in micrograms
  },
  "last_verified": "2026-02-26"  // Date of extraction run
}
```

**Field naming convention**: All nutrient keys include a unit suffix (`_g`, `_mg`, `_mcg`, `_kcal`) to prevent ambiguity.

**Null values**: A `null` nutrient value means the PDF had a dash (`-`) or no data for that food item. A value of `0.0` means the PDF explicitly listed zero.

### Food Groups (14 groups, 526 records)

| Group | Code prefix | Vietnamese | English | Count |
|-------|-------------|-----------|---------|-------|
| 1 | 1xxx | Ngũ cốc và sản phẩm chế biến | Cereal and products | 23 |
| 2 | 2xxx | Khoai củ và sản phẩm chế biến | Starchy root and products | 26 |
| 3 | 3xxx | Hạt, quả giàu đạm, béo và sản phẩm chế biến | Pulses, nuts, seeds and products | 33 |
| 4 | 4xxx | Rau, quả, củ dùng làm rau | Vegetables | 126 |
| 5 | 5xxx | Quả chín | Fruits | 56 |
| 6 | 6xxx | Dầu, mỡ, bơ | Oil, lard, butter | 14 |
| 7 | 7xxx | Thịt và sản phẩm chế biến | Meat and meat products | 82 |
| 8 | 8xxx | Thủy sản và sản phẩm chế biến | Fish, shellfish and products | 59 |
| 9 | 9xxx | Trứng và sản phẩm chế biến | Egg and products | 11 |
| 10 | 10xxx | Sữa và sản phẩm chế biến | Milk and products | 9 |
| 11 | 11xxx | Đồ hộp | Canned food | 21 |
| 12 | 12xxx | Đồ ngọt (đường, bánh, mứt, kẹo) | Sugar, confectionery | 27 |
| 13 | 13xxx | Gia vị, nước chấm | Condiments, traditional sauces | 23 |
| 14 | 14xxx | Nước giải khát, bia, rượu | Beverage and liquor | 16 |

### Nutrient Coverage (526 records)

| Nutrient | Non-null | Coverage |
|----------|----------|----------|
| calories_kcal | 525 | 100.0% |
| protein_g | 524 | 99.8% |
| carbohydrate_g | 525 | 100.0% |
| fat_g | 450 | 85.7% |
| fiber_g | 505 | 96.2% |
| sodium_mg | 249 | 47.4% |
| calcium_mg | 478 | 91.0% |
| iron_mg | 427 | 81.3% |
| magnesium_mg | 241 | 45.9% |
| phosphorus_mg | 473 | 90.1% |
| potassium_mg | 249 | 47.4% |
| zinc_mg | 233 | 44.4% |
| copper_mcg | 234 | 44.6% |
| manganese_mg | 218 | 41.5% |
| beta_carotene_mcg | 447 | 85.1% |
| vitamin_a_mcg | 373 | 71.0% |
| vitamin_d_mcg | 39 | 7.4% |
| vitamin_e_mg | 160 | 30.5% |
| vitamin_k_mcg | 161 | 30.7% |
| vitamin_c_mg | 426 | 81.1% |
| vitamin_b1_mg | 355 | 67.6% |
| vitamin_b2_mg | 360 | 68.6% |
| vitamin_pp_mg | 357 | 68.0% |
| vitamin_b5_mg | 199 | 37.9% |
| vitamin_b6_mg | 214 | 40.8% |
| vitamin_b9_mcg | 206 | 39.2% |
| vitamin_b12_mcg | 206 | 39.2% |
| vitamin_h_mcg | 70 | 13.3% |

### Validation Report

| Check | Result |
|-------|--------|
| Total records | 526 |
| Duplicate IDs | 0 |
| Mojibake names remaining | 0 |
| Suspicious English names | 57 |
| Parse errors | 0 |
