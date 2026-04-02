-- =============================================================================
-- Domain B: Data Migration
-- Unifies FAO category names to USDA-style categories for consistency.
--
-- Clear 1:1 mappings are done first, then pattern-based splitting for
-- ambiguous categories (Meat → Beef/Poultry/Pork, Pulses → Legumes/Nuts).
-- =============================================================================

-- -------------------------------------------------------
-- 1:1 clear mappings
-- -------------------------------------------------------

-- Beverages
UPDATE vietnamese_food_composition
SET type_en = 'Beverages', type_vn = 'Đồ uống'
WHERE type_en = 'Beverage and liquor';

-- Cereal → Cereal Grains and Pasta
UPDATE vietnamese_food_composition
SET type_en = 'Cereal Grains and Pasta', type_vn = 'Ngũ cốc và mì ống'
WHERE type_en = 'Cereal and products';

-- Condiments → Spices and Herbs
UPDATE vietnamese_food_composition
SET type_en = 'Spices and Herbs', type_vn = 'Gia vị và thảo mộc'
WHERE type_en = 'Condiments, traditional sauces';

-- Fish → Finfish and Shellfish Products
UPDATE vietnamese_food_composition
SET type_en = 'Finfish and Shellfish Products', type_vn = 'Cá và hải sản'
WHERE type_en = 'Fish, shellfish and products';

-- Fruits → Fruits and Fruit Juices
UPDATE vietnamese_food_composition
SET type_en = 'Fruits and Fruit Juices', type_vn = 'Trái cây và nước ép'
WHERE type_en = 'Fruits';

-- Milk → Dairy and Egg Products
UPDATE vietnamese_food_composition
SET type_en = 'Dairy and Egg Products', type_vn = 'Sữa và sản phẩm từ trứng'
WHERE type_en = 'Milk and products';

-- Oil → Fats and Oils
UPDATE vietnamese_food_composition
SET type_en = 'Fats and Oils', type_vn = 'Dầu mỡ'
WHERE type_en = 'Oil, lard, butter';

-- Sugar → Sweets
UPDATE vietnamese_food_composition
SET type_en = 'Sweets', type_vn = 'Đồ ngọt'
WHERE type_en = 'Sugar, confectionery';

-- Vegetables → Vegetables and Vegetable Products
UPDATE vietnamese_food_composition
SET type_en = 'Vegetables and Vegetable Products', type_vn = 'Rau và sản phẩm từ rau'
WHERE type_en = 'Vegetables';

-- Starchy root → keep as distinct (no exact USDA equivalent)
UPDATE vietnamese_food_composition
SET type_en = 'Starchy Roots and Tubers', type_vn = 'Khoai củ và sản phẩm chế biến'
WHERE type_en = 'Starchy root and products';

-- -------------------------------------------------------
-- Pattern-based splitting: Egg and products
-- Eggs go to Dairy and Egg Products (matches USDA cat 1)
-- -------------------------------------------------------
UPDATE vietnamese_food_composition
SET type_en = 'Dairy and Egg Products', type_vn = 'Sữa và sản phẩm từ trứng'
WHERE type_en = 'Egg and products';

-- -------------------------------------------------------
-- Pattern-based splitting: Meat and meat products
-- Split by animal type based on name_en patterns.
-- -------------------------------------------------------

-- Poultry (chicken, duck, goose, turkey, quail)
UPDATE vietnamese_food_composition
SET type_en = 'Poultry Products', type_vn = 'Thịt gia cầm'
WHERE type_en = 'Meat and meat products'
  AND (name_en ~* '\m(chicken|hen|duck|goose|turkey|quail|pigeon|poultry)\M');

-- Pork
UPDATE vietnamese_food_composition
SET type_en = 'Pork Products', type_vn = 'Thịt lợn'
WHERE type_en = 'Meat and meat products'
  AND (name_en ~* '\m(pork|pig|swine|ham|bacon|sausage|salami)\M');

-- Beef
UPDATE vietnamese_food_composition
SET type_en = 'Beef Products', type_vn = 'Thịt bò'
WHERE type_en = 'Meat and meat products'
  AND (name_en ~* '\m(beef|veal|cattle|ox)\M');

-- Lamb, Veal, and Game
UPDATE vietnamese_food_composition
SET type_en = 'Lamb, Veal, and Game Products', type_vn = 'Thịt cừu, bê và thú rừng'
WHERE type_en = 'Meat and meat products'
  AND (name_en ~* '\m(lamb|goat|mutton|deer|venison|rabbit|frog|snake|turtle|buffalo|dog)\M');

-- Remaining unmatched meat → generic "Meat Products"
UPDATE vietnamese_food_composition
SET type_en = 'Meat Products', type_vn = 'Thịt và sản phẩm chế biến'
WHERE type_en = 'Meat and meat products';

-- -------------------------------------------------------
-- Pattern-based splitting: Pulses, nuts, seeds
-- -------------------------------------------------------

-- Nuts and seeds
UPDATE vietnamese_food_composition
SET type_en = 'Nut and Seed Products', type_vn = 'Hạt và hạt giống'
WHERE type_en = 'Pulses, nuts, seeds and products'
  AND (name_en ~* '\m(nut|almond|cashew|walnut|pistachio|pecan|sesame|sunflower|pumpkin seed|coconut|chestnut|pine nut|macadamia)\M');

-- Remaining → Legumes (beans, peas, lentils, tofu, soy)
UPDATE vietnamese_food_composition
SET type_en = 'Legumes and Legume Products', type_vn = 'Đậu và sản phẩm từ đậu'
WHERE type_en = 'Pulses, nuts, seeds and products';

-- -------------------------------------------------------
-- Pattern-based splitting: Canned food
-- Re-classify by base food type
-- -------------------------------------------------------

-- Canned fish/seafood
UPDATE vietnamese_food_composition
SET type_en = 'Finfish and Shellfish Products', type_vn = 'Cá và hải sản'
WHERE type_en = 'Canned food'
  AND (name_en ~* '\m(fish|tuna|sardine|mackerel|shrimp|crab|squid|clam|oyster|anchov)\M');

-- Canned fruits
UPDATE vietnamese_food_composition
SET type_en = 'Fruits and Fruit Juices', type_vn = 'Trái cây và nước ép'
WHERE type_en = 'Canned food'
  AND (name_en ~* '\m(banana|pineapple|peach|pear|mango|lychee|longan|pyrus|fruit|syrup|sweetened)\M');

-- Canned vegetables
UPDATE vietnamese_food_composition
SET type_en = 'Vegetables and Vegetable Products', type_vn = 'Rau và sản phẩm từ rau'
WHERE type_en = 'Canned food'
  AND (name_en ~* '\m(cucumber|corn|pea|bean|tomato|mushroom|bamboo|vegetable|pickle)\M');

-- Canned meat
UPDATE vietnamese_food_composition
SET type_en = 'Meat Products', type_vn = 'Thịt và sản phẩm chế biến'
WHERE type_en = 'Canned food'
  AND (name_en ~* '\m(meat|pork|beef|chicken|pate|liver)\M');

-- Remaining canned → keep as "Canned Foods" (no USDA equivalent)
UPDATE vietnamese_food_composition
SET type_en = 'Canned Foods', type_vn = 'Đồ hộp'
WHERE type_en = 'Canned food';
