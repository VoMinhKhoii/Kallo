#!/usr/bin/env python3
"""Enrich extracted VTN FCT 2007 data with food group types and missing records.

Adds `type_vn` and `type_en` fields to every record based on the food code
prefix → food group mapping from the PDF (page 8 + chapter separator pages).

Also adds any records that were missed during initial extraction.

Usage:
    python3 scripts/data/vtn_fct/enrich_extracted_data.py
"""
from __future__ import annotations

import csv
import json
from datetime import date
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent.parent / 'data' / 'vtn_fct_2007'

# ── Food group mapping (from PDF page 8 + separator pages) ─────────
FOOD_GROUPS: dict[str, tuple[str, str]] = {
    '1':  ('Ngũ cốc và sản phẩm chế biến', 'Cereal and products'),
    '2':  ('Khoai củ và sản phẩm chế biến', 'Starchy root and products'),
    '3':  ('Hạt, quả giàu đạm, béo và sản phẩm chế biến', 'Pulses, nuts, seeds and products'),
    '4':  ('Rau, quả, củ dùng làm rau', 'Vegetables'),
    '5':  ('Quả chín', 'Fruits'),
    '6':  ('Dầu, mỡ, bơ', 'Oil, lard, butter'),
    '7':  ('Thịt và sản phẩm chế biến', 'Meat and meat products'),
    '8':  ('Thủy sản và sản phẩm chế biến', 'Fish, shellfish and products'),
    '9':  ('Trứng và sản phẩm chế biến', 'Egg and products'),
    '10': ('Sữa và sản phẩm chế biến', 'Milk and products'),
    '11': ('Đồ hộp', 'Canned food'),
    '12': ('Đồ ngọt (đường, bánh, mứt, kẹo)', 'Sugar, confectionery'),
    '13': ('Gia vị, nước chấm', 'Condiments, traditional sauces'),
    '14': ('Nước giải khát, bia, rượu', 'Beverage and liquor'),
}

# ── Records missed during initial extraction ───────────────────────
# Page 484: header used `Vietnamese)` without colon — now fixed in
# extract_vtn_fct_2007.py, but we add the record here so the data
# files can be updated without re-running full PDF extraction.
MISSING_RECORDS: list[dict[str, Any]] = [
    {
        'id': 'fao_vn_2007_11011_raw',
        'name_primary': 'Mứt đu đủ',
        'name_alt': [],
        'name_en': 'Papaya jam',
        'source': 'FAO_VN_2007',
        'state': 'raw',
        'inedible_portion_pct': 0.0,
        'per_100g': {
            'calories_kcal': 178.0,
            'protein_g': 0.4,
            'carbohydrate_g': 44.1,
            'fat_g': 0.0,
            'fiber_g': 2.0,
            'sodium_mg': None,
            'calcium_mg': 24.0,
            'iron_mg': None,
            'magnesium_mg': None,
            'phosphorus_mg': 30.0,
            'potassium_mg': None,
            'zinc_mg': None,
            'copper_mcg': None,
            'manganese_mg': None,
            'beta_carotene_mcg': None,
            'vitamin_a_mcg': None,
            'vitamin_d_mcg': None,
            'vitamin_e_mg': None,
            'vitamin_k_mcg': None,
            'vitamin_c_mg': None,
            'vitamin_b1_mg': None,
            'vitamin_b2_mg': None,
            'vitamin_pp_mg': None,
            'vitamin_b5_mg': None,
            'vitamin_b6_mg': None,
            'vitamin_b9_mcg': None,
            'vitamin_b12_mcg': None,
            'vitamin_h_mcg': None,
        },
        'last_verified': date.today().isoformat(),
    },
]

NUTRIENT_KEYS = [
    'calories_kcal', 'protein_g', 'carbohydrate_g', 'fat_g', 'fiber_g',
    'sodium_mg', 'calcium_mg', 'iron_mg', 'magnesium_mg', 'phosphorus_mg',
    'potassium_mg', 'zinc_mg', 'copper_mcg', 'manganese_mg',
    'beta_carotene_mcg', 'vitamin_a_mcg', 'vitamin_d_mcg', 'vitamin_e_mg',
    'vitamin_k_mcg', 'vitamin_c_mg', 'vitamin_b1_mg', 'vitamin_b2_mg',
    'vitamin_pp_mg', 'vitamin_b5_mg', 'vitamin_b6_mg', 'vitamin_b9_mcg',
    'vitamin_b12_mcg', 'vitamin_h_mcg',
]


