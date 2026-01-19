-- Fix meal_type classification based on recipe NAME only
-- This corrects false positives where ingredients triggered wrong classification

-- First, reset all to 'main' (the default)
UPDATE recipes
SET features = jsonb_set(features, '{meal_type}', '"main"');

-- Then classify desserts (based on name)
UPDATE recipes
SET features = jsonb_set(features, '{meal_type}', '"dessert"')
WHERE LOWER(name) ~ '(tårta|kaka|muffins|cupcake|brownie|glass|mousse|pannacotta|cheesecake|kladdkaka|chokladboll|biskvi|dessert|efterrätt|godis|karamell|praliner)';

-- Classify breakfast items
UPDATE recipes
SET features = jsonb_set(features, '{meal_type}', '"breakfast"')
WHERE LOWER(name) ~ '(frukost|morgon|overnight|granola|müsli|gröt|äggröra|omelett)';

-- Classify snacks
UPDATE recipes
SET features = jsonb_set(features, '{meal_type}', '"snack"')
WHERE LOWER(name) ~ '(snacks|tilltugg|mellanmål|dippsås|chips|popcorn)';

-- Classify drinks
UPDATE recipes
SET features = jsonb_set(features, '{meal_type}', '"drink"')
WHERE LOWER(name) ~ '(dryck|smoothie|juice|lemonad|kaffe(?!bullar)|te(?!rminsås)|cocktail|milkshake|drink)';

-- Classify baking (separate from desserts - breads, buns etc)
UPDATE recipes
SET features = jsonb_set(features, '{meal_type}', '"baking"')
WHERE LOWER(name) ~ '(frallor|bröd|bulle|kanelbulle|kardemummabulle|scones|croissant)'
  AND NOT LOWER(name) ~ '(tårta|kaka|kladdkaka)';

-- Verify the results
SELECT
  features->>'meal_type' as meal_type,
  COUNT(*) as count
FROM recipes
GROUP BY 1
ORDER BY count DESC;

-- Show sample of each category
SELECT features->>'meal_type' as meal_type, name
FROM recipes
ORDER BY meal_type, name
LIMIT 30;
