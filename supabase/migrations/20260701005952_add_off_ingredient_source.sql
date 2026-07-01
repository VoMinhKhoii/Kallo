-- Manual migration to add Open Food Facts to ingredient_sources
INSERT INTO "ingredient_sources" ("code", "name")
VALUES ('OFF', 'Open Food Facts')
ON CONFLICT ("code") DO NOTHING;