def get_food_code(record_id: str) -> str:
    """Extract the numeric food code from a record ID."""
    # fao_vn_2007_{food_code}_{state}
    parts = record_id.split('_')
    return parts[3]


def get_group_prefix(food_code: str) -> str:
    """Derive the group prefix from a food code (e.g. '11011' → '11')."""
    code_int = int(food_code)
    if code_int < 2000:
        return '1'
    elif code_int < 3000:
        return '2'
    elif code_int < 4000:
        return '3'
    elif code_int < 5000:
        return '4'
    elif code_int < 6000:
        return '5'
    elif code_int < 7000:
        return '6'
    elif code_int < 8000:
        return '7'
    elif code_int < 9000:
        return '8'
    elif code_int < 10000:
        return '9'
    elif code_int < 11000:
        return '10'
    elif code_int < 12000:
        return '11'
    elif code_int < 13000:
        return '12'
    elif code_int < 14000:
        return '13'
    else:
        return '14'


def enrich_record(record: dict[str, Any]) -> dict[str, Any]:
    """Add type_vn and type_en to a record."""
    food_code = get_food_code(record['id'])
    prefix = get_group_prefix(food_code)
    type_vn, type_en = FOOD_GROUPS[prefix]

    # Build new record with type fields inserted after name_en
    enriched: dict[str, Any] = {}
    for key, value in record.items():
        enriched[key] = value
        if key == 'name_en':
            enriched['type_vn'] = type_vn
            enriched['type_en'] = type_en

    # If type fields weren't inserted (name_en missing), add at end
    if 'type_vn' not in enriched:
        enriched['type_vn'] = type_vn
        enriched['type_en'] = type_en

    return enriched


def main() -> None:
    json_path = DATA_DIR / 'extracted_ingredients.json'
    csv_path = DATA_DIR / 'extracted_ingredients.csv'
    report_path = DATA_DIR / 'extraction_report.json'

    # Load existing data
    with json_path.open('r', encoding='utf-8') as f:
        records: list[dict[str, Any]] = json.load(f)

    existing_ids = {r['id'] for r in records}
    print(f'Loaded {len(records)} existing records')

    # Add missing records
    added = 0
    for missing in MISSING_RECORDS:
        if missing['id'] not in existing_ids:
            records.append(missing)
            existing_ids.add(missing['id'])
            added += 1
            print(f'  Added missing record: {missing["id"]} ({missing["name_en"]})')
    if added == 0:
        print('  No missing records to add')

    # Sort records by food code for consistent ordering
    def sort_key(r: dict[str, Any]) -> tuple[int, str]:
        food_code = get_food_code(r['id'])
        state = r['id'].split('_')[-1]
        return (int(food_code), state)

    records.sort(key=sort_key)

    # Enrich all records with type fields
    enriched_records = [enrich_record(r) for r in records]
    print(f'Enriched {len(enriched_records)} records with type_vn/type_en')

    # Write JSON
    with json_path.open('w', encoding='utf-8') as f:
        json.dump(enriched_records, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'Wrote {json_path}')

    # Write CSV
    csv_columns = [
        'id', 'name_primary', 'name_en', 'type_vn', 'type_en',
        'source', 'state', 'inedible_portion_pct',
        *NUTRIENT_KEYS,
        'last_verified',
    ]

    with csv_path.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=csv_columns)
        writer.writeheader()
        for record in enriched_records:
            per_100g = record['per_100g']
            row = {
                'id': record['id'],
                'name_primary': record['name_primary'],
                'name_en': record['name_en'],
                'type_vn': record['type_vn'],
                'type_en': record['type_en'],
                'source': record['source'],
                'state': record['state'],
                'inedible_portion_pct': record['inedible_portion_pct'],
                'last_verified': record['last_verified'],
            }
            for key in NUTRIENT_KEYS:
                row[key] = per_100g.get(key)
            writer.writerow(row)
    print(f'Wrote {csv_path}')

    # Update extraction report
    if report_path.exists():
        with report_path.open('r', encoding='utf-8') as f:
            report = json.load(f)
        report['total_records'] = len(enriched_records)
        with report_path.open('w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print(f'Updated {report_path} (total_records: {len(enriched_records)})')

    # Summary
    from collections import Counter
    group_counts = Counter(
        get_group_prefix(get_food_code(r['id']))
        for r in enriched_records
    )
    print(f'\nTotal: {len(enriched_records)} records across {len(group_counts)} groups')
    for prefix in sorted(group_counts, key=int):
        type_vn, type_en = FOOD_GROUPS[prefix]
        print(f'  Group {prefix:>2}: {group_counts[prefix]:>3} items — {type_en}')


if __name__ == '__main__':
    main()
