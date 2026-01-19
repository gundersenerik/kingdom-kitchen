-- Add meal_type to existing recipes based on their names
-- Run this in Supabase SQL Editor

-- First, let's see what we have
-- SELECT name, features->>'meal_type' as meal_type FROM recipes LIMIT 20;

-- Update desserts
UPDATE recipes
SET features = features || '{"meal_type": "dessert"}'::jsonb
WHERE
  features->>'meal_type' IS NULL
  AND (
    lower(name) LIKE '%tårta%'
    OR lower(name) LIKE '%kaka%'
    OR lower(name) LIKE '%muffins%'
    OR lower(name) LIKE '%brownie%'
    OR lower(name) LIKE '%glass%'
    OR lower(name) LIKE '%mousse%'
    OR lower(name) LIKE '%cheesecake%'
    OR lower(name) LIKE '%kladdkaka%'
    OR lower(name) LIKE '%dessert%'
    OR lower(name) LIKE '%efterrätt%'
    OR lower(name) LIKE '%choklad%boll%'
    OR lower(name) LIKE '%pannacotta%'
    OR lower(name) LIKE '%praliner%'
  );

-- Update drinks
UPDATE recipes
SET features = features || '{"meal_type": "drink"}'::jsonb
WHERE
  features->>'meal_type' IS NULL
  AND (
    lower(name) LIKE '%smoothie%'
    OR lower(name) LIKE '%juice%'
    OR lower(name) LIKE '%lemonad%'
    OR lower(name) LIKE '%dryck%'
    OR lower(name) LIKE '%drink%'
    OR lower(name) LIKE '%milkshake%'
    OR lower(name) LIKE '%cocktail%'
  );

-- Update breakfast items
UPDATE recipes
SET features = features || '{"meal_type": "breakfast"}'::jsonb
WHERE
  features->>'meal_type' IS NULL
  AND (
    lower(name) LIKE '%frukost%'
    OR lower(name) LIKE '%overnight%'
    OR lower(name) LIKE '%granola%'
    OR lower(name) LIKE '%gröt%'
    OR lower(name) LIKE '%müsli%'
  );

-- Update baking
UPDATE recipes
SET features = features || '{"meal_type": "baking"}'::jsonb
WHERE
  features->>'meal_type' IS NULL
  AND (
    lower(name) LIKE '%bulle%'
    OR lower(name) LIKE '%bröd%'
    OR lower(name) LIKE '%scones%'
    OR lower(name) LIKE '%croissant%'
  );

-- Update snacks
UPDATE recipes
SET features = features || '{"meal_type": "snack"}'::jsonb
WHERE
  features->>'meal_type' IS NULL
  AND (
    lower(name) LIKE '%snacks%'
    OR lower(name) LIKE '%tilltugg%'
    OR lower(name) LIKE '%dipp%'
    OR lower(name) LIKE '%chips%'
  );

-- Set remaining recipes as main dishes (lunch/dinner)
UPDATE recipes
SET features = features || '{"meal_type": "main"}'::jsonb
WHERE features->>'meal_type' IS NULL;

-- Check the results
SELECT
  features->>'meal_type' as meal_type,
  COUNT(*) as count
FROM recipes
GROUP BY features->>'meal_type'
ORDER BY count DESC;
