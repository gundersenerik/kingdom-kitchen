-- =====================================================
-- IMAGE DIAGNOSIS QUERIES
-- Run these in Supabase SQL Editor
-- =====================================================

-- 1. OVERVIEW: How many recipes have images?
SELECT
  COUNT(*) as total_recipes,
  COUNT(image_url) as has_image_url,
  COUNT(*) - COUNT(image_url) as missing_image_url,
  ROUND(COUNT(image_url)::numeric / COUNT(*)::numeric * 100, 1) as pct_with_image
FROM recipes;

-- 2. IMAGE DOMAINS: Where do images come from?
SELECT
  CASE
    WHEN image_url IS NULL THEN '❌ NO IMAGE URL'
    ELSE split_part(split_part(image_url, '://', 2), '/', 1)
  END as image_domain,
  COUNT(*) as recipe_count
FROM recipes
GROUP BY 1
ORDER BY recipe_count DESC;

-- 3. SAMPLE WORKING IMAGES: Test these in browser
SELECT id, name, source, image_url
FROM recipes
WHERE image_url IS NOT NULL
  AND image_url LIKE '%images.arla.com%'
LIMIT 5;

-- 4. POTENTIALLY BROKEN IMAGES: Old/problematic URL patterns
SELECT id, name, image_url
FROM recipes
WHERE image_url IS NOT NULL
  AND (
    -- Check for old CDN patterns that might be broken
    image_url LIKE '%cloudfront%'
    OR image_url LIKE '%cdn.arla%'
    OR image_url LIKE '%static.arla%'
    OR image_url NOT LIKE '%images.arla.com%'
  )
LIMIT 20;

-- 5. RECIPES WITHOUT IMAGES
SELECT id, name, source, url
FROM recipes
WHERE image_url IS NULL
LIMIT 20;

-- 6. IMAGE URL PATTERNS (first 50 chars to see patterns)
SELECT
  LEFT(image_url, 50) as url_pattern,
  COUNT(*) as count
FROM recipes
WHERE image_url IS NOT NULL
GROUP BY 1
ORDER BY count DESC
LIMIT 20;
