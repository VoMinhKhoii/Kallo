-- USDA_FDC is deliberately NEW, not a reuse of USDA_SR: USDA_SR is the
-- offline-seeded SR Legacy generic-ingredient dataset, while USDA_FDC is live
-- FoodData Central Branded label data fetched per barcode scan. Conflating
-- them would mislabel the existing seeded rows' provenance.
INSERT INTO "ingredient_sources" ("code", "name")
VALUES ('USDA_FDC', 'USDA FoodData Central (Branded)')
ON CONFLICT ("code") DO NOTHING;
