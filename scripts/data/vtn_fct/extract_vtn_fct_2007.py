#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import pdfplumber
import pytesseract
from pdf2image import convert_from_path


@dataclass
class ExtractionResult:
    records: list[dict[str, Any]]
    skipped_pages: list[int]
    parse_errors: list[dict[str, Any]]


# ── Unified nutrient definitions ────────────────────────────────────
# Each entry: field_name → (label_regex, unit_regex | None)
# Field names include the measurement unit as a suffix for clarity.
# The label regex matches the English label in the PDF nutrient table.
# The unit regex matches the unit column (g, mg, μg, mcg, ug, KCal).

ALL_NUTRIENTS: dict[str, tuple[str, str | None]] = {
    # ── Macros ────────────────────────────────────────────────
    'calories_kcal': (r'\(Energy\)\s+KCal', None),
    'protein_g': (r'\bProtein\b', 'g'),
    'carbohydrate_g': (r'\(Carbohydrate\)', 'g'),
    'fat_g': (r'\(Fat\)', 'g'),
    'fiber_g': (r'\(Fiber\)', 'g'),
    # ── Minerals ──────────────────────────────────────────────
    'sodium_mg': (r'\(Sodium\)', 'mg'),
    'calcium_mg': (r'\(Calcium\)', 'mg'),
    'iron_mg': (r'\(Iron\)', 'mg'),
    'magnesium_mg': (r'\(Magnesium\)', 'mg'),
    'phosphorus_mg': (r'\(Phosphorous\)|\(Phosphorus\)', 'mg'),
    'potassium_mg': (r'\(Potassium\)', 'mg'),
    'zinc_mg': (r'\(Zinc\)', 'mg'),
    'copper_mcg': (r'\(Copper\)', r'μg|ug|mcg'),
    'manganese_mg': (r'\(Manganese\)', 'mg'),
    # ── Fat-soluble vitamins & precursors ─────────────────────
    'beta_carotene_mcg': (r'Beta.caroten\b', r'μg|ug|mcg'),
    'vitamin_a_mcg': (r'Vitamin\s+A\b', r'μg|ug|mcg'),
    'vitamin_d_mcg': (r'Vitamin\s+D\b', r'μg|ug|mcg'),
    'vitamin_e_mg': (r'Vitamin\s+E\b', 'mg'),
    'vitamin_k_mcg': (r'Vitamin\s+K\b', r'μg|ug|mcg'),
    # ── Water-soluble vitamins ────────────────────────────────
    'vitamin_c_mg': (r'Vitamin\s+C\b', 'mg'),
    'vitamin_b1_mg': (r'Vitamin\s+B1\b', 'mg'),
    'vitamin_b2_mg': (r'Vitamin\s+B2\b', 'mg'),
    'vitamin_pp_mg': (r'Vitamin\s+PP\b', 'mg'),
    'vitamin_b5_mg': (r'Vitamin\s+B5\b', 'mg'),
    'vitamin_b6_mg': (r'Vitamin\s+B6\b', 'mg'),
    'vitamin_b9_mcg': (r'Vitamin\s+B9\b', r'μg|ug|mcg'),
    'vitamin_b12_mcg': (r'Vitamin\s+B12\b', r'μg|ug|mcg'),
    'vitamin_h_mcg': (r'Vitamin\s+H\b', r'μg|ug|mcg'),
}

MOJIBAKE_MARKERS = re.compile(r'[ªµ¶·¸¹º»¼½¾¿]|\(cid:')

