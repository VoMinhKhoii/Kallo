#!/usr/bin/env python3
"""Tests for USDA download script: nutrient mapping, state parsing, ID generation."""

import sys
from pathlib import Path

# Add scripts dir to path so we can import the module
sys.path.insert(0, str(Path(__file__).parent.parent))

from usda.download_usda_sr import (
    NUTRIENT_MAP,
    build_row,
    deduplicate_rows,
    extract_nutrients,
    filter_by_category,
    parse_state,
)

# ---------------------------------------------------------------------------
# State parsing
# ---------------------------------------------------------------------------


def test_parse_state_raw():
    assert parse_state("Chicken, breast, meat only, raw") == "raw"
    assert parse_state("Beef, ground, 80% lean meat / 20% fat, raw") == "raw"
    assert parse_state("Spinach, raw") == "raw"


def test_parse_state_cooked():
    assert parse_state("Chicken, breast, meat only, cooked, roasted") == "cooked"
    assert parse_state("Egg, whole, fried") == "cooked"
    assert parse_state("Rice, white, long-grain, regular, cooked") == "cooked"
    assert parse_state("Broccoli, boiled, drained, without salt") == "cooked"
    assert parse_state("Salmon, Atlantic, farmed, baked") == "cooked"
    assert parse_state("Pork, fresh, loin, tenderloin, roasted") == "cooked"
    assert parse_state("Potatoes, baked, flesh and skin") == "cooked"


def test_parse_state_specific_cooking_methods():
    """All specific cooking method patterns should map to 'cooked'."""
    methods = [
        "steamed", "grilled", "braised", "stewed", "sauteed",
        "simmered", "smoked", "toasted", "poached", "blanched",
        "microwaved", "broiled", "scrambled",
    ]
    for method in methods:
        assert parse_state(f"Food item, {method}") == "cooked", f"Failed for: {method}"


def test_parse_state_default_raw():
    """Items without cooking indicators default to raw."""
    assert parse_state("Butter, salted") == "raw"
    assert parse_state("Cheese, cheddar") == "raw"
    assert parse_state("Milk, whole, 3.25% milkfat") == "raw"
    assert parse_state("Oil, olive, salad or cooking") == "raw"


def test_parse_state_fresh_is_raw():
    assert parse_state("Strawberries, fresh") == "raw"


def test_parse_state_cooked_overrides_raw_context():
    """If both raw and cooked indicators present, cooked patterns checked first."""
    # "cooked" pattern is checked before "raw"
    assert parse_state("Chicken, raw meat, cooked, roasted") == "cooked"


# ---------------------------------------------------------------------------
# Nutrient extraction
# ---------------------------------------------------------------------------


def make_food_nutrient(number: str, amount: float) -> dict:
    return {"nutrient": {"number": number}, "amount": amount}


def test_extract_nutrients_basic():
    food = {
        "foodNutrients": [
            make_food_nutrient("208", 165.0),   # calories
            make_food_nutrient("203", 31.02),    # protein
            make_food_nutrient("204", 3.57),     # fat
            make_food_nutrient("205", 0.0),      # carbs
        ]
    }
    result = extract_nutrients(food)
    assert result["calories_kcal"] == 165.0
    assert result["protein_g"] == 31.02
    assert result["fat_g"] == 3.57
    assert result["carbohydrate_g"] == 0.0


def test_extract_nutrients_copper_conversion():
    """Copper must be converted from mg to mcg (×1000)."""
    food = {
        "foodNutrients": [make_food_nutrient("312", 0.045)]
    }
    result = extract_nutrients(food)
    assert result["copper_mcg"] == 45.0


def test_extract_nutrients_copper_precision():
    """Copper conversion preserves precision to 4 decimal places."""
    food = {
        "foodNutrients": [make_food_nutrient("312", 0.0123)]
    }
    result = extract_nutrients(food)
    assert result["copper_mcg"] == 12.3


def test_extract_nutrients_missing_returns_none():
    """Nutrients not present in USDA data should be None."""
    food = {"foodNutrients": []}
    result = extract_nutrients(food)
    for col_name in result.values():
        assert col_name is None


def test_extract_nutrients_ignores_unknown():
    """Unknown USDA nutrient numbers should be silently ignored."""
    food = {
        "foodNutrients": [
            make_food_nutrient("9999", 100.0),
            make_food_nutrient("208", 165.0),
        ]
    }
    result = extract_nutrients(food)
    assert result["calories_kcal"] == 165.0


