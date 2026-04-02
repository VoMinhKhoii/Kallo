#!/usr/bin/env python3
"""
Download USDA FoodData Central SR Legacy data and export as CSV.

Fetches all SR Legacy foods from the USDA FoodData Central API, filters out
irrelevant food groups (baby foods, fast foods, restaurant foods, etc.),
maps 28 nutrients to the project's vietnamese_food_composition schema, and
outputs a CSV ready for import.

Usage:
    python3 scripts/usda/download_usda_sr.py --api-key YOUR_KEY --out data/usda_sr
    python3 scripts/usda/download_usda_sr.py --api-key YOUR_KEY --out data/usda_sr --dry-run

Environment:
    USDA_API_KEY — API key (alternative to --api-key flag)

Rate limits:
    USDA allows 1,000 requests/hour per IP. This script makes ~430 calls
    (39 list pages + ~390 batch detail calls of 20 IDs each).
"""

import argparse
import csv
import json
import os
import re
import ssl
import sys
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

# Build SSL context with certifi certs (macOS Python often lacks system certs)
try:
    import certifi
    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CONTEXT = ssl.create_default_context()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

API_BASE = "https://api.nal.usda.gov/fdc/v1"

# USDA food group codes to EXCLUDE (composites, branded, niche)
EXCLUDED_FOOD_GROUP_IDS = {
    3,   # Baby Foods
    21,  # Fast Foods
    22,  # Meals, Entrees, and Side Dishes
    25,  # Snacks
    35,  # American Indian/Alaska Native Foods
    36,  # Restaurant Foods
}

# USDA nutrient number → (our_column_name, unit_multiplier)
# Multiplier converts USDA unit → our unit (e.g., copper mg → mcg = ×1000)
NUTRIENT_MAP: dict[str, tuple[str, float]] = {
    "208": ("calories_kcal", 1.0),
    "203": ("protein_g", 1.0),
    "205": ("carbohydrate_g", 1.0),
    "204": ("fat_g", 1.0),
    "291": ("fiber_g", 1.0),
    "307": ("sodium_mg", 1.0),
    "301": ("calcium_mg", 1.0),
    "303": ("iron_mg", 1.0),
    "304": ("magnesium_mg", 1.0),
    "305": ("phosphorus_mg", 1.0),
    "306": ("potassium_mg", 1.0),
    "309": ("zinc_mg", 1.0),
    "312": ("copper_mcg", 1000.0),  # USDA gives mg, we store mcg
    "315": ("manganese_mg", 1.0),
    "321": ("beta_carotene_mcg", 1.0),
    "320": ("vitamin_a_mcg", 1.0),
    "328": ("vitamin_d_mcg", 1.0),
    "323": ("vitamin_e_mg", 1.0),
    "430": ("vitamin_k_mcg", 1.0),
    "401": ("vitamin_c_mg", 1.0),
    "404": ("vitamin_b1_mg", 1.0),
    "405": ("vitamin_b2_mg", 1.0),
    "406": ("vitamin_pp_mg", 1.0),
    "410": ("vitamin_b5_mg", 1.0),
    "415": ("vitamin_b6_mg", 1.0),
    "417": ("vitamin_b9_mcg", 1.0),
    "418": ("vitamin_b12_mcg", 1.0),
    "416": ("vitamin_h_mcg", 1.0),  # Biotin
}

# Columns in output CSV (matches vietnamese_food_composition table)
CSV_COLUMNS = [
    "id",
    "name_primary",
    "name_alt",
    "name_en",
    "type_vn",
    "type_en",
    "source_id",
    "state",
    "inedible_portion_pct",
    "calories_kcal",
    "protein_g",
    "carbohydrate_g",
    "fat_g",
    "fiber_g",
    "sodium_mg",
    "calcium_mg",
    "iron_mg",
    "magnesium_mg",
    "phosphorus_mg",
    "potassium_mg",
    "zinc_mg",
    "copper_mcg",
    "manganese_mg",
    "beta_carotene_mcg",
    "vitamin_a_mcg",
    "vitamin_d_mcg",
    "vitamin_e_mg",
    "vitamin_k_mcg",
    "vitamin_c_mg",
    "vitamin_b1_mg",
    "vitamin_b2_mg",
    "vitamin_pp_mg",
    "vitamin_b5_mg",
    "vitamin_b6_mg",
    "vitamin_b9_mcg",
    "vitamin_b12_mcg",
    "vitamin_h_mcg",
    "last_verified",
]

