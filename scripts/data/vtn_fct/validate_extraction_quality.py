#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


MOJIBAKE_MARKERS = re.compile(r'[ªµ¶·¸¹º»¼½¾¿]|\(cid:')


def load_records(path: Path) -> list[dict[str, Any]]:
    with path.open('r', encoding='utf-8') as handle:
        return json.load(handle)


def is_suspicious_english_name(name: str) -> bool:
    stripped = name.strip()
    if stripped == '':
        return True
    if stripped.endswith(','):
        return True
    if len(stripped.split()) <= 1:
        return True
    return False


def run_quality_checks(records: list[dict[str, Any]]) -> dict[str, Any]:
    duplicate_ids = len(records) - len({record['id'] for record in records})

    mojibake_rows = [
        record
        for record in records
        if MOJIBAKE_MARKERS.search(record.get('name_primary', ''))
    ]
    suspicious_en_rows = [
        record
        for record in records
        if is_suspicious_english_name(record.get('name_en', ''))
    ]

    missing_core = {}
    for nutrient in [
        'calories_kcal',
        'protein_g',
        'carbohydrate_g',
        'fat_g',
        'fiber_g',
        'sodium_mg',
        'calcium_mg',
        'iron_mg',
    ]:
        missing_core[nutrient] = sum(
            1
            for record in records
            if record.get('per_100g', {}).get(nutrient) is None
        )

    # Full nutrient coverage
    all_nutrient_keys = [
        'calories_kcal', 'protein_g', 'carbohydrate_g', 'fat_g',
        'fiber_g', 'sodium_mg', 'calcium_mg', 'iron_mg',
        'magnesium_mg', 'phosphorus_mg', 'potassium_mg', 'zinc_mg',
        'copper_mcg', 'manganese_mg', 'beta_carotene_mcg',
        'vitamin_a_mcg', 'vitamin_d_mcg', 'vitamin_e_mg',
        'vitamin_k_mcg', 'vitamin_c_mg', 'vitamin_b1_mg',
        'vitamin_b2_mg', 'vitamin_pp_mg', 'vitamin_b5_mg',
        'vitamin_b6_mg', 'vitamin_b9_mcg', 'vitamin_b12_mcg',
        'vitamin_h_mcg',
    ]

    nutrient_coverage = {}
    total = len(records)
    for key in all_nutrient_keys:
        non_null = sum(
            1
            for r in records
            if r.get('per_100g', {}).get(key) is not None
        )
        nutrient_coverage[key] = {
            'non_null': non_null,
            'null': total - non_null,
            'pct': round(non_null / total * 100, 1) if total else 0,
        }

    return {
        'total_records': len(records),
        'duplicate_ids': duplicate_ids,
        'mojibake_name_rows': len(mojibake_rows),
        'suspicious_english_name_rows': len(suspicious_en_rows),
        'missing_core_nutrients': missing_core,
        'nutrient_coverage': nutrient_coverage,
        'examples': {
            'mojibake': [
                {
                    'id': row['id'],
                    'name_primary': row['name_primary'],
                }
                for row in mojibake_rows[:10]
            ],
            'suspicious_english': [
                {
                    'id': row['id'],
                    'name_en': row['name_en'],
                }
                for row in suspicious_en_rows[:10]
            ],
        },
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description='Run extraction quality checks for VTN FCT artifacts.',
    )
    parser.add_argument(
        '--input',
        default='data/vtn_fct_2007/extracted_ingredients.json',
        help='Path to extracted ingredients JSON.',
    )
    parser.add_argument(
        '--output',
        default='data/vtn_fct_2007/validation/quality_report.json',
        help='Path to write quality report JSON.',
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()

    records = load_records(Path(args.input))
    report = run_quality_checks(records)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open('w', encoding='utf-8') as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)

    print(f"Total records: {report['total_records']}")
    print(f"Duplicate IDs: {report['duplicate_ids']}")
    print(f"Mojibake name rows: {report['mojibake_name_rows']}")
    print(
        'Suspicious English name rows: '
        f"{report['suspicious_english_name_rows']}"
    )
    print()
    print('── Nutrient coverage ──')
    for key, info in report['nutrient_coverage'].items():
        print(
            f"  {key:25s}  {info['non_null']:4d}/"
            f"{report['total_records']}  ({info['pct']:5.1f}%)"
        )


if __name__ == '__main__':
    main()
