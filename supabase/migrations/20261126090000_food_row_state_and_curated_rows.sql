-- Food-row state corrections, tofu-puff names and curated MEXT rows
-- (food-data curation pass, 2026-11-25; every change is listed with its reason in
-- .cache/curation/changes.json).
--
-- `state` says which mass the per-100 g values describe: cooked = as eaten,
-- raw = before cooking / dry. The pipeline converts eaten grams back to raw
-- grams for raw rows (computeDbScalingGrams) and Call 2 sizes raw rows in raw
-- or dry mass, so a ready-to-eat food tagged raw is under- or over-counted and
-- a dry powder tagged cooked is weighed at its cooked portion.
-- Row ids keep their historical _raw / _cooked suffix; nothing parses state
-- from the id (see 20260830091000_fct_row_corrections.sql).
--
-- Supabase runs migrations before seed.sql, so on a fresh local reset the FAO
-- rows arrive afterwards with their seed state (as with the bún fix). The
-- USDA/NIN rows are imported separately; every UPDATE is a no-op when the row
-- is absent or already corrected.
-- New rows: embedding is left NULL and filled by the deploy backfill. Their
-- source MEXT_2020 is matchable only with its entry in MATCHING_SOURCE_BUCKETS
-- (lib/ai/matching/match-constants.ts), shipped in the same change.

SET search_path TO public, extensions;

