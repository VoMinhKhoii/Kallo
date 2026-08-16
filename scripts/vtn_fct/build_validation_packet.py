#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import random
import re
from pathlib import Path
from typing import Any

import pdfplumber


def load_records(path: Path) -> list[dict[str, Any]]:
    with path.open('r', encoding='utf-8') as handle:
        return json.load(handle)


def sample_records(
    records: list[dict[str, Any]],
    sample_size: int,
    seed: int,
) -> list[dict[str, Any]]:
    random.seed(seed)

    raw = [record for record in records if record.get('state') == 'raw']
    cooked = [record for record in records if record.get('state') == 'cooked']

    raw_take = min(len(raw), max(1, sample_size // 2))
    cooked_take = min(len(cooked), sample_size - raw_take)

    selected = random.sample(raw, raw_take) if raw_take else []
    if cooked_take:
        selected.extend(random.sample(cooked, cooked_take))

    if len(selected) < sample_size:
        remaining = [record for record in records if record not in selected]
        fill_count = min(sample_size - len(selected), len(remaining))
        selected.extend(random.sample(remaining, fill_count))

    return sorted(
        selected,
        key=lambda item: item.get('_source_page', 0),
    )


def make_source_excerpt(text: str) -> str:
    collapsed = re.sub(r'\s+', ' ', text).strip()
    return collapsed[:4000]


def attach_source_context(
    pdf_path: Path,
    sample: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    pages_needed = {
        record.get('_source_page')
        for record in sample
        if record.get('_source_page')
    }

    page_text: dict[int, str] = {}
    with pdfplumber.open(pdf_path) as pdf:
        for page_number in pages_needed:
            page_text[page_number] = pdf.pages[page_number - 1].extract_text() or ''

    packet_rows: list[dict[str, Any]] = []
    for record in sample:
        page_number = record.get('_source_page')
        packet_rows.append(
            {
                'source_page': page_number,
                'id': record.get('id'),
                'name_primary': record.get('name_primary'),
                'name_en': record.get('name_en'),
                'state': record.get('state'),
                'inedible_portion_pct': record.get('inedible_portion_pct'),
                'per_100g': record.get('per_100g'),
                'source_excerpt': make_source_excerpt(page_text.get(page_number, '')),
            }
        )

    return packet_rows


def write_packet(
    output_path: Path,
    rows: list[dict[str, Any]],
    seed: int,
) -> None:
    payload = {
        'sample_size': len(rows),
        'seed': seed,
        'validation_rule': 'zero errors tolerated before bulk import',
        'rows': rows,
    }
    with output_path.open('w', encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description='Build a validation sample packet from extracted VTN FCT records.',
    )
    parser.add_argument(
        '--pdf',
        default='data/vtn_fct_2007/source/VTN FCT 2007.pdf',
        help='Path to source PDF.',
    )
    parser.add_argument(
        '--input',
        default='data/vtn_fct_2007/extracted_ingredients.json',
        help='Extracted ingredients JSON path.',
    )
    parser.add_argument(
        '--output',
        default='data/vtn_fct_2007/validation/sample_packet.json',
        help='Output path for validation packet JSON.',
    )
    parser.add_argument(
        '--sample-size',
        type=int,
        default=20,
        help='Number of rows for manual/agent validation.',
    )
    parser.add_argument(
        '--seed',
        type=int,
        default=2007,
        help='Random seed for deterministic sampling.',
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()

    records = load_records(Path(args.input))
    sample = sample_records(records, args.sample_size, args.seed)
    packet_rows = attach_source_context(Path(args.pdf), sample)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    write_packet(output_path, packet_rows, args.seed)

    print(f'Validation packet rows: {len(packet_rows)}')
    print(f'Output: {output_path}')


if __name__ == '__main__':
    main()