# ── TCVN3 → Vietnamese Unicode mapping ──────────────────────────────
# Maps TCVN3-encoded characters (as pdfplumber reads them) to proper
# Vietnamese Unicode with diacritics.
TCVN3_TO_VIET: dict[str, str] = {
    '\u00A7': 'Đ',   # §
    '\u00A8': 'ă',   # ¨
    '\u00A9': 'â',   # ©
    '\u00AA': 'ê',   # ª
    '\u00AB': 'ô',   # «
    '\u00AC': 'ơ',   # ¬
    '\u00AE': 'đ',   # ®
    '\u2212': 'ư',   # − MINUS SIGN
    '\u03BC': 'à',   # μ Greek mu
    '\u00B5': 'à',   # µ MICRO SIGN
    '\u00B6': 'ả',   # ¶
    '\u00B7': 'ã',   # ·
    '\u00B8': 'á',   # ¸
    '\u00B9': 'ạ',   # ¹
    '\u00BE': 'ắ',   # ¾
    '\u00BF': 'ằ',   # ¿
    '\u00C0': 'ẳ',   # À
    '\u00C1': 'ẵ',   # Á
    '\u00C6': 'ặ',   # Æ
    '\u00C7': 'ầ',   # Ç
    '\u00C8': 'ẩ',   # È
    '\u00C9': 'ẫ',   # É
    '\u00CA': 'ấ',   # Ê
    '\u00CB': 'ậ',   # Ë
    '\u00CC': 'è',   # Ì
    '\u00CD': 'ẽ',   # Í
    '\u00CE': 'ẻ',   # Î
    '\u00D0': 'é',   # Ð
    '\u00D1': 'ẹ',   # Ñ
    '\u00D2': 'ề',   # Ò
    '\u00D3': 'ể',   # Ó
    '\u00D4': 'ễ',   # Ô
    '\u00D5': 'ế',   # Õ
    '\u00D6': 'ệ',   # Ö
    '\u00D7': 'ì',   # ×
    '\u00D8': 'ỉ',   # Ø
    '\u00DC': 'ĩ',   # Ü
    '\u00DD': 'í',   # Ý
    '\u00DE': 'ị',   # Þ
    '\u00DF': 'ò',   # ß
    '\u00E0': 'õ',   # à  (o tilde)
    '\u00E1': 'ỏ',   # á
    '\u00E3': 'ó',   # ã
    '\u00E4': 'ọ',   # ä
    '\u00E5': 'ồ',   # å
    '\u00E6': 'ổ',   # æ
    '\u00E7': 'ỗ',   # ç
    '\u00E8': 'ố',   # è
    '\u00E9': 'ộ',   # é
    '\u00EA': 'ờ',   # ê
    '\u00EB': 'ở',   # ë
    '\u00EC': 'ỡ',   # ì
    '\u00ED': 'ớ',   # í
    '\u00EE': 'ợ',   # î
    '\u00EF': 'ù',   # ï
    '\u00F1': 'ủ',   # ñ
    '\u00F2': 'ũ',   # ò
    '\u00F3': 'ú',   # ó
    '\u00F4': 'ụ',   # ô
    '\u00F5': 'ừ',   # õ
    '\u00F6': 'ử',   # ö
    '\u00F7': 'ữ',   # ÷
    '\u00F8': 'ứ',   # ø
    '\u00F9': 'ự',   # ù
    '\u00FA': 'ỳ',   # ú
    '\u00FB': 'ỷ',   # û
    '\u00FC': 'ỹ',   # ü
    '\u00FD': 'ý',   # ý
    '\u00FE': 'ỵ',   # þ
}


# ── Text deduplication ──────────────────────────────────────────────
# pdfplumber renders certain lines of each VTN FCT page with every
# character doubled (bold-simulation artifact): "MMaaggiiêê" → "Magiê".
# Spaces between doubled words and decimal points are NOT doubled.
# We detect and collapse these runs so nutrient regexes can match.

# Characters that appear single within a doubled region (not doubled
# themselves) — spaces between doubled words and decimal points.
_DEDUP_BRIDGE = frozenset(' \t\n.')


def _is_doubled_run(text: str, start: int, length: int) -> bool:
    """Check if chars at [start..start+length*2) are pair-doubled."""
    end = start + length * 2
    if end > len(text):
        return False
    for i in range(length):
        if text[start + i * 2] != text[start + i * 2 + 1]:
            return False
    return True


