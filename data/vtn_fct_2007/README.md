# VTN FCT 2007 Extraction Artifacts

This folder stores extraction-first artifacts for FAO Vietnam Food Composition Table 2007.

## Phase scope

- Extraction + validation only
- No Supabase table creation
- No database write operations

## Source

- `source/VTN FCT 2007.pdf` — the input the scripts below read (default `--pdf`).

## Scripts

- `python3 scripts/vtn_fct/extract_vtn_fct_2007.py`
  - Generates:
    - `data/vtn_fct_2007/extracted_ingredients.json`
    - `data/vtn_fct_2007/extracted_ingredients.csv`
    - `data/vtn_fct_2007/extraction_report.json`
- `python3 scripts/vtn_fct/build_validation_packet.py --sample-size 20`
  - Generates:
    - `data/vtn_fct_2007/validation/sample_packet.json`
- `python3 scripts/vtn_fct/validate_extraction_quality.py`
  - Generates:
    - `data/vtn_fct_2007/validation/quality_report.json`

## Validation gate

Bulk import planning is blocked until sampled rows pass with **zero errors**.