-- A. state: values describe the food as eaten -> cooked
-- fao_vn_2007_1011_raw: bánh đúc is a steamed rice-flour cake, 52 kcal/100 g as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_1011_raw' AND state = 'raw';
-- fao_vn_2007_1012_raw: bánh mỳ is baked bread, 249 kcal/100 g as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_1012_raw' AND state = 'raw';
-- fao_vn_2007_1013_raw: fresh bánh phở, 143 kcal/100 g is hydrated ready-to-eat noodle (dry rice noodles ~350); same fix as bún (fao_vn_2007_1020_raw, 2026-08-30)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_1013_raw' AND state = 'raw';
-- fao_vn_2007_1015_raw: bỏng ngô is popped corn (form_processing puffed), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_1015_raw' AND state = 'raw';
-- fao_vn_2007_11015_raw: canned (retort-cooked) meat or fish, values are as eaten from the can
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_11015_raw' AND state = 'raw';
-- fao_vn_2007_11016_raw: canned (retort-cooked) meat or fish, values are as eaten from the can
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_11016_raw' AND state = 'raw';
-- fao_vn_2007_11017_raw: canned (retort-cooked) meat or fish, values are as eaten from the can
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_11017_raw' AND state = 'raw';
-- fao_vn_2007_11018_raw: canned (retort-cooked) meat or fish, values are as eaten from the can
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_11018_raw' AND state = 'raw';
-- fao_vn_2007_11019_raw: canned (retort-cooked) meat or fish, values are as eaten from the can
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_11019_raw' AND state = 'raw';
-- fao_vn_2007_11020_raw: canned (retort-cooked) meat or fish, values are as eaten from the can
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_11020_raw' AND state = 'raw';
-- fao_vn_2007_11021_raw: card cooking_method "stewed" says the values are for the stewed food ("Duck, stewed meat")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_11021_raw' AND state = 'raw';
-- fao_vn_2007_12001_raw: card cooking_method "baked" says the values are for the baked food ("Whole wheat rusk")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_12001_raw' AND state = 'raw';
-- fao_vn_2007_12002_raw: card cooking_method "baked" says the values are for the baked food ("Biscuits")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_12002_raw' AND state = 'raw';
-- fao_vn_2007_12003_raw: card cooking_method "baked" says the values are for the baked food ("Sweet meat pie in lumps")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_12003_raw' AND state = 'raw';
-- fao_vn_2007_12004_raw: card cooking_method "baked" says the values are for the baked food ("Small biscuits, fish figured")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_12004_raw' AND state = 'raw';
-- fao_vn_2007_12008_raw: card cooking_method "baked" says the values are for the baked food ("Cinnamon waffle (roll)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_12008_raw' AND state = 'raw';
-- fao_vn_2007_12011_raw: card cooking_method "baked" says the values are for the baked food ("Small biscuit")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_12011_raw' AND state = 'raw';
-- fao_vn_2007_2024_raw: card cooking_method "fried" says the values are for the fried food ("Potato crisp, fried")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_2024_raw' AND state = 'raw';
-- fao_vn_2007_3030_raw: card cooking_method "fried" says the values are for the fried food ("Cashew, common, roasted with oil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_3030_raw' AND state = 'raw';
-- fao_vn_2007_7063_raw: pa tê (pâté) is a cooked meat paste eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_7063_raw' AND state = 'raw';
-- fao_vn_2007_7066_raw: dăm bông (ham) is cooked ham eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_7066_raw' AND state = 'raw';
-- fao_vn_2007_7067_raw: dồi lợn: values (114 kcal, P 12.4, F 7.1) are identical to NIN nin_web_7067 "Dồi lợn, chín" (boiled)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_7067_raw' AND state = 'raw';
-- fao_vn_2007_7068_raw: giò bò is a steamed beef roll eaten as is (NIN nin_web_7068 "Giò bò, chín")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_7068_raw' AND state = 'raw';
-- fao_vn_2007_7072_raw: nem chạo is cooked pork mixed with toasted rice powder, eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_7072_raw' AND state = 'raw';
-- fao_vn_2007_7074_raw: ruốc / chà bông (pork floss) is cooked, shredded and dried pork, eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_7074_raw' AND state = 'raw';
-- fao_vn_2007_8058_raw: snakehead fish floss is cooked, shredded and dried fish, eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_8058_raw' AND state = 'raw';
-- fao_vn_2007_8059_raw: shrimp floss is cooked, shredded and dried shrimp, eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'fao_vn_2007_8059_raw' AND state = 'raw';
-- nin_web_1024002: card cooking_method "steamed" says the values are for the steamed food ("Rice glutinous (cooked), purple, boiled")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'nin_web_1024002' AND state = 'raw';
-- nin_web_1038: bánh bao chay is a steamed bun, 221 kcal/100 g as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'nin_web_1038' AND state = 'raw';
-- nin_web_12066: card cooking_method "fried" says the values are for the fried food ("Bim bim, gạo, mặn")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'nin_web_12066' AND state = 'raw';
-- nin_web_12072: card cooking_method "deep-fried" says the values are for the deep-fried food ("Đậu phộng da cá")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'nin_web_12072' AND state = 'raw';
-- nin_web_12089: card cooking_method "deep-fried" says the values are for the deep-fried food ("Bánh gối")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'nin_web_12089' AND state = 'raw';
-- nin_web_12091: card cooking_method "deep-fried" says the values are for the deep-fried food ("Bánh tiêu")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'nin_web_12091' AND state = 'raw';
-- nin_web_14070: card cooking_method "brewed" says the values are for the brewed food ("Trà túi lọc")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'nin_web_14070' AND state = 'raw';
-- nin_web_7142: card cooking_method "roasted" says the values are for the roasted food ("Thịt xá xíu")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'nin_web_7142' AND state = 'raw';
-- usda_10137_raw: canned, retort-cooked meat or fish; values are as eaten from the can (120 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10137_raw' AND state = 'raw';
-- usda_10184_raw: canned, retort-cooked meat or fish; values are as eaten from the can (144 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10184_raw' AND state = 'raw';
-- usda_10868_raw: card cooking_method "pan-broiled" says the values are for the pan-broiled food ("Pork, cured, ham -- water added, slice, bone-in, separable lean only, heated, pan-broil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10868_raw' AND state = 'raw';
-- usda_10869_raw: card cooking_method "pan-broiled" says the values are for the pan-broiled food ("Pork, cured, ham and water product, slice, bone-in, separable lean only, heated, pan-broil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10869_raw' AND state = 'raw';
-- usda_10870_raw: card cooking_method "pan-broiled" says the values are for the pan-broiled food ("Pork, cured, ham and water product, slice, boneless, separable lean only, heated, pan-broil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10870_raw' AND state = 'raw';
-- usda_10875_raw: card cooking_method "pan-broiled" says the values are for the pan-broiled food ("Pork, cured, ham with natural juices, slice, bone-in, separable lean only, heated, pan-broil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10875_raw' AND state = 'raw';
-- usda_10878_raw: card cooking_method "pan-broiled" says the values are for the pan-broiled food ("Pork, cured, ham -- water added, slice, boneless, separable lean only, heated, pan-broil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10878_raw' AND state = 'raw';
-- usda_10882_raw: card cooking_method "pan-broiled" says the values are for the pan-broiled food ("Pork, cured, ham with natural juices, slice, boneless, separable lean only, heated, pan-broil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10882_raw' AND state = 'raw';
-- usda_10894_raw: card cooking_method "heated" says the values are for the heated food ("Pork, cured, ham, separable fat, boneless, heated")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10894_raw' AND state = 'raw';
-- usda_10899_raw: card cooking_method "pan-broiled" says the values are for the pan-broiled food ("Pork, cured, ham, slice, bone-in, separable lean only, heated, pan-broil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10899_raw' AND state = 'raw';
-- usda_10915_raw: card cooking_method "pan-broiled" says the values are for the pan-broiled food ("Pork, cured, ham -- water added, slice, bone-in, separable lean and fat, heated, pan-broil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10915_raw' AND state = 'raw';
-- usda_10916_raw: card cooking_method "pan-broiled" says the values are for the pan-broiled food ("Pork, cured, ham -- water added, slice, boneless, separable lean and fat, heated, pan-broil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10916_raw' AND state = 'raw';
-- usda_10920_raw: card cooking_method "pan-broiled" says the values are for the pan-broiled food ("Pork, cured, ham and water product, slice, bone-in, separable lean and fat, heated, pan-broil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10920_raw' AND state = 'raw';
-- usda_10921_raw: card cooking_method "pan-broiled" says the values are for the pan-broiled food ("Pork, cured, ham and water product, slice, boneless, separable lean and fat, heated, pan-broil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10921_raw' AND state = 'raw';
-- usda_10925_raw: card cooking_method "pan-broiled" says the values are for the pan-broiled food ("Pork, cured, ham with natural juices, slice, bone-in, separable lean and fat, heated, pan-broil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10925_raw' AND state = 'raw';
-- usda_10926_raw: card cooking_method "pan-broiled" says the values are for the pan-broiled food ("Pork, cured, ham with natural juices, slice, boneless, separable lean and fat, heated, pan-broil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10926_raw' AND state = 'raw';
-- usda_10937_raw: card cooking_method "pan-broiled" says the values are for the pan-broiled food ("Pork, cured, ham, slice, bone-in, separable lean and fat, heated, pan-broil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_10937_raw' AND state = 'raw';
-- usda_11212_raw: source name says the food is prepared/cooked ("Edamame, frozen, prepared"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11212_raw' AND state = 'raw';
-- usda_11349_raw: source name says the food is prepared/cooked ("Poi"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11349_raw' AND state = 'raw';
-- usda_11370_raw: source name says the food is prepared/cooked ("Potatoes, hash brown, home-prepared"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11370_raw' AND state = 'raw';
-- usda_11371_raw: source name says the food is prepared/cooked ("Potatoes, mashed, home-prepared, whole milk and margarine added"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11371_raw' AND state = 'raw';
-- usda_11372_raw: source name says the food is prepared/cooked ("Potatoes, scalloped, home-prepared with butter"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11372_raw' AND state = 'raw';
-- usda_11373_raw: card cooking_method "baked" says the values are for the baked food ("Potatoes, au gratin, home-prepared from recipe using butter")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11373_raw' AND state = 'raw';
-- usda_11379_raw: source name says the food is prepared/cooked ("Potatoes, mashed, dehydrated, prepared from flakes without milk, whole milk and butter added"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11379_raw' AND state = 'raw';
-- usda_11381_raw: source name says the food is prepared/cooked ("Potatoes, mashed, dehydrated, prepared from granules without milk, whole milk and butter added"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11381_raw' AND state = 'raw';
-- usda_11383_raw: source name says the food is prepared/cooked ("Potatoes, mashed, dehydrated, prepared from granules with milk, water and margarine added"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11383_raw' AND state = 'raw';
-- usda_11385_raw: source name says the food is prepared/cooked ("Potatoes, au gratin, dry mix, prepared with water, whole milk and butter"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11385_raw' AND state = 'raw';
-- usda_11387_raw: source name says the food is prepared/cooked ("Potatoes, scalloped, dry mix, prepared with water, whole milk and butter"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11387_raw' AND state = 'raw';
-- usda_11393_raw: source name says the food is prepared/cooked ("Potatoes, hash brown, frozen, with butter sauce, prepared"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11393_raw' AND state = 'raw';
-- usda_11397_raw: source name says the food is prepared/cooked ("Potatoes, o'brien, frozen, prepared"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11397_raw' AND state = 'raw';
-- usda_11399_raw: card cooking_method "oven-heated" says the values are for the oven-heated food ("Potato puffs, frozen, oven-heated")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11399_raw' AND state = 'raw';
-- usda_11414_raw: source name says the food is prepared/cooked ("Potato salad, home-prepared"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11414_raw' AND state = 'raw';
-- usda_11656_raw: source name says the food is prepared/cooked ("Corn pudding, home prepared"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11656_raw' AND state = 'raw';
-- usda_11657_raw: source name says the food is prepared/cooked ("Potatoes, mashed, home-prepared, whole milk added"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11657_raw' AND state = 'raw';
-- usda_11658_raw: source name says the food is prepared/cooked ("Spinach souffle"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11658_raw' AND state = 'raw';
-- usda_11671_raw: source name says the food is prepared/cooked ("Potatoes, o'brien, home-prepared"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11671_raw' AND state = 'raw';
-- usda_11672_raw: source name says the food is prepared/cooked ("Potato pancakes"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11672_raw' AND state = 'raw';
-- usda_11843_raw: card cooking_method "baked" says the values are for the baked food ("Potatoes, au gratin, home-prepared from recipe using margarine")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11843_raw' AND state = 'raw';
-- usda_11844_raw: source name says the food is prepared/cooked ("Potatoes, scalloped, home-prepared with margarine"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11844_raw' AND state = 'raw';
-- usda_11929_raw: source name says the food is prepared/cooked ("Potatoes, mashed, prepared from granules, without milk, whole milk and margarine"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11929_raw' AND state = 'raw';
-- usda_11930_raw: source name says the food is prepared/cooked ("Potatoes, mashed, dehydrated, prepared from flakes without milk, whole milk and margarine added"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11930_raw' AND state = 'raw';
-- usda_11934_raw: source name says the food is prepared/cooked ("Potatoes, mashed, home-prepared, whole milk and butter added"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_11934_raw' AND state = 'raw';
-- usda_13348_raw: canned, retort-cooked meat or fish; values are as eaten from the can (250 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_13348_raw' AND state = 'raw';
-- usda_14180_raw: card cooking_method "brewed" says the values are for the brewed food ("Beverages, coffee, brewed, breakfast blend")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_14180_raw' AND state = 'raw';
-- usda_14185_raw: card cooking_method "brewed" says the values are for the brewed food ("Beverages, tea, Oolong, brewed")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_14185_raw' AND state = 'raw';
-- usda_14201_raw: card cooking_method "brewed" says the values are for the brewed food ("Beverages, coffee, brewed, prepared with tap water, decaffeinated")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_14201_raw' AND state = 'raw';
-- usda_14202_raw: card cooking_method "brewed" says the values are for the brewed food ("Beverages, coffee, brewed, espresso, restaurant-prepared, decaffeinated")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_14202_raw' AND state = 'raw';
-- usda_14209_raw: card cooking_method "brewed" says the values are for the brewed food ("Beverages, coffee, brewed, prepared with tap water")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_14209_raw' AND state = 'raw';
-- usda_14210_raw: card cooking_method "brewed" says the values are for the brewed food ("Beverages, coffee, brewed, espresso, restaurant-prepared")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_14210_raw' AND state = 'raw';
-- usda_14260_raw: card cooking_method "brewed" says the values are for the brewed food ("Beverages, tea, green, brewed, decaffeinated")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_14260_raw' AND state = 'raw';
-- usda_14278_raw: card cooking_method "brewed" says the values are for the brewed food ("Beverages, tea, green, brewed, regular")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_14278_raw' AND state = 'raw';
-- usda_14352_raw: card cooking_method "brewed" says the values are for the brewed food ("Beverages, tea, black, brewed, prepared with tap water, decaffeinated")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_14352_raw' AND state = 'raw';
-- usda_14355_raw: card cooking_method "brewed" says the values are for the brewed food ("Beverages, tea, black, brewed, prepared with tap water")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_14355_raw' AND state = 'raw';
-- usda_14381_raw: card cooking_method "brewed" says the values are for the brewed food ("Beverages, tea, herb, other than chamomile, brewed")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_14381_raw' AND state = 'raw';
-- usda_14544_raw: card cooking_method "brewed" says the values are for the brewed food ("Beverages, tea, black, brewed, prepared with distilled water")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_14544_raw' AND state = 'raw';
-- usda_14545_raw: card cooking_method "brewed" says the values are for the brewed food ("Beverages, tea, herb, brewed, chamomile")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_14545_raw' AND state = 'raw';
-- usda_14649_raw: card cooking_method "brewed" says the values are for the brewed food ("Beverages, tea, hibiscus, brewed")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_14649_raw' AND state = 'raw';
-- usda_15002_raw: canned, retort-cooked meat or fish; values are as eaten from the can (210 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15002_raw' AND state = 'raw';
-- usda_15017_raw: canned, retort-cooked meat or fish; values are as eaten from the can (105 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15017_raw' AND state = 'raw';
-- usda_15027_raw: source name says the food is prepared/cooked ("Fish, fish sticks, frozen, prepared"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15027_raw' AND state = 'raw';
-- usda_15048_raw: canned, retort-cooked meat or fish; values are as eaten from the can (156 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15048_raw' AND state = 'raw';
-- usda_15080_raw: canned, retort-cooked meat or fish; values are as eaten from the can (141 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15080_raw' AND state = 'raw';
-- usda_15084_raw: canned, retort-cooked meat or fish; values are as eaten from the can (129 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15084_raw' AND state = 'raw';
-- usda_15087_raw: canned, retort-cooked meat or fish; values are as eaten from the can (167 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15087_raw' AND state = 'raw';
-- usda_15088_raw: canned, retort-cooked meat or fish; values are as eaten from the can (208 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15088_raw' AND state = 'raw';
-- usda_15089_raw: canned, retort-cooked meat or fish; values are as eaten from the can (185 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15089_raw' AND state = 'raw';
-- usda_15119_raw: canned, retort-cooked meat or fish; values are as eaten from the can (198 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15119_raw' AND state = 'raw';
-- usda_15121_raw: canned, retort-cooked meat or fish; values are as eaten from the can (86 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15121_raw' AND state = 'raw';
-- usda_15124_raw: canned, retort-cooked meat or fish; values are as eaten from the can (186 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15124_raw' AND state = 'raw';
-- usda_15126_raw: canned, retort-cooked meat or fish; values are as eaten from the can (128 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15126_raw' AND state = 'raw';
-- usda_15141_raw: canned, retort-cooked meat or fish; values are as eaten from the can (83 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15141_raw' AND state = 'raw';
-- usda_15142_raw: source name says the food is prepared/cooked ("Crustaceans, crab, blue, crab cakes, home recipe"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15142_raw' AND state = 'raw';
-- usda_15152_raw: canned, retort-cooked meat or fish; values are as eaten from the can (100 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15152_raw' AND state = 'raw';
-- usda_15160_raw: canned, retort-cooked meat or fish; values are as eaten from the can (142 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15160_raw' AND state = 'raw';
-- usda_15162_raw: canned, retort-cooked meat or fish; values are as eaten from the can (2 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15162_raw' AND state = 'raw';
-- usda_15170_raw: canned, retort-cooked meat or fish; values are as eaten from the can (68 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15170_raw' AND state = 'raw';
-- usda_15180_raw: canned, retort-cooked meat or fish; values are as eaten from the can (141 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15180_raw' AND state = 'raw';
-- usda_15181_raw: canned, retort-cooked meat or fish; values are as eaten from the can (139 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15181_raw' AND state = 'raw';
-- usda_15182_raw: canned, retort-cooked meat or fish; values are as eaten from the can (153 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15182_raw' AND state = 'raw';
-- usda_15183_raw: canned, retort-cooked meat or fish; values are as eaten from the can (198 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15183_raw' AND state = 'raw';
-- usda_15184_raw: canned, retort-cooked meat or fish; values are as eaten from the can (116 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15184_raw' AND state = 'raw';
-- usda_15185_raw: canned, retort-cooked meat or fish; values are as eaten from the can (186 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15185_raw' AND state = 'raw';
-- usda_15186_raw: canned, retort-cooked meat or fish; values are as eaten from the can (128 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15186_raw' AND state = 'raw';
-- usda_15251_raw: card cooking_method "heated" says the values are for the heated food ("Salmon nuggets, breaded, frozen, heated")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15251_raw' AND state = 'raw';
-- usda_15253_raw: canned, retort-cooked meat or fish; values are as eaten from the can (153 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15253_raw' AND state = 'raw';
-- usda_15260_raw: canned, retort-cooked meat or fish; values are as eaten from the can (138 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15260_raw' AND state = 'raw';
-- usda_15264_raw: canned, retort-cooked meat or fish; values are as eaten from the can (158 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15264_raw' AND state = 'raw';
-- usda_15265_raw: canned, retort-cooked meat or fish; values are as eaten from the can (136 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_15265_raw' AND state = 'raw';
-- usda_16003_raw: canned, hydrated cooked legumes; values are as eaten from the can (237 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16003_raw' AND state = 'raw';
-- usda_16018_raw: canned, hydrated cooked legumes; values are as eaten from the can (91 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16018_raw' AND state = 'raw';
-- usda_16021_raw: canned, hydrated cooked legumes; values are as eaten from the can (83 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16021_raw' AND state = 'raw';
-- usda_16026_raw: canned, hydrated cooked legumes; values are as eaten from the can (114 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16026_raw' AND state = 'raw';
-- usda_16029_raw: canned, hydrated cooked legumes; values are as eaten from the can (84 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16029_raw' AND state = 'raw';
-- usda_16034_raw: canned, hydrated cooked legumes; values are as eaten from the can (81 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16034_raw' AND state = 'raw';
-- usda_16039_raw: canned, hydrated cooked legumes; values are as eaten from the can (113 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16039_raw' AND state = 'raw';
-- usda_16044_raw: canned, hydrated cooked legumes; values are as eaten from the can (82 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16044_raw' AND state = 'raw';
-- usda_16051_raw: canned, hydrated cooked legumes; values are as eaten from the can (114 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16051_raw' AND state = 'raw';
-- usda_16054_raw: canned, hydrated cooked legumes; values are as eaten from the can (71 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16054_raw' AND state = 'raw';
-- usda_16058_raw: canned, hydrated cooked legumes; values are as eaten from the can (88 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16058_raw' AND state = 'raw';
-- usda_16059_raw: canned, hydrated cooked legumes; values are as eaten from the can (103 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16059_raw' AND state = 'raw';
-- usda_16064_raw: canned, hydrated cooked legumes; values are as eaten from the can (77 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16064_raw' AND state = 'raw';
-- usda_16065_raw: canned, hydrated cooked legumes; values are as eaten from the can (83 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16065_raw' AND state = 'raw';
-- usda_16073_raw: canned, hydrated cooked legumes; values are as eaten from the can (79 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16073_raw' AND state = 'raw';
-- usda_16103_raw: canned, hydrated cooked legumes; values are as eaten from the can (90 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16103_raw' AND state = 'raw';
-- usda_16137_raw: source name says the food is prepared/cooked ("Hummus, home prepared"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16137_raw' AND state = 'raw';
-- usda_16138_raw: source name says the food is prepared/cooked ("Falafel, home-prepared"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16138_raw' AND state = 'raw';
-- usda_16145_raw: canned, hydrated cooked legumes; values are as eaten from the can (124 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16145_raw' AND state = 'raw';
-- usda_16146_raw: canned, hydrated cooked legumes; values are as eaten from the can (114 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16146_raw' AND state = 'raw';
-- usda_16171_raw: canned, hydrated cooked legumes; values are as eaten from the can (83 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16171_raw' AND state = 'raw';
-- usda_16172_raw: canned, hydrated cooked legumes; values are as eaten from the can (79 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16172_raw' AND state = 'raw';
-- usda_16173_raw: canned, hydrated cooked legumes; values are as eaten from the can (144 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16173_raw' AND state = 'raw';
-- usda_16316_raw: canned, hydrated cooked legumes; values are as eaten from the can (91 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16316_raw' AND state = 'raw';
-- usda_16326_raw: canned, hydrated cooked legumes; values are as eaten from the can (114 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16326_raw' AND state = 'raw';
-- usda_16335_raw: canned, hydrated cooked legumes; values are as eaten from the can (121 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16335_raw' AND state = 'raw';
-- usda_16337_raw: canned, hydrated cooked legumes; values are as eaten from the can (81 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16337_raw' AND state = 'raw';
-- usda_16345_raw: canned, hydrated cooked legumes; values are as eaten from the can (117 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16345_raw' AND state = 'raw';
-- usda_16347_raw: canned, hydrated cooked legumes; values are as eaten from the can (82 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16347_raw' AND state = 'raw';
-- usda_16358_raw: canned, hydrated cooked legumes; values are as eaten from the can (139 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16358_raw' AND state = 'raw';
-- usda_16359_raw: canned, hydrated cooked legumes; values are as eaten from the can (138 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16359_raw' AND state = 'raw';
-- usda_16360_raw: canned, hydrated cooked legumes; values are as eaten from the can (88 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16360_raw' AND state = 'raw';
-- usda_16403_raw: canned, hydrated cooked legumes; values are as eaten from the can (89 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_16403_raw' AND state = 'raw';
-- usda_18001_raw: baked bread, eaten as is ("Bagels, plain, enriched, with calcium propionate (includes onion, poppy, sesame)"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18001_raw' AND state = 'raw';
-- usda_18003_raw: baked bread, eaten as is ("Bagels, egg"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18003_raw' AND state = 'raw';
-- usda_18005_raw: baked bread, eaten as is ("Bagels, cinnamon-raisin"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18005_raw' AND state = 'raw';
-- usda_18007_raw: baked bread, eaten as is ("Bagels, oat bran"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18007_raw' AND state = 'raw';
-- usda_18021_raw: baked bread, eaten as is ("Bread, boston brown, canned"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18021_raw' AND state = 'raw';
-- usda_18023_raw: baked bread, eaten as is ("Bread, cornbread, dry mix, prepared with 2% milk, 80% margarine, and eggs"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18023_raw' AND state = 'raw';
-- usda_18024_raw: baked bread, eaten as is ("Bread, cornbread, prepared from recipe, made with low fat (2%) milk"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18024_raw' AND state = 'raw';
-- usda_18025_raw: baked bread, eaten as is ("Bread, cracked-wheat"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18025_raw' AND state = 'raw';
-- usda_18027_raw: baked bread, eaten as is ("Bread, egg"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18027_raw' AND state = 'raw';
-- usda_18032_raw: baked bread, eaten as is ("Bread, irish soda, prepared from recipe"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18032_raw' AND state = 'raw';
-- usda_18033_raw: baked bread, eaten as is ("Bread, Italian"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18033_raw' AND state = 'raw';
-- usda_18037_raw: baked bread, eaten as is ("Bread, oat bran"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18037_raw' AND state = 'raw';
-- usda_18039_raw: baked bread, eaten as is ("Bread, oatmeal"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18039_raw' AND state = 'raw';
-- usda_18041_raw: baked bread, eaten as is ("Bread, pita, white, enriched"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18041_raw' AND state = 'raw';
-- usda_18042_raw: baked bread, eaten as is ("Bread, pita, whole-wheat"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18042_raw' AND state = 'raw';
-- usda_18043_raw: baked bread, eaten as is ("Bread, protein (includes gluten)"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18043_raw' AND state = 'raw';
-- usda_18044_raw: baked bread, eaten as is ("Bread, pumpernickel"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18044_raw' AND state = 'raw';
-- usda_18047_raw: baked bread, eaten as is ("Bread, raisin, enriched"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18047_raw' AND state = 'raw';
-- usda_18049_raw: baked bread, eaten as is ("Bread, reduced-calorie, oat bran"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18049_raw' AND state = 'raw';
-- usda_18051_raw: baked bread, eaten as is ("Bread, reduced-calorie, oatmeal"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18051_raw' AND state = 'raw';
-- usda_18053_raw: baked bread, eaten as is ("Bread, reduced-calorie, rye"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18053_raw' AND state = 'raw';
-- usda_18055_raw: baked bread, eaten as is ("Bread, reduced-calorie, wheat"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18055_raw' AND state = 'raw';
-- usda_18057_raw: baked bread, eaten as is ("Bread, reduced-calorie, white"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18057_raw' AND state = 'raw';
-- usda_18059_raw: baked bread, eaten as is ("Bread, rice bran"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18059_raw' AND state = 'raw';
-- usda_18060_raw: baked bread, eaten as is ("Bread, rye"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18060_raw' AND state = 'raw';
-- usda_18064_raw: baked bread, eaten as is ("Bread, wheat"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18064_raw' AND state = 'raw';
-- usda_18069_raw: baked bread, eaten as is ("Bread, white, commercially prepared (includes soft bread crumbs)"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18069_raw' AND state = 'raw';
-- usda_18071_raw: baked bread, eaten as is ("Bread, white, prepared from recipe, made with nonfat dry milk"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18071_raw' AND state = 'raw';
-- usda_18073_raw: baked bread, eaten as is ("Bread, white, prepared from recipe, made with low fat (2%) milk"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18073_raw' AND state = 'raw';
-- usda_18075_raw: baked bread, eaten as is ("Bread, whole-wheat, commercially prepared"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18075_raw' AND state = 'raw';
-- usda_18077_raw: baked bread, eaten as is ("Bread, whole-wheat, prepared from recipe"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18077_raw' AND state = 'raw';
-- usda_18080_raw: baked bread, eaten as is ("Bread, sticks, plain"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18080_raw' AND state = 'raw';
-- usda_18082_raw: source name says the food is prepared/cooked ("Bread, stuffing, dry mix, prepared"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18082_raw' AND state = 'raw';
-- usda_18085_raw: source name says the food is prepared/cooked ("Bread, stuffing, cornbread, dry mix, prepared"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18085_raw' AND state = 'raw';
-- usda_18239_raw: baked bread, eaten as is ("Croissants, butter"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18239_raw' AND state = 'raw';
-- usda_18240_raw: baked bread, eaten as is ("Croissants, apple"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18240_raw' AND state = 'raw';
-- usda_18241_raw: baked bread, eaten as is ("Croissants, cheese"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18241_raw' AND state = 'raw';
-- usda_18248_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Doughnuts, cake-type, plain (includes unsugared, old-fashioned)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18248_raw' AND state = 'raw';
-- usda_18249_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Doughnuts, cake-type, plain, chocolate-coated or frosted")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18249_raw' AND state = 'raw';
-- usda_18250_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Doughnuts, cake-type, plain, sugared or glazed")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18250_raw' AND state = 'raw';
-- usda_18251_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Doughnuts, cake-type, chocolate, sugared or glazed")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18251_raw' AND state = 'raw';
-- usda_18253_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Doughnuts, french crullers, glazed")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18253_raw' AND state = 'raw';
-- usda_18254_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Doughnuts, yeast-leavened, with creme filling")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18254_raw' AND state = 'raw';
-- usda_18255_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Doughnuts, yeast-leavened, glazed, enriched (includes honey buns)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18255_raw' AND state = 'raw';
-- usda_18256_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Doughnuts, yeast-leavened, with jelly filling")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18256_raw' AND state = 'raw';
-- usda_18268_raw: source name says the food is prepared/cooked ("French toast, frozen, ready-to-heat"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18268_raw' AND state = 'raw';
-- usda_18269_raw: source name says the food is prepared/cooked ("French toast, prepared from recipe, made with low fat (2%) milk"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18269_raw' AND state = 'raw';
-- usda_18270_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Hush puppies, prepared from recipe")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18270_raw' AND state = 'raw';
-- usda_18288_raw: source name says the food is prepared/cooked ("Pancakes plain, frozen, ready-to-heat (includes buttermilk)"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18288_raw' AND state = 'raw';
-- usda_18290_raw: source name says the food is prepared/cooked ("Pancakes, plain, dry mix, complete, prepared"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18290_raw' AND state = 'raw';
-- usda_18292_raw: source name says the food is prepared/cooked ("Pancakes, plain, dry mix, incomplete, prepared"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18292_raw' AND state = 'raw';
-- usda_18294_raw: source name says the food is prepared/cooked ("Pancakes, blueberry, prepared from recipe"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18294_raw' AND state = 'raw';
-- usda_18342_raw: baked bread, eaten as is ("Rolls, dinner, plain, commercially prepared (includes brown-and-serve)"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18342_raw' AND state = 'raw';
-- usda_18344_raw: baked bread, eaten as is ("Rolls, dinner, egg"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18344_raw' AND state = 'raw';
-- usda_18345_raw: baked bread, eaten as is ("Rolls, dinner, oat bran"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18345_raw' AND state = 'raw';
-- usda_18346_raw: baked bread, eaten as is ("Rolls, dinner, rye"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18346_raw' AND state = 'raw';
-- usda_18347_raw: baked bread, eaten as is ("Rolls, dinner, wheat"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18347_raw' AND state = 'raw';
-- usda_18348_raw: baked bread, eaten as is ("Rolls, dinner, whole-wheat"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18348_raw' AND state = 'raw';
-- usda_18349_raw: baked bread, eaten as is ("Rolls, french"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18349_raw' AND state = 'raw';
-- usda_18350_raw: baked bread, eaten as is ("Rolls, hamburger or hotdog, plain"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18350_raw' AND state = 'raw';
-- usda_18351_raw: baked bread, eaten as is ("Rolls, hamburger or hotdog, mixed-grain"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18351_raw' AND state = 'raw';
-- usda_18353_raw: baked bread, eaten as is ("Rolls, hard (includes kaiser)"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18353_raw' AND state = 'raw';
-- usda_18390_raw: source name says the food is prepared/cooked ("Pancakes, buttermilk, prepared from recipe"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18390_raw' AND state = 'raw';
-- usda_18396_raw: baked bread, eaten as is ("Rolls, dinner, plain, prepared from recipe, made with low fat (2%) milk"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18396_raw' AND state = 'raw';
-- usda_18406_raw: baked bread, eaten as is ("Bagels, plain, enriched, without calcium propionate (includes onion, poppy, sesame)"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18406_raw' AND state = 'raw';
-- usda_18407_raw: baked bread, eaten as is ("Bagels, plain, unenriched, with calcium propionate (includes onion, poppy, sesame)"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18407_raw' AND state = 'raw';
-- usda_18408_raw: baked bread, eaten as is ("Bagels, plain, unenriched, without calcium propionate(includes onion, poppy, sesame)"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18408_raw' AND state = 'raw';
-- usda_18413_raw: baked bread, eaten as is ("Bread, pita, white, unenriched"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18413_raw' AND state = 'raw';
-- usda_18414_raw: baked bread, eaten as is ("Bread, raisin, unenriched"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18414_raw' AND state = 'raw';
-- usda_18416_raw: baked bread, eaten as is ("Bread, white, commercially prepared, low sodium, no salt"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18416_raw' AND state = 'raw';
-- usda_18436_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Doughnuts, yeast-leavened, glazed, unenriched (includes honey buns)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18436_raw' AND state = 'raw';
-- usda_18641_raw: baked bread, eaten as is ("Interstate Brands Corp, Wonder Hamburger Rolls"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18641_raw' AND state = 'raw';
-- usda_18935_raw: card cooking_method "microwaved" says the values are for the microwaved food ("Waffle, plain, frozen, ready-to-heat, microwave")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18935_raw' AND state = 'raw';
-- usda_18936_raw: source name says the food is prepared/cooked ("Pancakes, plain, frozen, ready-to-heat, microwave (includes buttermilk)"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18936_raw' AND state = 'raw';
-- usda_18955_raw: baked bread, eaten as is ("Bread, pan dulce, sweet yeast bread"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18955_raw' AND state = 'raw';
-- usda_18967_raw: baked bread, eaten as is ("Bread, white wheat"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18967_raw' AND state = 'raw';
-- usda_18968_raw: baked bread, eaten as is ("Bagels, wheat"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18968_raw' AND state = 'raw';
-- usda_18971_raw: baked bread, eaten as is ("Bread, potato"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18971_raw' AND state = 'raw';
-- usda_18972_raw: baked bread, eaten as is ("Bread, cheese"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18972_raw' AND state = 'raw';
-- usda_18973_raw: baked bread, eaten as is ("Focaccia, Italian flatbread, plain"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_18973_raw' AND state = 'raw';
-- usda_19003_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, corn-based, extruded, chips, plain")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19003_raw' AND state = 'raw';
-- usda_19004_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, corn-based, extruded, chips, barbecue-flavor")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19004_raw' AND state = 'raw';
-- usda_19005_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, corn-based, extruded, cones, plain")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19005_raw' AND state = 'raw';
-- usda_19007_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, corn-based, extruded, onion-flavor")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19007_raw' AND state = 'raw';
-- usda_19008_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, corn-based, extruded, puffs or twists, cheese-flavor")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19008_raw' AND state = 'raw';
-- usda_19009_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, KRAFT, CORNNUTS, plain")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19009_raw' AND state = 'raw';
-- usda_19034_raw: card cooking_method "air-popped" says the values are for the air-popped food ("Snacks, popcorn, air-popped")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19034_raw' AND state = 'raw';
-- usda_19035_raw: card cooking_method "microwaved" says the values are for the microwaved food ("Snacks, popcorn, oil-popped, microwave, regular flavor, no trans fat")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19035_raw' AND state = 'raw';
-- usda_19041_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, pork skins, plain")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19041_raw' AND state = 'raw';
-- usda_19042_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, potato chips, barbecue-flavor")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19042_raw' AND state = 'raw';
-- usda_19043_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, potato chips, sour-cream-and-onion-flavor")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19043_raw' AND state = 'raw';
-- usda_19045_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, potato chips, made from dried potatoes, reduced fat")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19045_raw' AND state = 'raw';
-- usda_19046_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, potato chips, made from dried potatoes, sour-cream and onion-flavor")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19046_raw' AND state = 'raw';
-- usda_19056_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, tortilla chips, plain, white corn, salted")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19056_raw' AND state = 'raw';
-- usda_19057_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, tortilla chips, nacho cheese")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19057_raw' AND state = 'raw';
-- usda_19058_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, tortilla chips, ranch-flavor")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19058_raw' AND state = 'raw';
-- usda_19063_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, tortilla chips, taco-flavor")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19063_raw' AND state = 'raw';
-- usda_19094_raw: source name says the food is prepared/cooked ("Desserts, flan, caramel custard, prepared-from-recipe"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19094_raw' AND state = 'raw';
-- usda_19170_raw: source name says the food is prepared/cooked ("Egg custards, dry mix, prepared with whole milk"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19170_raw' AND state = 'raw';
-- usda_19186_raw: source name says the food is prepared/cooked ("Desserts, apple crisp, prepared-from-recipe"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19186_raw' AND state = 'raw';
-- usda_19205_raw: source name says the food is prepared/cooked ("Egg custards, dry mix, prepared with 2% milk"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19205_raw' AND state = 'raw';
-- usda_19231_raw: source name says the food is prepared/cooked ("Flan, caramel custard, dry mix, prepared with 2% milk"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19231_raw' AND state = 'raw';
-- usda_19232_raw: source name says the food is prepared/cooked ("Flan, caramel custard, dry mix, prepared with whole milk"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19232_raw' AND state = 'raw';
-- usda_19400_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, banana chips")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19400_raw' AND state = 'raw';
-- usda_19401_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, cornnuts, barbecue-flavor")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19401_raw' AND state = 'raw';
-- usda_19408_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, pork skins, barbecue-flavor")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19408_raw' AND state = 'raw';
-- usda_19410_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snack, potato chips, made from dried potatoes, plain")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19410_raw' AND state = 'raw';
-- usda_19411_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, potato chips, plain, salted")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19411_raw' AND state = 'raw';
-- usda_19412_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, potato chips, made from dried potatoes, cheese-flavor")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19412_raw' AND state = 'raw';
-- usda_19415_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, potato sticks")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19415_raw' AND state = 'raw';
-- usda_19418_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, sesame sticks, wheat-based, salted")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19418_raw' AND state = 'raw';
-- usda_19421_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, potato chips, cheese-flavor")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19421_raw' AND state = 'raw';
-- usda_19422_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, potato chips, reduced fat")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19422_raw' AND state = 'raw';
-- usda_19424_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, tortilla chips, nacho-flavor, reduced fat")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19424_raw' AND state = 'raw';
-- usda_19524_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, taro chips")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19524_raw' AND state = 'raw';
-- usda_19802_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, corn-based, extruded, puffs or twists, cheese-flavor, unenriched")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19802_raw' AND state = 'raw';
-- usda_19804_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, corn-based, extruded, chips, barbecue-flavor, made with enriched masa flour")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19804_raw' AND state = 'raw';
-- usda_19806_raw: card cooking_method "air-popped" says the values are for the air-popped food ("Snacks, popcorn, air-popped (Unsalted)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19806_raw' AND state = 'raw';
-- usda_19807_raw: card cooking_method "oil-popped" says the values are for the oil-popped food ("Snacks, popcorn, oil-popped, white popcorn, salt added")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19807_raw' AND state = 'raw';
-- usda_19809_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, potato chips, plain, made with partially hydrogenated soybean oil, salted")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19809_raw' AND state = 'raw';
-- usda_19810_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, potato chips, plain, made with partially hydrogenated soybean oil, unsalted")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19810_raw' AND state = 'raw';
-- usda_19811_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, potato chips, plain, unsalted")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19811_raw' AND state = 'raw';
-- usda_19820_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, sesame sticks, wheat-based, unsalted")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19820_raw' AND state = 'raw';
-- usda_19823_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Potato chips, without salt, reduced fat")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19823_raw' AND state = 'raw';
-- usda_19857_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, tortilla chips, nacho-flavor, made with enriched masa flour")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_19857_raw' AND state = 'raw';
-- usda_20030_raw: canned hominy, cooked and hydrated (72 kcal/100 g vs ~365 dry corn)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_20030_raw' AND state = 'raw';
-- usda_20049_raw: card cooking_method "prepared" says the values are for the prepared food ("Rice, white, long-grain, precooked or instant, enriched, prepared")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_20049_raw' AND state = 'raw';
-- usda_20113_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Noodles, chinese, chow mein")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_20113_raw' AND state = 'raw';
-- usda_20118_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Noodles, flat, crunchy, Chinese restaurant")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_20118_raw' AND state = 'raw';
-- usda_20330_raw: canned hominy, cooked and hydrated (72 kcal/100 g vs ~365 dry corn)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_20330_raw' AND state = 'raw';
-- usda_25000_raw: card cooking_method "microwaved" says the values are for the microwaved food ("Snacks, popcorn, microwave, 94% fat free")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_25000_raw' AND state = 'raw';
-- usda_25001_raw: card cooking_method "microwaved" says the values are for the microwaved food ("Snacks, popcorn, microwave, low fat")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_25001_raw' AND state = 'raw';
-- usda_25012_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, sweet potato chips, unsalted")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_25012_raw' AND state = 'raw';
-- usda_25013_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, FRITOLAY, SUNCHIPS, Multigrain Snack, original flavor")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_25013_raw' AND state = 'raw';
-- usda_25014_raw: card cooking_method "microwaved" says the values are for the microwaved food ("Snacks, popcorn, microwave, regular (butter) flavor, made with partially hydrogenated oil")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_25014_raw' AND state = 'raw';
-- usda_25022_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, FRITOLAY, SUNCHIPS, multigrain, French onion flavor")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_25022_raw' AND state = 'raw';
-- usda_25023_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, FRITOLAY, SUNCHIPS, Multigrain Snack, Harvest Cheddar flavor")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_25023_raw' AND state = 'raw';
-- usda_25027_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, plantain chips, salted")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_25027_raw' AND state = 'raw';
-- usda_25028_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Tortilla chips, yellow, plain, salted")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_25028_raw' AND state = 'raw';
-- usda_25030_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, vegetable chips, HAIN CELESTIAL GROUP, TERRA CHIPS")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_25030_raw' AND state = 'raw';
-- usda_25050_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, yucca (cassava) chips, salted")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_25050_raw' AND state = 'raw';
-- usda_25063_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, potato chips, made from dried potatoes (preformed), multigrain")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_25063_raw' AND state = 'raw';
-- usda_25064_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, potato chips, lightly salted")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_25064_raw' AND state = 'raw';
-- usda_25070_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, shrimp cracker")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_25070_raw' AND state = 'raw';
-- usda_28287_raw: baked bread, eaten as is ("Bread, naan, whole wheat, commercially prepared, refrigerated"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28287_raw' AND state = 'raw';
-- usda_28288_raw: baked bread, eaten as is ("Bread, roll, Mexican, bollilo"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28288_raw' AND state = 'raw';
-- usda_28306_raw: baked bread, eaten as is ("Bread, chapati or roti, plain, commercially prepared"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28306_raw' AND state = 'raw';
-- usda_28307_raw: baked bread, eaten as is ("Bread, naan, plain, commercially prepared, refrigerated"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28307_raw' AND state = 'raw';
-- usda_28312_raw: baked bread, eaten as is ("Rolls, hamburger or hot dog, wheat/cracked wheat"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28312_raw' AND state = 'raw';
-- usda_28313_raw: baked bread, eaten as is ("Rolls, hamburger or hot dog, whole wheat"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28313_raw' AND state = 'raw';
-- usda_28315_raw: baked bread, eaten as is ("Bread, cinnamon"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28315_raw' AND state = 'raw';
-- usda_28316_raw: baked bread, eaten as is ("Bread, wheat, sprouted"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28316_raw' AND state = 'raw';
-- usda_28318_raw: baked bread, eaten as is ("Bread, french or vienna, whole wheat"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28318_raw' AND state = 'raw';
-- usda_28319_raw: baked bread, eaten as is ("Bagels, whole grain white"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28319_raw' AND state = 'raw';
-- usda_28320_raw: baked bread, eaten as is ("English muffins, whole grain white"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28320_raw' AND state = 'raw';
-- usda_28321_raw: baked bread, eaten as is ("Rolls, hamburger, whole grain white, calcium-fortified"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28321_raw' AND state = 'raw';
-- usda_28322_raw: baked bread, eaten as is ("Bagels, multigrain"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28322_raw' AND state = 'raw';
-- usda_28336_raw: baked bread, eaten as is ("Bread, gluten-free, white, made with potato extract, rice starch, and rice flour"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28336_raw' AND state = 'raw';
-- usda_28337_raw: baked bread, eaten as is ("Bread, gluten-free, white, made with rice flour, corn starch, and/or tapioca"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28337_raw' AND state = 'raw';
-- usda_28338_raw: baked bread, eaten as is ("Bread, gluten-free, white, made with tapioca starch and brown rice flour"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28338_raw' AND state = 'raw';
-- usda_28339_raw: baked bread, eaten as is ("Bread, gluten-free, whole grain, made with tapioca starch and brown rice flour"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28339_raw' AND state = 'raw';
-- usda_28340_raw: baked bread, eaten as is ("Rolls, gluten-free, white, made with brown rice flour, tapioca starch, and potato starch"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28340_raw' AND state = 'raw';
-- usda_28341_raw: baked bread, eaten as is ("Rolls, gluten-free, white, made with rice flour, rice starch, and corn starch"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28341_raw' AND state = 'raw';
-- usda_28342_raw: baked bread, eaten as is ("Rolls, gluten-free, white, made with brown rice flour, tapioca starch, and sorghum flour"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28342_raw' AND state = 'raw';
-- usda_28343_raw: baked bread, eaten as is ("Rolls, gluten-free, whole grain, made with tapioca starch and brown rice flour"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28343_raw' AND state = 'raw';
-- usda_28347_raw: source name says the food is prepared/cooked ("Pancakes, gluten-free, frozen, ready-to-heat"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28347_raw' AND state = 'raw';
-- usda_28348_raw: baked bread, eaten as is ("Rolls, dinner, sweet"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28348_raw' AND state = 'raw';
-- usda_28354_raw: baked bread, eaten as is ("Andrea's, Gluten Free Soft Dinner Roll"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28354_raw' AND state = 'raw';
-- usda_28366_raw: baked bread, eaten as is ("Rudi's, Gluten-Free Bakery, Original Sandwich Bread"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28366_raw' AND state = 'raw';
-- usda_28368_raw: baked bread, eaten as is ("Schar, Gluten-Free, Classic White Rolls"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28368_raw' AND state = 'raw';
-- usda_28369_raw: baked bread, eaten as is ("Schar, Gluten-Free, Wheat-Free, Classic White Bread"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28369_raw' AND state = 'raw';
-- usda_28370_raw: baked bread, eaten as is ("Udi's, Gluten Free, Classic French Dinner Rolls"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28370_raw' AND state = 'raw';
-- usda_28371_raw: baked bread, eaten as is ("Udi's, Gluten Free, Soft & Delicious White Sandwich Bread"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28371_raw' AND state = 'raw';
-- usda_28372_raw: baked bread, eaten as is ("Udi's, Gluten Free, Soft & Hearty Whole Grain Bread"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28372_raw' AND state = 'raw';
-- usda_28373_raw: baked bread, eaten as is ("Udi's, Gluten Free, Whole Grain Dinner Rolls"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28373_raw' AND state = 'raw';
-- usda_28397_raw: baked bread, eaten as is ("Bread, multi-grain (includes whole-grain)"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_28397_raw' AND state = 'raw';
-- usda_31036_raw: source name says the food is prepared/cooked ("Potatoes, mashed, ready-to-eat"); values are as eaten
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_31036_raw' AND state = 'raw';
-- usda_35024_raw: card cooking_method "stewed" says the values are for the stewed food ("Stew/soup, caribou (Alaska Native)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_35024_raw' AND state = 'raw';
-- usda_35048_raw: card cooking_method "stewed" says the values are for the stewed food ("Stew, moose (Alaska Native)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_35048_raw' AND state = 'raw';
-- usda_35065_raw: canned, retort-cooked meat or fish; values are as eaten from the can (266 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_35065_raw' AND state = 'raw';
-- usda_35142_raw: card cooking_method "fried" says the values are for the fried food ("Frybread, made with lard (Navajo)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_35142_raw' AND state = 'raw';
-- usda_35144_raw: card cooking_method "stewed" says the values are for the stewed food ("Stew, dumpling with mutton (Navajo)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_35144_raw' AND state = 'raw';
-- usda_35145_raw: card cooking_method "stewed" says the values are for the stewed food ("Stew, hominy with mutton (Navajo)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_35145_raw' AND state = 'raw';
-- usda_35146_raw: card cooking_method "stewed" says the values are for the stewed food ("Stew, mutton, corn, squash (Navajo)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_35146_raw' AND state = 'raw';
-- usda_35157_raw: canned, retort-cooked meat or fish; values are as eaten from the can (161 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_35157_raw' AND state = 'raw';
-- usda_35182_raw: card cooking_method "stewed" says the values are for the stewed food ("Acorn stew (Apache)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_35182_raw' AND state = 'raw';
-- usda_35185_raw: card cooking_method "fried" says the values are for the fried food ("Frybread, made with lard (Apache)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_35185_raw' AND state = 'raw';
-- usda_35236_raw: card cooking_method "stewed" says the values are for the stewed food ("Stew, pinto bean and hominy, badufsuki (Hopi)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_35236_raw' AND state = 'raw';
-- usda_35238_raw: card cooking_method "brewed" says the values are for the brewed food ("Tea, herbal, brewed, Hohoysi (Hopi)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_35238_raw' AND state = 'raw';
-- usda_42129_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_42129_raw' AND state = 'raw';
-- usda_42161_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_42161_raw' AND state = 'raw';
-- usda_42179_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_42179_raw' AND state = 'raw';
-- usda_42259_raw: card cooking_method "oil-popped" says the values are for the oil-popped food ("Snacks, popcorn, home-prepared, oil-popped, unsalted")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_42259_raw' AND state = 'raw';
-- usda_42280_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_42280_raw' AND state = 'raw';
-- usda_43364_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, tortilla chips, unsalted, white corn")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_43364_raw' AND state = 'raw';
-- usda_43384_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_43384_raw' AND state = 'raw';
-- usda_43441_raw: baked bread, eaten as is ("Rolls, pumpernickel"); same as bánh mỳ fao_vn_2007_1012_raw
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_43441_raw' AND state = 'raw';
-- usda_43447_raw: card cooking_method "deep-fried" says the values are for the deep-fried food ("Snacks, corn-based, extruded, chips, unsalted")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_43447_raw' AND state = 'raw';
-- usda_43507_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_43507_raw' AND state = 'raw';
-- usda_5000_raw: card cooking_method "rotisserie" says the values are for the rotisserie food ("Chicken, broiler, rotisserie, BBQ, breast, meat only")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5000_raw' AND state = 'raw';
-- usda_5277_raw: canned, retort-cooked meat or fish; values are as eaten from the can (165 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5277_raw' AND state = 'raw';
-- usda_5284_raw: canned, retort-cooked meat or fish; values are as eaten from the can (169 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5284_raw' AND state = 'raw';
-- usda_5311_raw: canned, retort-cooked meat or fish; values are as eaten from the can (185 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5311_raw' AND state = 'raw';
-- usda_5313_raw: card cooking_method "heated in microwave" says the values are for the heated in microwave food ("Chicken, wing, frozen, glazed, barbecue flavored, heated (microwave)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5313_raw' AND state = 'raw';
-- usda_5319_raw: card cooking_method "rotisserie" says the values are for the rotisserie food ("Chicken, broiler, rotisserie, BBQ, drumstick, meat only")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5319_raw' AND state = 'raw';
-- usda_5320_raw: card cooking_method "heated in conventional oven" says the values are for the heated in conventional oven food ("Chicken, wing, frozen, glazed, barbecue flavored, heated (conventional oven)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5320_raw' AND state = 'raw';
-- usda_5334_raw: card cooking_method "rotisserie" says the values are for the rotisserie food ("Chicken, broiler, rotisserie, BBQ, thigh, meat only")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5334_raw' AND state = 'raw';
-- usda_5339_raw: card cooking_method "rotisserie" says the values are for the rotisserie food ("Chicken, broiler, rotisserie, BBQ, wing, meat only")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5339_raw' AND state = 'raw';
-- usda_5356_raw: card cooking_method "rotisserie" says the values are for the rotisserie food ("Chicken, broiler, rotisserie, BBQ, skin")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5356_raw' AND state = 'raw';
-- usda_5357_raw: card cooking_method "rotisserie" says the values are for the rotisserie food ("Chicken, broiler, rotisserie, BBQ, back, meat and skin")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5357_raw' AND state = 'raw';
-- usda_5358_raw: card cooking_method "rotisserie" says the values are for the rotisserie food ("Chicken, broiler, rotisserie, BBQ, breast, meat and skin")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5358_raw' AND state = 'raw';
-- usda_5359_raw: card cooking_method "rotisserie" says the values are for the rotisserie food ("Chicken, broiler, rotisserie, BBQ, drumstick, meat and skin")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5359_raw' AND state = 'raw';
-- usda_5361_raw: card cooking_method "rotisserie" says the values are for the rotisserie food ("Chicken, broiler, rotisserie, BBQ, thigh, meat and skin")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5361_raw' AND state = 'raw';
-- usda_5362_raw: card cooking_method "rotisserie" says the values are for the rotisserie food ("Chicken, broiler, rotisserie, BBQ, wing, meat and skin")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5362_raw' AND state = 'raw';
-- usda_5693_raw: card cooking_method "rotisserie" says the values are for the rotisserie food ("Chicken, broiler, rotisserie, BBQ, back meat only")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_5693_raw' AND state = 'raw';
-- usda_7002_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7002_raw' AND state = 'raw';
-- usda_7003_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7003_raw' AND state = 'raw';
-- usda_7004_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7004_raw' AND state = 'raw';
-- usda_7005_raw: cooked sausage (card form_processing "cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7005_raw' AND state = 'raw';
-- usda_7007_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7007_raw' AND state = 'raw';
-- usda_7008_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7008_raw' AND state = 'raw';
-- usda_7010_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7010_raw' AND state = 'raw';
-- usda_7011_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7011_raw' AND state = 'raw';
-- usda_7022_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7022_raw' AND state = 'raw';
-- usda_7024_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7024_raw' AND state = 'raw';
-- usda_7025_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7025_raw' AND state = 'raw';
-- usda_7026_raw: canned, retort-cooked meat or fish; values are as eaten from the can (239 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7026_raw' AND state = 'raw';
-- usda_7041_raw: cooked sausage (card form_processing "cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7041_raw' AND state = 'raw';
-- usda_7043_raw: card cooking_method "roasted" says the values are for the roasted food ("Roast beef, deli style, prepackaged, sliced")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7043_raw' AND state = 'raw';
-- usda_7045_raw: canned, retort-cooked meat or fish; values are as eaten from the can (334 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7045_raw' AND state = 'raw';
-- usda_7050_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7050_raw' AND state = 'raw';
-- usda_7053_raw: canned, retort-cooked meat or fish; values are as eaten from the can (201 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7053_raw' AND state = 'raw';
-- usda_7055_raw: canned, retort-cooked meat or fish; values are as eaten from the can (319 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7055_raw' AND state = 'raw';
-- usda_7083_raw: canned, retort-cooked meat or fish; values are as eaten from the can (230 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7083_raw' AND state = 'raw';
-- usda_7088_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7088_raw' AND state = 'raw';
-- usda_7090_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7090_raw' AND state = 'raw';
-- usda_7201_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7201_raw' AND state = 'raw';
-- usda_7241_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7241_raw' AND state = 'raw';
-- usda_7905_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7905_raw' AND state = 'raw';
-- usda_7906_raw: canned, retort-cooked meat or fish; values are as eaten from the can (293 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7906_raw' AND state = 'raw';
-- usda_7908_raw: canned, retort-cooked meat or fish; values are as eaten from the can (315 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7908_raw' AND state = 'raw';
-- usda_7909_raw: canned, retort-cooked meat or fish; values are as eaten from the can (196 kcal/100 g)
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7909_raw' AND state = 'raw';
-- usda_7931_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7931_raw' AND state = 'raw';
-- usda_7936_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7936_raw' AND state = 'raw';
-- usda_7937_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7937_raw' AND state = 'raw';
-- usda_7939_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7939_raw' AND state = 'raw';
-- usda_7944_raw: card cooking_method "rotisserie" says the values are for the rotisserie food ("Turkey, white, rotisserie, deli cut")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7944_raw' AND state = 'raw';
-- usda_7945_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7945_raw' AND state = 'raw';
-- usda_7949_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7949_raw' AND state = 'raw';
-- usda_7952_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7952_raw' AND state = 'raw';
-- usda_7959_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7959_raw' AND state = 'raw';
-- usda_7960_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7960_raw' AND state = 'raw';
-- usda_7962_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7962_raw' AND state = 'raw';
-- usda_7971_raw: cooked sausage (card form_processing "cured, cooked sausage"), eaten as is
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_7971_raw' AND state = 'raw';
-- usda_8107_raw: card cooking_method "prepared with water" says the values are for the prepared with water food ("Cereals, CREAM OF WHEAT, instant, prepared with water, without salt")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_8107_raw' AND state = 'raw';
-- usda_8129_raw: card cooking_method "prepared with water" says the values are for the prepared with water food ("Cereals, oats, instant, fortified, with cinnamon and spice, prepared with water")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_8129_raw' AND state = 'raw';
-- usda_8133_raw: card cooking_method "prepared with water" says the values are for the prepared with water food ("Cereals, oats, instant, fortified, with raisins and spice, prepared with water")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_8133_raw' AND state = 'raw';
-- usda_8236_raw: card cooking_method "prepared with water" says the values are for the prepared with water food ("Cereals, QUAKER, Oat Bran, QUAKER/MOTHER'S Oat Bran, prepared with water, no salt")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_8236_raw' AND state = 'raw';
-- usda_8240_raw: card cooking_method "prepared with water" says the values are for the prepared with water food ("Cereals, Oat Bran, QUAKER, QUAKER/MOTHER'S Oat Bran, prepared with water, salt")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_8240_raw' AND state = 'raw';
-- usda_8249_raw: card cooking_method "prepared with water" says the values are for the prepared with water food ("Cereals, QUAKER, QUAKER MultiGrain Oatmeal, prepared with water, no salt")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_8249_raw' AND state = 'raw';
-- usda_8252_raw: card cooking_method "prepared with water" says the values are for the prepared with water food ("Cereals, QUAKER, QUAKER MultiGrain Oatmeal, prepared with water, salt")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_8252_raw' AND state = 'raw';
-- usda_8511_raw: card cooking_method "prepared with water" says the values are for the prepared with water food ("Cereals, MALT-O-MEAL, original, plain, prepared with water, without salt")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_8511_raw' AND state = 'raw';
-- usda_8512_raw: card cooking_method "prepared with water" says the values are for the prepared with water food ("Cereals, MALT-O-MEAL, chocolate, prepared with water, without salt")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_8512_raw' AND state = 'raw';
-- usda_9008_raw: card cooking_method "heated" says the values are for the heated food ("Apples, canned, sweetened, sliced, drained, heated")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_9008_raw' AND state = 'raw';
-- usda_9015_raw: card cooking_method "heated" says the values are for the heated food ("Apples, frozen, unsweetened, heated (Includes foods for USDA's Food Distribution Program)")
UPDATE public.vietnamese_food_composition SET state = 'cooked', last_verified = '2026-11-25' WHERE id = 'usda_9015_raw' AND state = 'raw';

-- A. state: values describe the dry / uncooked product -> raw
-- nin_web_1043: NIN "Instant noodle, wheat, uncooked": dry block, 364 kcal/100 g (boiled sibling nin_web_1043002 is 102)
UPDATE public.vietnamese_food_composition SET state = 'raw', last_verified = '2026-11-25' WHERE id = 'nin_web_1043' AND state = 'cooked';
-- nin_web_1046002: "Macaroni, boiled" values are 371 kcal / 74.7 g carb per 100 g, dry-pasta density
UPDATE public.vietnamese_food_composition SET state = 'raw', last_verified = '2026-11-25' WHERE id = 'nin_web_1046002' AND state = 'cooked';
-- nin_web_13045: Bột chiên giòn is a dry batter powder (351.6 kcal/100 g), weighed before frying
UPDATE public.vietnamese_food_composition SET state = 'raw', last_verified = '2026-11-25' WHERE id = 'nin_web_13045' AND state = 'cooked';
-- nin_web_13067: Bột chiên xù (panko) is dry crumbs (383 kcal/100 g), weighed before frying
UPDATE public.vietnamese_food_composition SET state = 'raw', last_verified = '2026-11-25' WHERE id = 'nin_web_13067' AND state = 'cooked';
-- nin_web_13075: Gói thuốc bắc is a dried herb packet (281 kcal/100 g), not eaten as cooked mass
UPDATE public.vietnamese_food_composition SET state = 'raw', last_verified = '2026-11-25' WHERE id = 'nin_web_13075' AND state = 'cooked';
-- nin_web_2026002: "Tapioca, boiled" values are 344 kcal / 84.9 g carb per 100 g, dry-pearl density
UPDATE public.vietnamese_food_composition SET state = 'raw', last_verified = '2026-11-25' WHERE id = 'nin_web_2026002' AND state = 'cooked';
-- usda_20009_cooked: "Buckwheat groats, roasted, dry": the parser read "roasted"; values are dry kasha (346 kcal; cooked kasha usda row is 92)
UPDATE public.vietnamese_food_composition SET state = 'raw', last_verified = '2026-11-25' WHERE id = 'usda_20009_cooked' AND state = 'cooked';

-- C. USDA "Tofu, fried" rows are dehydrated deep-fried tofu puffs (271 kcal,
-- 50.5% water). Their Vietnamese name_primary "Đậu phụ chiên" is a card search
-- string and pulls home pan-fried tofu onto them; rename to the puff form.
-- Clearing embedding re-queues the legacy row-embedding backfill.
UPDATE public.vietnamese_food_composition
SET name_primary = 'Đậu phụ chiên phồng', embedding = NULL, last_verified = '2026-11-25'
WHERE id = 'usda_16129_cooked' AND name_primary = 'Đậu phụ chiên';
UPDATE public.vietnamese_food_composition
SET name_primary = 'Đậu phụ chiên phồng, chế biến với canxi sunfat', embedding = NULL, last_verified = '2026-11-25'
WHERE id = 'usda_16429_cooked' AND name_primary = 'Đậu phụ chiên, chế biến với canxi sunfat';

-- E/F. Curated rows from the Japanese Standard Tables of Food Composition
-- (MEXT 2020, 8th revised edition, 2023 supplement). The catalog had only dry
-- glass-noodle rows (332-351 kcal) and only boiled sticky rice (97 kcal, no
-- steamed xôi). "Tr" (trace) in the source is stored as 0. Vitamins and the
-- minerals not listed are left NULL.
INSERT INTO ingredient_sources (code, name) VALUES
  ('MEXT_2020', 'Standard Tables of Food Composition in Japan 2020 (8th revised edition), MEXT')
ON CONFLICT (code) DO NOTHING;

-- mext_02061_cooked: MEXT Standard Tables of Food Composition in Japan 2020 (8th rev., 2023 suppl.), food no. 02061 緑豆はるさめ ゆで (harusame, mung bean starch, boiled): 78 kcal, water 79.3 g, protein Tr, fat 0.1 g, carbohydrate 20.6 g, fiber 1.5 g, Na 0, Ca 3, Fe 0.1, K 0, P 3, Mg Tr, Zn Tr per 100 g. https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=2_02061_7
INSERT INTO vietnamese_food_composition (
  id, name_primary, name_alt, name_en, type_vn, type_en, source_id, state,
  inedible_portion_pct, calories_kcal, protein_g, carbohydrate_g, fat_g, fiber_g,
  sodium_mg, calcium_mg, iron_mg, magnesium_mg, phosphorus_mg, potassium_mg,
  zinc_mg, copper_mcg, manganese_mg,
  beta_carotene_mcg, vitamin_a_mcg, vitamin_d_mcg, vitamin_e_mg, vitamin_k_mcg,
  vitamin_c_mg, vitamin_b1_mg, vitamin_b2_mg, vitamin_pp_mg,
  vitamin_b5_mg, vitamin_b6_mg, vitamin_b9_mcg, vitamin_b12_mcg, vitamin_h_mcg,
  last_verified
) VALUES
(
  'mext_02061_cooked', 'Miến đậu xanh luộc', '{"Miến luộc"}', 'Glass noodles (mung bean harusame), boiled',
  'Khoai củ và sản phẩm chế biến', 'Starchy root and products',
  (SELECT id FROM ingredient_sources WHERE code = 'MEXT_2020'), 'cooked',
  0.0, 78.0, 0.0, 20.6, 0.1, 1.5,
  0.0, 3.0, 0.1, 0.0, 3.0, 0.0,
  0.0, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  '2026-11-25'
)
ON CONFLICT (id) DO NOTHING;

-- mext_02062_cooked: MEXT Standard Tables of Food Composition in Japan 2020 (8th rev., 2023 suppl.), food no. 02062 普通はるさめ ゆで (harusame, potato and sweet potato starches, boiled): 76 kcal, water 80.0 g, protein 0, fat Tr, carbohydrate 19.9 g, fiber 0.8 g, Na 1, Ca 10, Fe 0.1, K 2, P 10, Mg 1, Zn 0 per 100 g. https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=2_02062_7
INSERT INTO vietnamese_food_composition (
  id, name_primary, name_alt, name_en, type_vn, type_en, source_id, state,
  inedible_portion_pct, calories_kcal, protein_g, carbohydrate_g, fat_g, fiber_g,
  sodium_mg, calcium_mg, iron_mg, magnesium_mg, phosphorus_mg, potassium_mg,
  zinc_mg, copper_mcg, manganese_mg,
  beta_carotene_mcg, vitamin_a_mcg, vitamin_d_mcg, vitamin_e_mg, vitamin_k_mcg,
  vitamin_c_mg, vitamin_b1_mg, vitamin_b2_mg, vitamin_pp_mg,
  vitamin_b5_mg, vitamin_b6_mg, vitamin_b9_mcg, vitamin_b12_mcg, vitamin_h_mcg,
  last_verified
) VALUES
(
  'mext_02062_cooked', 'Miến khoai lang luộc', '{"Miến Hàn Quốc luộc"}', 'Glass noodles (potato and sweet potato starch harusame), boiled',
  'Khoai củ và sản phẩm chế biến', 'Starchy root and products',
  (SELECT id FROM ingredient_sources WHERE code = 'MEXT_2020'), 'cooked',
  0.0, 76.0, 0.0, 19.9, 0.0, 0.8,
  1.0, 10.0, 0.1, 1.0, 10.0, 2.0,
  0.0, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  '2026-11-25'
)
ON CONFLICT (id) DO NOTHING;

-- mext_01154_cooked: MEXT Standard Tables of Food Composition in Japan 2020 (8th rev., 2023 suppl.), food no. 01154 こめ［水稲めし］精白米 もち米 (glutinous rice, well-milled, cooked "meshi"): 188 kcal, water 52.1 g, protein 3.5 g, fat 0.5 g, carbohydrate 43.9 g, fiber (0.4) g, Na 0, Ca 2, Fe 0.1, K 28, P 19, Mg 5, Zn 0.8 per 100 g. https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=1_01154_7
INSERT INTO vietnamese_food_composition (
  id, name_primary, name_alt, name_en, type_vn, type_en, source_id, state,
  inedible_portion_pct, calories_kcal, protein_g, carbohydrate_g, fat_g, fiber_g,
  sodium_mg, calcium_mg, iron_mg, magnesium_mg, phosphorus_mg, potassium_mg,
  zinc_mg, copper_mcg, manganese_mg,
  beta_carotene_mcg, vitamin_a_mcg, vitamin_d_mcg, vitamin_e_mg, vitamin_k_mcg,
  vitamin_c_mg, vitamin_b1_mg, vitamin_b2_mg, vitamin_pp_mg,
  vitamin_b5_mg, vitamin_b6_mg, vitamin_b9_mcg, vitamin_b12_mcg, vitamin_h_mcg,
  last_verified
) VALUES
(
  'mext_01154_cooked', 'Xôi nếp trắng', '{"Xôi trắng", "Xôi"}', 'Glutinous rice, well-milled, cooked (meshi)',
  'Ngũ cốc và sản phẩm chế biến', 'Cereal and products',
  (SELECT id FROM ingredient_sources WHERE code = 'MEXT_2020'), 'cooked',
  0.0, 188.0, 3.5, 43.9, 0.5, 0.4,
  0.0, 2.0, 0.1, 5.0, 19.0, 28.0,
  0.8, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  '2026-11-25'
)
ON CONFLICT (id) DO NOTHING;

-- Round 2 (2026-11-25), after a 596-meal replay.
-- usda_42190_cooked: the Vietnamese name "Cơm trộn xúc xích thịt heo, chiên vàng
-- và dùng, đã nấu chín" is a mistranslation of "Pork sausage rice links, brown
-- and serve" and pulled "cơm chiên" (fried rice) onto a sausage row. Same pattern
-- as the tofu-puff rename: embedding cleared to re-queue the backfill.
UPDATE public.vietnamese_food_composition
SET name_primary = 'Xúc xích heo trộn gạo, loại áp chảo sẵn', embedding = NULL, last_verified = '2026-11-25'
WHERE id = 'usda_42190_cooked' AND name_primary = 'Cơm trộn xúc xích thịt heo, chiên vàng và dùng, đã nấu chín.';

-- mext_04039_cooked: MEXT Standard Tables of Food Composition in Japan 2020 (8th rev., 2023 suppl.), food no. 04039 生揚げ (nama-age / atsuage, fried slices of drained tofu): 143 kcal, water 75.9 g, protein 10.7 g, fat 11.3 g, carbohydrate 0.9 g, fiber 0.8 g, Na 3, Ca 240, Fe 2.6, K 120, P 150, Mg 51, Zn 1.1 per 100 g. https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=4_04039_7
INSERT INTO vietnamese_food_composition (
  id, name_primary, name_alt, name_en, type_vn, type_en, source_id, state,
  inedible_portion_pct, calories_kcal, protein_g, carbohydrate_g, fat_g, fiber_g,
  sodium_mg, calcium_mg, iron_mg, magnesium_mg, phosphorus_mg, potassium_mg,
  zinc_mg, copper_mcg, manganese_mg,
  beta_carotene_mcg, vitamin_a_mcg, vitamin_d_mcg, vitamin_e_mg, vitamin_k_mcg,
  vitamin_c_mg, vitamin_b1_mg, vitamin_b2_mg, vitamin_pp_mg,
  vitamin_b5_mg, vitamin_b6_mg, vitamin_b9_mcg, vitamin_b12_mcg, vitamin_h_mcg,
  last_verified
) VALUES
(
  'mext_04039_cooked', 'Đậu phụ rán', '{"Đậu hũ chiên"}', 'Tofu, deep-fried block (atsuage / nama-age)',
  'Hạt, quả giàu đạm, béo và sản phẩm chế biến', 'Pulses, nuts, seeds and products',
  (SELECT id FROM ingredient_sources WHERE code = 'MEXT_2020'), 'cooked',
  0.0, 143.0, 10.7, 0.9, 11.3, 0.8,
  3.0, 240.0, 2.6, 51.0, 150.0, 120.0,
  1.1, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  '2026-11-25'
)
ON CONFLICT (id) DO NOTHING;

-- mext_11277_cooked: MEXT Standard Tables of Food Composition in Japan 2020 (8th rev., 2023 suppl.), food no. 11277 ぶた［大型種肉］ばら 脂身つき 焼き (pork, large type breed, belly, lean and fat, roasted): 444 kcal, water 37.1 g, protein 19.6 g (16.5 g by amino acids), fat 43.9 g, carbohydrate 0.1 g, Na 56, Ca 4, Fe 0.7, K 270, P 140, Mg 17, Zn 2.2 per 100 g. https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=11_11277_7
INSERT INTO vietnamese_food_composition (
  id, name_primary, name_alt, name_en, type_vn, type_en, source_id, state,
  inedible_portion_pct, calories_kcal, protein_g, carbohydrate_g, fat_g, fiber_g,
  sodium_mg, calcium_mg, iron_mg, magnesium_mg, phosphorus_mg, potassium_mg,
  zinc_mg, copper_mcg, manganese_mg,
  beta_carotene_mcg, vitamin_a_mcg, vitamin_d_mcg, vitamin_e_mg, vitamin_k_mcg,
  vitamin_c_mg, vitamin_b1_mg, vitamin_b2_mg, vitamin_pp_mg,
  vitamin_b5_mg, vitamin_b6_mg, vitamin_b9_mcg, vitamin_b12_mcg, vitamin_h_mcg,
  last_verified
) VALUES
(
  'mext_11277_cooked', 'Thịt ba chỉ heo nướng', '{"Heo quay"}', 'Pork, belly, lean and fat, roasted',
  'Thịt và sản phẩm chế biến', 'Meat and meat products',
  (SELECT id FROM ingredient_sources WHERE code = 'MEXT_2020'), 'cooked',
  0.0, 444.0, 19.6, 0.1, 43.9, NULL,
  56.0, 4.0, 0.7, 17.0, 140.0, 270.0,
  2.2, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  '2026-11-25'
)
ON CONFLICT (id) DO NOTHING;