def deduplicate_text(text: str) -> str:
    """Collapse character-doubled regions in pdfplumber output.

    Scans for runs where every character appears twice consecutively
    (e.g. "MMaaggiiêê ((MMaaggnneessiiuumm)) mmgg 3333")
    and collapses them to single characters
    ("Magiê (Magnesium) mg 33").

    Uses a sliding-window heuristic: when 4+ consecutive char-pairs
    are detected, we enter "doubled mode". In this mode:
    - Doubled char-pairs → take one character
    - Bridge chars (space, period) → keep as-is, stay in doubled mode
      if the next non-bridge chars resume doubling
    - Any other non-doubled char → exit doubled mode
    """
    if not text:
        return text

    result: list[str] = []
    i = 0
    n = len(text)
    min_doubled_pairs = 4  # require 4 consecutive doubled chars to trigger
    in_doubled = False

    while i < n:
        if not in_doubled:
            # Check for start of doubled region
            if (
                i + min_doubled_pairs * 2 <= n
                and _is_doubled_run(text, i, min_doubled_pairs)
            ):
                in_doubled = True
                # Don't advance i — re-process in doubled mode
            else:
                result.append(text[i])
                i += 1
        else:
            # In doubled mode
            if i + 1 < n and text[i] == text[i + 1]:
                # Doubled pair — take one character
                result.append(text[i])
                i += 2
            elif text[i] in _DEDUP_BRIDGE:
                # Bridge character (space, period) — keep it, but
                # only stay in doubled mode if doubling resumes
                result.append(text[i])
                i += 1
                # Peek ahead past any bridge chars
                j = i
                while j < n and text[j] in _DEDUP_BRIDGE:
                    j += 1
                if j + 1 < n and text[j] == text[j + 1]:
                    pass  # doubling resumes — stay in doubled mode
                else:
                    in_doubled = False  # doubling ended
            else:
                # Non-doubled, non-bridge char — exit doubled mode
                in_doubled = False
                result.append(text[i])
                i += 1

    return ''.join(result)


def normalize_spaces(value: str) -> str:
    return re.sub(r'\s+', ' ', value).strip()


def parse_numeric(raw_value: str | None) -> float | None:
    if raw_value is None:
        return None

    candidate = raw_value.strip().replace(',', '.')
    if candidate in {'', '-', '--'}:
        return None

    candidate = re.sub(r'[^0-9.-]', '', candidate)
    if candidate in {'', '-', '.', '-.'}:
        return None

    try:
        return float(candidate)
    except ValueError:
        return None


def slugify(value: str) -> str:
    normalized = unicodedata.normalize('NFKD', value)
    ascii_text = normalized.encode('ascii', 'ignore').decode('ascii').lower()
    ascii_text = re.sub(r'[^a-z0-9]+', '_', ascii_text)
    ascii_text = re.sub(r'_+', '_', ascii_text).strip('_')
    return ascii_text or 'unknown'


def tcvn3_to_vietnamese(value: str) -> str:
    """Convert TCVN3-encoded name to proper Vietnamese Unicode."""
    converted = ''.join(TCVN3_TO_VIET.get(ch, ch) for ch in value)
    return normalize_spaces(converted)


def infer_state(vn_name: str, en_name: str) -> str:
    combined = f'{vn_name} {en_name}'.lower()

    cooked_keywords = {
        'cooked',
        'boiled',
        'fried',
        'steamed',
        'roasted',
        'baked',
        'grilled',
        'stir-fried',
        'braised',
        'soup',
        'porridge',
        'chao', 'cháo',
        'canh',
        'xao', 'xào',
        'kho', 'khô',
        'nuong', 'nướng',
        'hap', 'hấp',
        'luộc', 'chiên', 'rán',
    }
    raw_keywords = {
        'raw',
        'fresh',
        'dried',
        'uncooked',
        'song', 'sống',
        'tuoi', 'tươi',
        'kho', 'khô',
    }

    if any(keyword in combined for keyword in raw_keywords):
        return 'raw'

    if any(keyword in combined for keyword in cooked_keywords):
        return 'cooked'

    return 'raw'