# USDA food category ID → (type_vn, type_en)
FOOD_CATEGORY_MAP: dict[int, tuple[str, str]] = {
    1:  ("Sữa và sản phẩm từ trứng", "Dairy and Egg Products"),
    2:  ("Gia vị và thảo mộc", "Spices and Herbs"),
    4:  ("Dầu mỡ", "Fats and Oils"),
    5:  ("Thịt gia cầm", "Poultry Products"),
    6:  ("Canh, nước sốt và nước dùng", "Soups, Sauces, and Gravies"),
    7:  ("Xúc xích và thịt nguội", "Sausages and Luncheon Meats"),
    8:  ("Ngũ cốc ăn sáng", "Breakfast Cereals"),
    9:  ("Trái cây và nước ép", "Fruits and Fruit Juices"),
    10: ("Thịt lợn", "Pork Products"),
    11: ("Rau và sản phẩm từ rau", "Vegetables and Vegetable Products"),
    12: ("Hạt và hạt giống", "Nut and Seed Products"),
    13: ("Thịt bò", "Beef Products"),
    14: ("Đồ uống", "Beverages"),
    15: ("Cá và hải sản", "Finfish and Shellfish Products"),
    16: ("Đậu và sản phẩm từ đậu", "Legumes and Legume Products"),
    17: ("Thịt cừu, bê và thú rừng", "Lamb, Veal, and Game Products"),
    18: ("Bánh nướng", "Baked Products"),
    19: ("Đồ ngọt", "Sweets"),
    20: ("Ngũ cốc và mì ống", "Cereal Grains and Pasta"),
}


# ---------------------------------------------------------------------------
# State parsing from USDA description
# ---------------------------------------------------------------------------

# Patterns indicating cooked state (ordered by specificity)
COOKED_PATTERNS = [
    r"\bcooked\b",
    r"\broasted\b",
    r"\bfried\b",
    r"\bbaked\b",
    r"\bboiled\b",
    r"\bsteamed\b",
    r"\bgrilled\b",
    r"\bbraised\b",
    r"\bstewed\b",
    r"\bsauteed\b",
    r"\bsimmered\b",
    r"\bsmoked\b",
    r"\btoasted\b",
    r"\bpoached\b",
    r"\bblanched\b",
    r"\bmicrowaved\b",
    r"\bbroiled\b",
    r"\bscrambled\b",
]

RAW_PATTERNS = [
    r"\braw\b",
    r"\buncooked\b",
    r"\bfresh\b",
]


def parse_state(description: str) -> str:
    """Parse cooking state from USDA food description.

    Returns 'raw' or 'cooked'. Defaults to 'raw' when ambiguous.
    """
    desc_lower = description.lower()

    for pattern in COOKED_PATTERNS:
        if re.search(pattern, desc_lower):
            return "cooked"

    for pattern in RAW_PATTERNS:
        if re.search(pattern, desc_lower):
            return "raw"

    # Default: if no cooking indicators found, assume raw
    return "raw"


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------