def test_extract_nutrients_all_28_mapped():
    """All 28 nutrient mappings should be present in NUTRIENT_MAP."""
    assert len(NUTRIENT_MAP) == 28

    expected_columns = {
        "calories_kcal", "protein_g", "carbohydrate_g", "fat_g", "fiber_g",
        "sodium_mg", "calcium_mg", "iron_mg", "magnesium_mg", "phosphorus_mg",
        "potassium_mg", "zinc_mg", "copper_mcg", "manganese_mg",
        "beta_carotene_mcg", "vitamin_a_mcg", "vitamin_d_mcg", "vitamin_e_mg",
        "vitamin_k_mcg", "vitamin_c_mg", "vitamin_b1_mg", "vitamin_b2_mg",
        "vitamin_pp_mg", "vitamin_b5_mg", "vitamin_b6_mg", "vitamin_b9_mcg",
        "vitamin_b12_mcg", "vitamin_h_mcg",
    }
    mapped_columns = {col for col, _ in NUTRIENT_MAP.values()}
    assert mapped_columns == expected_columns


# ---------------------------------------------------------------------------
# ID generation and row building
# ---------------------------------------------------------------------------


def test_build_row_id_format():
    food = {
        "description": "Chicken, breast, meat only, raw",
        "ndbNumber": "05009",
        "foodCategory": {"id": 5, "description": "Poultry Products"},
        "foodNutrients": [],
    }
    row = build_row(food)
    assert row["id"] == "usda_05009_raw"
    assert row["source_id"] == "2"
    assert row["state"] == "raw"
    assert row["name_en"] == "Chicken, breast, meat only, raw"


def test_build_row_cooked():
    food = {
        "description": "Chicken, breast, meat only, cooked, roasted",
        "ndbNumber": "05009",
        "foodCategory": {"id": 5, "description": "Poultry Products"},
        "foodNutrients": [],
    }
    row = build_row(food)
    assert row["id"] == "usda_05009_cooked"
    assert row["state"] == "cooked"


def test_build_row_category_mapping():
    food = {
        "description": "Salmon, Atlantic, farmed, raw",
        "ndbNumber": "15236",
        "foodCategory": {"id": 15, "description": "Finfish and Shellfish Products"},
        "foodNutrients": [],
    }
    row = build_row(food)
    assert row["type_en"] == "Finfish and Shellfish Products"
    assert row["type_vn"] == "Cá và hải sản"


def test_build_row_unknown_category():
    food = {
        "description": "Mystery food",
        "ndbNumber": "99999",
        "foodCategory": {"id": 999, "description": "Unknown"},
        "foodNutrients": [],
    }
    row = build_row(food)
    assert row["type_en"] == "Other"
    assert row["type_vn"] == "Khác"


def test_build_row_nutrients_in_csv():
    food = {
        "description": "Test food, raw",
        "ndbNumber": "00001",
        "foodCategory": {"id": 1, "description": "Dairy"},
        "foodNutrients": [
            make_food_nutrient("208", 100.0),
            make_food_nutrient("312", 0.05),   # copper → 50 mcg
        ],
    }
    row = build_row(food)
    assert row["calories_kcal"] == "100.0"
    assert row["copper_mcg"] == "50.0"
    assert row["protein_g"] == ""  # missing nutrient → empty string


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------


def test_filter_excludes_correct_groups():
    foods = [
        {"fdcId": 1, "foodCategory": {"id": 5, "description": "Poultry"}},     # keep
        {"fdcId": 2, "foodCategory": {"id": 3, "description": "Baby Foods"}},   # exclude
        {"fdcId": 3, "foodCategory": {"id": 21, "description": "Fast Foods"}},  # exclude
        {"fdcId": 4, "foodCategory": {"id": 11, "description": "Vegetables"}},  # keep
        {"fdcId": 5, "foodCategory": {"id": 36, "description": "Restaurant"}},  # exclude
    ]
    kept, stats = filter_by_category(foods)
    assert len(kept) == 2
    assert stats["excluded"] == 3
    assert stats["kept"] == 2


def test_filter_keeps_no_category():
    """Foods without a category should be kept (edge case)."""
    foods = [{"fdcId": 1}]
    kept, stats = filter_by_category(foods)
    assert len(kept) == 1
    assert stats["no_category"] == 1


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------


def test_deduplicate_keeps_richer_row():
    rows = [
        {"id": "usda_05009_raw", "calories_kcal": "165.0", "protein_g": "", "carbohydrate_g": ""},
        {"id": "usda_05009_raw", "calories_kcal": "165.0", "protein_g": "31.0", "carbohydrate_g": "0.0"},
    ]
    result = deduplicate_rows(rows)
    assert len(result) == 1
    assert result[0]["protein_g"] == "31.0"


def test_deduplicate_different_states_kept():
    rows = [
        {"id": "usda_05009_raw", "calories_kcal": "120.0"},
        {"id": "usda_05009_cooked", "calories_kcal": "165.0"},
    ]
    result = deduplicate_rows(rows)
    assert len(result) == 2


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    test_fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    passed = failed = 0
    for fn in test_fns:
        try:
            fn()
            passed += 1
            print(f"  ✓ {fn.__name__}")
        except Exception as e:
            failed += 1
            print(f"  ✗ {fn.__name__}: {e}")

    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed")
    if failed:
        sys.exit(1)