def needs_ocr_header_fix(record: dict[str, Any]) -> bool:
    vn_name = record.get('name_primary', '')
    en_name = record.get('name_en', '')

    if MOJIBAKE_MARKERS.search(vn_name):
        return True

    if en_name.strip() == '' or en_name.strip().endswith(','):
        return True

    return False


def parse_ocr_header(ocr_text: str) -> tuple[str, str, str, int | None, float | None] | None:
    normalized = normalize_spaces(ocr_text)

    vn_patterns = [
        r'Vietnamese[^:]*:\s*(.*?)\s+STT\s*[:.]?\s*([0-9]+)',
        r'Ten\s+thuc\s+pham[^:]*:\s*(.*?)\s+STT\s*[:.]?\s*([0-9]+)',
    ]
    en_patterns = [
        r'English[^:]*:\s*(.*?)\s+Ma\s*s[o0d]\s*[:.]?\s*([0-9\s]{3,8})',
        r'Ten\s+tieng\s+Anh[^:]*:\s*(.*?)\s+Ma\s*s[o0d]\s*[:.]?\s*([0-9\s]{3,8})',
    ]

    vn_match = None
    for pattern in vn_patterns:
        vn_match = re.search(pattern, normalized, flags=re.IGNORECASE)
        if vn_match:
            break

    en_match = None
    for pattern in en_patterns:
        en_match = re.search(pattern, normalized, flags=re.IGNORECASE)
        if en_match:
            break

    edible_match = re.search(
        r'\(%\):\s*([0-9]+(?:\.[0-9]+)?)',
        normalized,
    )

    if not en_match:
        return None

    vn_name = normalize_spaces(vn_match.group(1)) if vn_match else ''
    en_name = normalize_spaces(en_match.group(1))
    food_code = re.sub(r'\s+', '', en_match.group(2))
    stt = int(vn_match.group(2)) if vn_match else None
    edible_portion = parse_numeric(edible_match.group(1)) if edible_match else None

    if vn_name == '':
        vn_name = en_name

    return vn_name, en_name, food_code, stt, edible_portion


def extract_ocr_header(pdf_path: Path, page_number: int) -> tuple[str, str, str, int | None, float | None] | None:
    try:
        images = convert_from_path(
            str(pdf_path),
            first_page=page_number,
            last_page=page_number,
            dpi=250,
        )
    except Exception:  # noqa: BLE001
        return None

    if not images:
        return None

    image = images[0]
    width, height = image.size
    header_crop = image.crop((0, 0, width, int(height * 0.2)))

    ocr_text = pytesseract.image_to_string(header_crop, lang='eng')
    return parse_ocr_header(ocr_text)


def extract_value(text: str, label_pattern: str, unit_pattern: str | None) -> float | None:
    if unit_pattern is None:
        regex = rf'(?:{label_pattern})\s+([0-9]+(?:\.[0-9]+)?|--|-)'
    else:
        regex = rf'(?:{label_pattern}).*?(?:{unit_pattern})\s+([0-9]+(?:\.[0-9]+)?|--|-)'

    match = re.search(regex, text, flags=re.IGNORECASE)
    if not match:
        return None

    return parse_numeric(match.group(1))