def api_request(
    endpoint: str,
    api_key: str,
    method: str = "GET",
    body: dict | None = None,
    retries: int = 3,
) -> dict | list:
    """Make an authenticated request to the USDA FDC API with retry logic."""
    url = f"{API_BASE}{endpoint}"
    separator = "&" if "?" in url else "?"
    url = f"{url}{separator}api_key={api_key}"

    headers = {"Content-Type": "application/json"}
    data = json.dumps(body).encode() if body else None
    req = Request(url, data=data, headers=headers, method=method)

    for attempt in range(retries):
        try:
            with urlopen(req, timeout=30, context=SSL_CONTEXT) as resp:
                return json.loads(resp.read())
        except HTTPError as e:
            if e.code == 429:
                wait = 60 * (attempt + 1)
                print(f"  ⚠ Rate limited. Waiting {wait}s before retry...")
                time.sleep(wait)
            elif e.code >= 500:
                wait = 5 * (attempt + 1)
                print(f"  ⚠ Server error {e.code}. Retry in {wait}s...")
                time.sleep(wait)
            else:
                raise
        except Exception as e:
            if attempt < retries - 1:
                wait = 5 * (attempt + 1)
                print(f"  ⚠ Error: {e}. Retry in {wait}s...")
                time.sleep(wait)
            else:
                raise

    raise RuntimeError(f"Failed after {retries} retries: {endpoint}")


# ---------------------------------------------------------------------------
# Phase 1: Collect all SR Legacy FDC IDs
# ---------------------------------------------------------------------------

def fetch_all_fdc_ids(api_key: str, dry_run: bool = False) -> list[dict]:
    """Paginate through /foods/list to collect all SR Legacy FDC IDs + descriptions."""
    all_foods: list[dict] = []
    page = 1
    page_size = 200

    while True:
        print(f"  Fetching list page {page}...")
        result = api_request(
            "/foods/list",
            api_key,
            method="POST",
            body={
                "dataType": ["SR Legacy"],
                "pageSize": page_size,
                "pageNumber": page,
                "sortBy": "fdcId",
                "sortOrder": "asc",
            },
        )

        if not result:
            break

        all_foods.extend(result)
        print(f"    Got {len(result)} items (total: {len(all_foods)})")

        if len(result) < page_size:
            break

        if dry_run and page >= 2:
            print("  [dry-run] Stopping after 2 pages")
            break

        page += 1
        time.sleep(1)  # Polite delay

    return all_foods


# ---------------------------------------------------------------------------
# Phase 2: Batch fetch full details (with food category)
# ---------------------------------------------------------------------------

def fetch_food_details_batch(
    fdc_ids: list[int],
    api_key: str,
    batch_size: int = 20,
    dry_run: bool = False,
) -> list[dict]:
    """Fetch full food details in batches of 20 via /foods endpoint."""
    all_details: list[dict] = []
    total_batches = (len(fdc_ids) + batch_size - 1) // batch_size

    for i in range(0, len(fdc_ids), batch_size):
        batch = fdc_ids[i : i + batch_size]
        batch_num = i // batch_size + 1
        print(f"  Fetching details batch {batch_num}/{total_batches} ({len(batch)} items)...")

        result = api_request(
            "/foods",
            api_key,
            method="POST",
            body={"fdcIds": batch, "format": "full"},
        )

        if isinstance(result, list):
            all_details.extend(result)
        else:
            print(f"    ⚠ Unexpected response type: {type(result)}")

        if dry_run and batch_num >= 5:
            print("  [dry-run] Stopping after 5 batches")
            break

        time.sleep(0.5)  # Polite delay

    return all_details


# ---------------------------------------------------------------------------
# Phase 3: Filter by food category
# ---------------------------------------------------------------------------

def filter_by_category(foods: list[dict]) -> tuple[list[dict], dict[str, int]]:
    """Filter out excluded food groups. Returns (kept, stats)."""
    kept: list[dict] = []
    stats: dict[str, int] = {"total": len(foods), "excluded": 0, "no_category": 0}
    excluded_counts: dict[str, int] = {}

    for food in foods:
        cat = food.get("foodCategory", {})
        cat_id = cat.get("id") if isinstance(cat, dict) else None

        if cat_id is None:
            # Foods without category — keep them (rare edge case)
            stats["no_category"] += 1
            kept.append(food)
            continue

        if cat_id in EXCLUDED_FOOD_GROUP_IDS:
            cat_desc = cat.get("description", f"ID {cat_id}")
            excluded_counts[cat_desc] = excluded_counts.get(cat_desc, 0) + 1
            stats["excluded"] += 1
            continue

        kept.append(food)

    stats["kept"] = len(kept)
    stats["excluded_breakdown"] = excluded_counts
    return kept, stats


