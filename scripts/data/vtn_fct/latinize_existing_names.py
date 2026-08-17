#!/usr/bin/env python3
"""Post-process extracted_ingredients.json to convert TCVN3 mojibake
names into proper Vietnamese Unicode with diacritics.

Standalone script — no dependency on the extraction module.
Run:
    python3 scripts/data/vtn_fct/latinize_existing_names.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

# ── TCVN3 → Vietnamese Unicode mapping ──────────────────────────────
# Empirically derived from every non-ASCII character in the extracted
# food-name corpus, cross-checked against known Vietnamese food names
# (đậu/bean, bột/flour, thịt/meat, sữa/milk, nước/water …).
#
# Keys = characters as they appear in the JSON (PDF extractor read
#         TCVN3 font bytes as Latin-1 / CP-1252).
# Values = correct Vietnamese Unicode characters with diacritics.

TCVN3_TO_VIET: dict[str, str] = {
    # ── Uppercase ──────────────────────────────────────────────
    '\u00A7': 'Đ',   # § → Đ  (§Ëu = Đậu)

    # ── Base vowels with structural marks (no tone) ───────────
    '\u00A8': 'ă',   # ¨       (M¨ng = Măng)
    '\u00A9': 'â',   # ©       (t©y = tây)
    '\u00AA': 'ê',   # ª       (chiªn = chiên)
    '\u00AB': 'ô',   # «       (Ng« = Ngô)
    '\u00AC': 'ơ',   # ¬       (t−¬i = tươi)
    '\u00AE': 'đ',   # ®       (®Ëu = đậu)
    '\u2212': 'ư',   # − MINUS SIGN   (n−íc = nước)
    '\u03BC': 'à',   # μ Greek mu     (vμng = vàng)
    '\u00B5': 'à',   # µ MICRO SIGN   (alternate of 0xB5)

    # ── a: à ả ã á ạ ──────────────────────────────────────────
    '\u00B6': 'ả',   # ¶       (Qu¶ = Quả)
    '\u00B7': 'ã',   # ·       (Nh·n = Nhãn)
    '\u00B8': 'á',   # ¸       (Gi¸ = Giá)
    '\u00B9': 'ạ',   # ¹       (H¹t = Hạt)

    # ── ă: ắ ằ ẳ ẵ ặ ────────────────────────────────────────
    '\u00BE': 'ắ',   # ¾       (b¾p = bắp)
    '\u00BF': 'ằ',   # ¿
    '\u00C0': 'ẳ',   # À
    '\u00C1': 'ẵ',   # Á
    '\u00C6': 'ặ',   # Æ       (®Æc = đặc)

    # ── â: ầ ẩ ẫ ấ ậ ─────────────────────────────────────────
    '\u00C7': 'ầ',   # Ç       (dÇu = dầu)
    '\u00C8': 'ẩ',   # È       (quÈy = quẩy)
    '\u00C9': 'ẫ',   # É
    '\u00CA': 'ấ',   # Ê       (GÊc = Gấc)
    '\u00CB': 'ậ',   # Ë       (®Ëu = đậu)

    # ── e: è ẽ ẻ é ẹ ─────────────────────────────────────────
    '\u00CC': 'è',   # Ì       (DÇu mÌ = Dầu mè)
    '\u00CD': 'ẽ',   # Í
    '\u00CE': 'ẻ',   # Î       (tÎ = tẻ, dÎ = dẻ)
    '\u00D0': 'é',   # Ð       (bÐo = béo)
    '\u00D1': 'ẹ',   # Ñ       (HÑ = Hẹ, ghÑ = ghẹ)

    # ── ê: ề ể ễ ế ệ ─────────────────────────────────────────
    '\u00D2': 'ề',   # Ò       (riÒng = riềng)
    '\u00D3': 'ể',   # Ó       (bÓ = bể)
    '\u00D4': 'ễ',   # Ô       (niÔng = niễng)
    '\u00D5': 'ế',   # Õ       (KhÕ = Khế)
    '\u00D6': 'ệ',   # Ö       (ViÖt = Việt)

    # ── i: ì ỉ ĩ í ị ──────────────────────────────────────────
    '\u00D7': 'ì',   # ×       (m× = mì)
    '\u00D8': 'ỉ',   # Ø
    '\u00DC': 'ĩ',   # Ü       (nhÜ = nhĩ)
    '\u00DD': 'í',   # Ý       (bÝ = bí)
    '\u00DE': 'ị',   # Þ       (ThÞt = Thịt)

    # ── o: ò õ ỏ ó ọ ──────────────────────────────────────────
    '\u00DF': 'ò',   # ß       (bß = bò)
    '\u00E0': 'õ',   # à       (o tilde)
    '\u00E1': 'ỏ',   # á       (®á = đỏ)
    '\u00E3': 'ó',   # ã       (ngãt = ngót)
    '\u00E4': 'ọ',   # ä       (sä = sọ)

    # ── ô: ồ ổ ỗ ố ộ ─────────────────────────────────────────
    '\u00E5': 'ồ',   # å       (rång = rồng)
    '\u00E6': 'ổ',   # æ       (æi = ổi)
    '\u00E7': 'ỗ',   # ç       (ngçng = ngỗng)
    '\u00E8': 'ố',   # è       (Cèm = Cốm)
    '\u00E9': 'ộ',   # é       (Bét = Bột)

    # ── ơ: ờ ở ỡ ớ ợ ─────────────────────────────────────────
    '\u00EA': 'ờ',   # ê       (th−êng = thường)
    '\u00EB': 'ở',   # ë       (B−ëi = Bưởi)
    '\u00EC': 'ỡ',   # ì       (NÊm mì = Nấm mỡ)
    '\u00ED': 'ớ',   # í       (n−íc = nước)
    '\u00EE': 'ợ',   # î       (lîn = lợn)

    # ── u: ù ủ ũ ú ụ ─────────────────────────────────────────
    '\u00EF': 'ù',   # ï       (Cïi = Cùi)
    '\u00F1': 'ủ',   # ñ       (Cñ = Củ)
    '\u00F2': 'ũ',   # ò       (®òa = đũa)
    '\u00F3': 'ú',   # ó       (Bón = Bún)
    '\u00F4': 'ụ',   # ô       (phô = phụ)

    # ── ư: ừ ử ữ ứ ự ─────────────────────────────────────────
    '\u00F5': 'ừ',   # õ       (dõa = dừa)
    '\u00F6': 'ử',   # ö       (nöa = nửa)
    '\u00F7': 'ữ',   # ÷       (S÷a = Sữa)
    '\u00F8': 'ứ',   # ø       (trøng = trứng)
    '\u00F9': 'ự',   # ù       (thùc = thực)

    # ── y: ỳ ỷ ỹ ý ỵ ──────────────────────────────────────────
    '\u00FA': 'ỳ',   # ú       (Mú sîi = Mỳ sợi)
    '\u00FB': 'ỷ',   # û
    '\u00FC': 'ỹ',   # ü
    '\u00FD': 'ý',   # ý → ý  (maps to itself)
    '\u00FE': 'ỵ',   # þ
}

# Detect any TCVN3 char in a string
_TCVN3_CHARS_RE = re.compile(
    '[' + re.escape(''.join(TCVN3_TO_VIET.keys())) + ']'
)


def tcvn3_to_unicode(text: str) -> str:
    """Replace every TCVN3-encoded char with correct Vietnamese Unicode."""
    return ''.join(TCVN3_TO_VIET.get(ch, ch) for ch in text)


def normalize_spaces(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


def process_records(records: list[dict]) -> tuple[list[dict], int]:
    changed = 0
    for record in records:
        original = (record.get('name_primary') or '').strip()
        if not original:
            continue

        if not _TCVN3_CHARS_RE.search(original):
            continue

        converted = normalize_spaces(tcvn3_to_unicode(original))
        if converted == original:
            continue

        # Preserve mojibake original as an alternate name
        name_alt: list[str] = record.get('name_alt') or []
        if not isinstance(name_alt, list):
            name_alt = [name_alt] if name_alt else []
        if original not in name_alt:
            name_alt.append(original)
        record['name_alt'] = name_alt

        record['name_primary'] = converted

        changed += 1

    return records, changed


def main() -> None:
    input_path = Path('data/vtn_fct_2007/extracted_ingredients.json')
    output_path = input_path  # overwrite in place

    records = json.loads(input_path.read_text(encoding='utf-8'))
    updated, changed = process_records(records)

    output_path.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )

    print(f'Total records : {len(updated)}')
    print(f'Names converted: {changed}')
    print(f'Output         : {output_path}')

    # Sanity-check: show first 20 converted names
    print('\n── Sample conversions ──')
    shown = 0
    for r in updated:
        alt = r.get('name_alt', [])
        if alt and shown < 20:
            print(f'  {r["name_primary"]:40s} ← {alt[-1]}')
            shown += 1


if __name__ == '__main__':
    main()