def extract_header(text: str) -> tuple[str, str, str, int | None, float | None] | None:
    normalized_text = re.sub(r'\s+', ' ', text)

    vn_match = re.search(
        r'Vietnamese\):?\s*(.*?)\s+STT:?\s*([0-9]+)',
        normalized_text,
        flags=re.IGNORECASE,
    )
    en_match = re.search(
        r'English\):?\s*(.*?)\s+M[^:]{0,14}:?\s*([0-9\s]{3,8})',
        normalized_text,
    )
    edible_match = re.search(
        r'\(%\):\s*([0-9]+(?:\.[0-9]+)?)',
        normalized_text,
        flags=re.IGNORECASE,
    )

    if not vn_match or not en_match:
        return None

    vn_name = normalize_spaces(vn_match.group(1))
    en_name = normalize_spaces(en_match.group(1))
    food_code = re.sub(r'\s+', '', en_match.group(2))
    stt = int(vn_match.group(2))
    edible_portion = parse_numeric(edible_match.group(1)) if edible_match else None

    return vn_name, en_name, food_code, stt, edible_portion


def extract_record(text: str, page_number: int) -> dict[str, Any] | None:
    # Extract header from original text (header is not doubled)
    header = extract_header(text)
    if header is None:
        return None

    vn_name, en_name, food_code, stt, inedible_portion = header
    vn_name = tcvn3_to_vietnamese(vn_name)
    state = infer_state(vn_name, en_name)

    # Deduplicate the nutrient table region before extracting values
    deduped = deduplicate_text(text)

    per_100g = {
        key: extract_value(deduped, label, unit)
        for key, (label, unit) in ALL_NUTRIENTS.items()
    }

    identifier = f'fao_vn_2007_{food_code}_{state}'

    return {
        'id': identifier,
        'name_primary': vn_name,
        'name_alt': [],
        'name_en': en_name,
        'source': 'FAO_VN_2007',
        'state': state,
        'inedible_portion_pct': inedible_portion,
        'per_100g': per_100g,
        'last_verified': date.today().isoformat(),
        # internal fields used during extraction, stripped from final output
        '_food_code': food_code,
        '_stt': stt,
        '_source_page': page_number,
    }


def run_extraction(
    pdf_path: Path,
    ocr_header_fallback: bool,
    dump_page: int | None = None,
) -> ExtractionResult:
    records: list[dict[str, Any]] = []
    skipped_pages: list[int] = []
    parse_errors: list[dict[str, Any]] = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ''

            # Debug: dump full raw + deduplicated text for a specific page
            if dump_page is not None and page_index == dump_page:
                print(f'\n{"="*60}')
                print(f'RAW TEXT — page {page_index}')
                print(f'{"="*60}')
                print(text)
                print(f'\n{"="*60}')
                print(f'DEDUPLICATED TEXT — page {page_index}')
                print(f'{"="*60}')
                print(deduplicate_text(text))
                print(f'{"="*60}\n')

            if 'Vietnamese)' not in text or 'English)' not in text:
                skipped_pages.append(page_index)
                continue

            try:
                record = extract_record(text, page_index)
            except Exception as error:  # noqa: BLE001
                parse_errors.append(
                    {
                        'page': page_index,
                        'error': str(error),
                    }
                )
                continue

            if record is None:
                skipped_pages.append(page_index)
                continue

            if ocr_header_fallback and needs_ocr_header_fix(record):
                ocr_header = extract_ocr_header(pdf_path, page_index)
                if ocr_header is not None:
                    vn_name, en_name, food_code, stt, inedible_portion = ocr_header
                    record['name_primary'] = vn_name
                    record['name_en'] = en_name
                    record['inedible_portion_pct'] = inedible_portion
                    record['_food_code'] = food_code
                    record['_stt'] = stt

                    state = infer_state(vn_name, en_name)
                    record['state'] = state
                    record['id'] = f'fao_vn_2007_{food_code}_{state}'

            if MOJIBAKE_MARKERS.search(record['name_primary']):
                original_name = record['name_primary']
                converted_name = tcvn3_to_vietnamese(original_name)
                if converted_name:
                    if original_name not in record['name_alt']:
                        record['name_alt'].append(original_name)
                    record['name_primary'] = converted_name
                else:
                    fallback_name = record['name_en'].strip()
                    if fallback_name:
                        if original_name not in record['name_alt']:
                            record['name_alt'].append(original_name)
                        record['name_primary'] = fallback_name

            records.append(record)

    return ExtractionResult(
        records=records,
        skipped_pages=skipped_pages,
        parse_errors=parse_errors,
    )