# ---------------------------------------------------------------------------
# Phase 4: Extract nutrients and build rows
# ---------------------------------------------------------------------------

def extract_nutrients(food: dict) -> dict[str, float | None]:
    """Extract our 28 nutrients from USDA food nutrient list."""
    nutrients: dict[str, float | None] = {col: None for _, (col, _) in NUTRIENT_MAP.items()}

    for fn in food.get("foodNutrients", []):
        nutrient = fn.get("nutrient", {})
        number = str(nutrient.get("number", ""))
        amount = fn.get("amount")

        if number in NUTRIENT_MAP and amount is not None:
            col_name, multiplier = NUTRIENT_MAP[number]
            nutrients[col_name] = round(amount * multiplier, 4)

    return nutrients


def build_row(food: dict) -> dict:
    """Convert a USDA food item into a CSV row matching our schema."""
    description = food.get("description", "")
    ndb_number = food.get("ndbNumber", "")
    state = parse_state(description)
    food_id = f"usda_{ndb_number}_{state}"

    # Food category mapping
    cat = food.get("foodCategory", {})
    cat_id = cat.get("id") if isinstance(cat, dict) else None
    type_vn, type_en = FOOD_CATEGORY_MAP.get(cat_id, ("Khác", "Other"))

    nutrients = extract_nutrients(food)

    today = time.strftime("%Y-%m-%d")

    row = {
        "id": food_id,
        "name_primary": description,  # English name as primary (translation is separate phase)
        "name_alt": "{}",             # Empty array (PostgreSQL syntax)
        "name_en": description,
        "type_vn": type_vn,
        "type_en": type_en,
        "source_id": "2",             # 2 = USDA_SR in ingredient_sources table
        "state": state,
        "inedible_portion_pct": "",   # USDA doesn't have this in the same format
        "last_verified": today,
    }

    # Add all 28 nutrient columns
    for usda_num, (col_name, _) in NUTRIENT_MAP.items():
        value = nutrients.get(col_name)
        row[col_name] = str(value) if value is not None else ""

    return row


# ---------------------------------------------------------------------------
# Phase 5: Handle duplicate NDB numbers (same food, different states)
# ---------------------------------------------------------------------------

