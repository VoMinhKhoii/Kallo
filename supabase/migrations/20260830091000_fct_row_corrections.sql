-- Two curated-FCT row corrections surfaced by the 2026-08-30 golden-set runs.
-- ⚠️ REVIEW BEFORE dbr:push — both edit source_id=1 (curated VN FCT) values.
--
-- 1. Bánh bao nhân thịt (fao_vn_2007_1009_cooked)
--    FCT macros describe a plain dough bun: P 6.1 / C 47.5 / F 0.5 per 100g.
--    0.5 g fat is impossible for a pork-and-egg-filled bun, and the golden
--    case gvn-2-banh-bao-regression fails on exactly this shape (carb 157 vs
--    [70,130] over, fat 3.9 vs [12,32] under — direction matches a dough-only
--    row scaled by the 165 g composed-bun prior).
--    Correction keeps the FCT ENERGY (219 kcal) and redistributes macros to a
--    composed pork-filled bun: P 9.0 / C 30.0 / F 7.0
--    (4×9 + 4×30 + 9×7 = 219 — kcal identity preserved exactly).
--
-- 2. Bún (fao_vn_2007_1020_raw)
--    state='raw' but the values are fresh-vermicelli density (110 kcal,
--    25.7 g carb per 100g — DRY rice noodles run ~350 kcal / ~80 g carb).
--    FCT 2007 bún is the fresh, ready-to-eat noodle. The wrong state makes
--    the STATE_MISMATCH_PENALTY skip this curated row for every cooked
--    noodle-soup query (bún bò Huế matched "Mì gạo đã nấu chín" instead) and
--    invites a wrong dry→cooked basis conversion when it is picked.
--    Correction: state='cooked'. Row id keeps its historical '_raw' suffix —
--    nothing parses state from the id (verified).

UPDATE public.vietnamese_food_composition
SET protein_g = 9.0,
    carbohydrate_g = 30.0,
    fat_g = 7.0,
    last_verified = '2026-08-30'
WHERE id = 'fao_vn_2007_1009_cooked';

UPDATE public.vietnamese_food_composition
SET state = 'cooked',
    last_verified = '2026-08-30'
WHERE id = 'fao_vn_2007_1020_raw';
