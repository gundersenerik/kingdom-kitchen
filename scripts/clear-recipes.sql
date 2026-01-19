-- =====================================================
-- CLEAR RECIPES AND RELATED DATA
-- Run this in Supabase SQL Editor before re-scraping
-- =====================================================

-- First, delete ratings (they reference recipes)
DELETE FROM ratings;

-- Then delete preference weights (they might reference recipes)
DELETE FROM preference_weights;

-- Finally, delete all recipes
DELETE FROM recipes;

-- Verify everything is cleared
SELECT 'recipes' as table_name, COUNT(*) as count FROM recipes
UNION ALL
SELECT 'ratings' as table_name, COUNT(*) as count FROM ratings
UNION ALL
SELECT 'preference_weights' as table_name, COUNT(*) as count FROM preference_weights;