def deduplicate_rows(rows: list[dict]) -> list[dict]:
    """Handle foods that appear as both raw and cooked with the same NDB number.

    USDA may have separate entries (different fdcId) for the same NDB number
    with different descriptions (e.g., "Chicken, breast, raw" and
    "Chicken, breast, cooked, roasted"). These get the same ndb_number but
    different states, so their IDs will differ (usda_05009_raw vs usda_05009_cooked).

    If two entries map to the exact same ID, keep the one with more nutrient data.
    """
    seen: dict[str, dict] = {}
    duplicates = 0

    for row in rows:
        row_id = row["id"]
        if row_id in seen:
            # Keep the row with more non-empty nutrient values
            existing_nutrients = sum(
                1 for col in CSV_COLUMNS[9:-1]  # nutrient columns
                if seen[row_id].get(col, "") != ""
            )
            new_nutrients = sum(
                1 for col in CSV_COLUMNS[9:-1]
                if row.get(col, "") != ""
            )
            if new_nutrients > existing_nutrients:
                seen[row_id] = row
            duplicates += 1
        else:
            seen[row_id] = row

    if duplicates > 0:
        print(f"  ℹ Resolved {duplicates} duplicate IDs (kept rows with more nutrient data)")

    return list(seen.values())


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Download USDA SR Legacy data and export as CSV"
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("USDA_API_KEY"),
        help="USDA FoodData Central API key (or set USDA_API_KEY env var)",
    )
    parser.add_argument(
        "--out",
        required=True,
        help="Output directory for CSV and stats files",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch only first 2 list pages + 5 detail batches (for testing)",
    )
    args = parser.parse_args()

    if not args.api_key:
        print("Error: --api-key or USDA_API_KEY environment variable required")
        print("Sign up at https://fdc.nal.usda.gov/api-key-signup")
        sys.exit(1)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("USDA SR Legacy Download Pipeline")
    print("=" * 60)

    # Phase 1: Collect FDC IDs
    print("\n📋 Phase 1: Fetching SR Legacy food list...")
    foods_list = fetch_all_fdc_ids(args.api_key, dry_run=args.dry_run)
    fdc_ids = [f["fdcId"] for f in foods_list]
    print(f"  ✓ Found {len(fdc_ids)} SR Legacy foods")

    # Phase 2: Fetch full details
    print("\n🔍 Phase 2: Fetching full nutrient details...")
    foods_detailed = fetch_food_details_batch(
        fdc_ids, args.api_key, dry_run=args.dry_run
    )
    print(f"  ✓ Got details for {len(foods_detailed)} foods")

    # Phase 3: Filter
    print("\n🔧 Phase 3: Filtering excluded food groups...")
    foods_filtered, filter_stats = filter_by_category(foods_detailed)
    print(f"  ✓ Kept {filter_stats['kept']}, excluded {filter_stats['excluded']}")
    if filter_stats.get("excluded_breakdown"):
        for cat, count in sorted(
            filter_stats["excluded_breakdown"].items(), key=lambda x: -x[1]
        ):
            print(f"    - {cat}: {count}")

    # Phase 4: Build rows
    print("\n📊 Phase 4: Mapping nutrients and building rows...")
    rows = [build_row(food) for food in foods_filtered]
    print(f"  ✓ Built {len(rows)} rows")

    # Phase 5: Deduplicate
    print("\n🔄 Phase 5: Deduplicating...")
    rows = deduplicate_rows(rows)
    print(f"  ✓ Final count: {len(rows)} unique rows")

    # Phase 6: Write CSV
    csv_path = out_dir / "usda_sr_legacy.csv"
    print(f"\n💾 Phase 6: Writing CSV to {csv_path}...")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  ✓ Wrote {len(rows)} rows to {csv_path}")

    # Write stats
    stats_path = out_dir / "download_stats.json"
    stats = {
        "total_sr_legacy": len(fdc_ids),
        "details_fetched": len(foods_detailed),
        "after_filter": filter_stats["kept"],
        "excluded": filter_stats["excluded"],
        "excluded_breakdown": filter_stats.get("excluded_breakdown", {}),
        "no_category": filter_stats.get("no_category", 0),
        "final_unique_rows": len(rows),
        "dry_run": args.dry_run,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    with open(stats_path, "w") as f:
        json.dump(stats, f, indent=2)
    print(f"  ✓ Stats written to {stats_path}")

    # Summary
    print("\n" + "=" * 60)
    print("✅ Download complete!")
    print(f"   Foods: {len(rows)}")
    print(f"   CSV:   {csv_path}")
    print(f"   Stats: {stats_path}")
    print("=" * 60)

    # State distribution
    raw_count = sum(1 for r in rows if r["state"] == "raw")
    cooked_count = sum(1 for r in rows if r["state"] == "cooked")
    print(f"\n   State distribution: {raw_count} raw, {cooked_count} cooked")

    # Category distribution
    cat_counts: dict[str, int] = {}
    for r in rows:
        cat_counts[r["type_en"]] = cat_counts.get(r["type_en"], 0) + 1
    print("\n   Category distribution:")
    for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
        print(f"     {cat}: {count}")


if __name__ == "__main__":
    main()