def _clean_record(record: dict[str, Any]) -> dict[str, Any]:
    """Strip internal extraction fields from a record before output."""
    return {k: v for k, v in record.items() if not k.startswith('_')}


def write_outputs(result: ExtractionResult, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    json_path = output_dir / 'extracted_ingredients.json'
    csv_path = output_dir / 'extracted_ingredients.csv'
    report_path = output_dir / 'extraction_report.json'

    cleaned = [_clean_record(r) for r in result.records]

    with json_path.open('w', encoding='utf-8') as handle:
        json.dump(cleaned, handle, ensure_ascii=False, indent=2)

    nutrient_keys = list(ALL_NUTRIENTS.keys())
    csv_columns = [
        'id',
        'name_primary',
        'name_en',
        'source',
        'state',
        'inedible_portion_pct',
        *nutrient_keys,
        'last_verified',
    ]

    with csv_path.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=csv_columns)
        writer.writeheader()
        for record in result.records:
            per_100g = record['per_100g']
            row = {
                'id': record['id'],
                'name_primary': record['name_primary'],
                'name_en': record['name_en'],
                'source': record['source'],
                'state': record['state'],
                'inedible_portion_pct': record['inedible_portion_pct'],
                'last_verified': record['last_verified'],
            }
            for key in nutrient_keys:
                row[key] = per_100g.get(key)
            writer.writerow(row)

    # Write page index mapping (id → source_page) for validation tooling
    page_index_path = output_dir / 'page_index.json'
    page_index = {
        r['id']: r['_source_page']
        for r in result.records
        if '_source_page' in r
    }
    with page_index_path.open('w', encoding='utf-8') as handle:
        json.dump(page_index, handle, ensure_ascii=False, indent=2)

    report = {
        'total_records': len(result.records),
        'skipped_pages': len(result.skipped_pages),
        'parse_errors': result.parse_errors,
        'output_files': {
            'json': str(json_path),
            'csv': str(csv_path),
            'page_index': str(page_index_path),
        },
    }

    with report_path.open('w', encoding='utf-8') as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description='Extract ingredient rows from VTN FCT 2007 PDF into staging files.',
    )
    parser.add_argument(
        '--pdf',
        default='data/vtn_fct_2007/source/VTN FCT 2007.pdf',
        help='Path to the source PDF.',
    )
    parser.add_argument(
        '--out',
        default='data/vtn_fct_2007',
        help='Output directory for extracted artifacts.',
    )
    parser.add_argument(
        '--ocr-header-fallback',
        action='store_true',
        help='Use OCR to repair header fields on suspicious rows.',
    )
    parser.add_argument(
        '--dump-page',
        type=int,
        default=None,
        help='Print raw + deduplicated text for a specific page (debug).',
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    pdf_path = Path(args.pdf)
    output_dir = Path(args.out)

    if not pdf_path.exists():
        raise FileNotFoundError(f'PDF not found: {pdf_path}')

    result = run_extraction(
        pdf_path=pdf_path,
        ocr_header_fallback=args.ocr_header_fallback,
        dump_page=args.dump_page,
    )
    write_outputs(result, output_dir)

    print(f'Extracted records: {len(result.records)}')
    print(f'Skipped pages: {len(result.skipped_pages)}')
    print(f'Parse errors: {len(result.parse_errors)}')

    # Quick summary of nutrient coverage
    if result.records:
        total = len(result.records)
        print(f'\n── Nutrient coverage ({total} records) ──')
        for key in ALL_NUTRIENTS:
            non_null = sum(
                1 for r in result.records
                if r['per_100g'].get(key) is not None
            )
            pct = non_null / total * 100
            print(f'  {key:25s}  {non_null:4d}/{total}  ({pct:5.1f}%)')


if __name__ == '__main__':
    main()
