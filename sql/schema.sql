-- Meal Planner Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- ENUMS
-- ===========================================

CREATE TYPE rating_value AS ENUM ('loved', 'liked', 'neutral', 'disliked', 'hated');

CREATE TYPE feature_type AS ENUM (
  'cuisine',
  'protein', 
  'carb',
  'cooking_method',
  'prep_time_bucket',
  'ingredient',
  'spice_level',
  'meal_type'
);

-- ===========================================
-- TABLES
-- ===========================================

-- Households (family units)
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (family members, linked to auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_child BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Recipes (scraped from external sources)
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT,
  source TEXT NOT NULL, -- 'arla', 'ica', 'koket', etc.
  name TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  image_url TEXT,
  description TEXT,
  
  -- Structured data
  ingredients JSONB NOT NULL DEFAULT '[]',
  -- Format: [{"amount": "500g", "ingredient": "nötfärs"}, ...]
  
  instructions TEXT[] DEFAULT '{}',
  
  -- Extracted features for recommendation engine
  features JSONB NOT NULL DEFAULT '{}',
  -- Format: {"cuisine": "swedish", "protein": ["beef"], "spice_level": "mild", ...}
  
  -- Timing
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  total_time_minutes INTEGER,
  
  servings TEXT,
  
  -- External ratings (from source site)
  external_rating DECIMAL(3,2), -- e.g., 4.50
  external_rating_count INTEGER,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ratings (user feedback on recipes)
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  
  rating rating_value NOT NULL,
  
  -- "I'd like this without..."
  excluded_ingredients TEXT[] DEFAULT '{}',
  
  -- Optional notes
  notes TEXT,
  
  -- When they'd eat it
  suitable_for TEXT[] DEFAULT '{}', -- ['weekday', 'weekend', 'special_occasion']
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(profile_id, recipe_id)
);

-- Preference weights (learned from ratings)
CREATE TABLE preference_weights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  feature_type feature_type NOT NULL,
  feature_value TEXT NOT NULL, -- e.g., 'indian', 'salmon', 'quick'
  
  weight DECIMAL(4,3) NOT NULL DEFAULT 0.0, -- Range: -1.000 to +1.000
  
  -- How many ratings contributed to this weight
  sample_count INTEGER DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(profile_id, feature_type, feature_value)
);

-- Meal plans (weekly schedules)
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  
  week_start DATE NOT NULL, -- Monday of the week
  
  -- Meals for the week
  meals JSONB NOT NULL DEFAULT '{}',
  -- Format: {
  --   "monday": {"lunch": "recipe_id", "dinner": "recipe_id"},
  --   "tuesday": {...},
  --   ...
  -- }
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(household_id, week_start)
);

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX idx_profiles_household ON profiles(household_id);
CREATE INDEX idx_profiles_user ON profiles(user_id);

CREATE INDEX idx_recipes_source ON recipes(source);
CREATE INDEX idx_recipes_features ON recipes USING GIN(features);
CREATE INDEX idx_recipes_external_rating ON recipes(external_rating DESC NULLS LAST);

CREATE INDEX idx_ratings_profile ON ratings(profile_id);
CREATE INDEX idx_ratings_recipe ON ratings(recipe_id);
CREATE INDEX idx_ratings_profile_rating ON ratings(profile_id, rating);

CREATE INDEX idx_preference_weights_profile ON preference_weights(profile_id);
CREATE INDEX idx_preference_weights_lookup ON preference_weights(profile_id, feature_type, feature_value);

CREATE INDEX idx_meal_plans_household_week ON meal_plans(household_id, week_start);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE preference_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
-- Recipes are public (read by all)

-- Households: members can read their own household
CREATE POLICY "Users can view their household" ON households
  FOR SELECT USING (
    id IN (
      SELECT household_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Profiles: users can manage their own profile, view household members
CREATE POLICY "Users can view household members" ON profiles
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Ratings: users can manage their own ratings, view household ratings
CREATE POLICY "Users can view household ratings" ON ratings
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE household_id IN (
        SELECT household_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage own ratings" ON ratings
  FOR ALL USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Preference weights: users can view their own weights
CREATE POLICY "Users can view own preferences" ON preference_weights
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own preferences" ON preference_weights
  FOR ALL USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Meal plans: household members can view/edit their plans
CREATE POLICY "Household members can manage meal plans" ON meal_plans
  FOR ALL USING (
    household_id IN (
      SELECT household_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Function to update preference weights after a rating
CREATE OR REPLACE FUNCTION update_preference_weights()
RETURNS TRIGGER AS $$
DECLARE
  recipe_features JSONB;
  feature_key TEXT;
  feature_val JSONB;
  weight_delta DECIMAL(4,3);
  ingredient TEXT;
BEGIN
  -- Get recipe features
  SELECT features INTO recipe_features FROM recipes WHERE id = NEW.recipe_id;
  
  -- Determine weight delta based on rating
  weight_delta := CASE NEW.rating
    WHEN 'loved' THEN 0.15
    WHEN 'liked' THEN 0.08
    WHEN 'neutral' THEN 0.0
    WHEN 'disliked' THEN -0.08
    WHEN 'hated' THEN -0.15
  END;
  
  -- Update weights for each feature
  FOR feature_key, feature_val IN SELECT * FROM jsonb_each(recipe_features)
  LOOP
    -- Handle array features (like proteins, ingredients)
    IF jsonb_typeof(feature_val) = 'array' THEN
      FOR ingredient IN SELECT jsonb_array_elements_text(feature_val)
      LOOP
        INSERT INTO preference_weights (profile_id, feature_type, feature_value, weight, sample_count)
        VALUES (NEW.profile_id, feature_key::feature_type, ingredient, weight_delta, 1)
        ON CONFLICT (profile_id, feature_type, feature_value)
        DO UPDATE SET 
          weight = GREATEST(-1.0, LEAST(1.0, preference_weights.weight + weight_delta)),
          sample_count = preference_weights.sample_count + 1,
          updated_at = NOW();
      END LOOP;
    ELSE
      -- Handle scalar features
      INSERT INTO preference_weights (profile_id, feature_type, feature_value, weight, sample_count)
      VALUES (NEW.profile_id, feature_key::feature_type, feature_val::text, weight_delta, 1)
      ON CONFLICT (profile_id, feature_type, feature_value)
      DO UPDATE SET 
        weight = GREATEST(-1.0, LEAST(1.0, preference_weights.weight + weight_delta)),
        sample_count = preference_weights.sample_count + 1,
        updated_at = NOW();
    END IF;
  END LOOP;
  
  -- Handle excluded ingredients (extra penalty)
  IF NEW.excluded_ingredients IS NOT NULL AND array_length(NEW.excluded_ingredients, 1) > 0 THEN
    FOREACH ingredient IN ARRAY NEW.excluded_ingredients
    LOOP
      INSERT INTO preference_weights (profile_id, feature_type, feature_value, weight, sample_count)
      VALUES (NEW.profile_id, 'ingredient', ingredient, -0.2, 1)
      ON CONFLICT (profile_id, feature_type, feature_value)
      DO UPDATE SET 
        weight = GREATEST(-1.0, preference_weights.weight - 0.2),
        sample_count = preference_weights.sample_count + 1,
        updated_at = NOW();
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update weights on new rating
CREATE TRIGGER on_rating_insert
  AFTER INSERT ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_preference_weights();

-- Function to calculate recipe score for a user
CREATE OR REPLACE FUNCTION calculate_recipe_score(p_profile_id UUID, p_recipe_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  recipe_features JSONB;
  total_score DECIMAL := 0;
  feature_key TEXT;
  feature_val JSONB;
  ingredient TEXT;
  user_weight DECIMAL;
BEGIN
  SELECT features INTO recipe_features FROM recipes WHERE id = p_recipe_id;
  
  FOR feature_key, feature_val IN SELECT * FROM jsonb_each(recipe_features)
  LOOP
    IF jsonb_typeof(feature_val) = 'array' THEN
      FOR ingredient IN SELECT jsonb_array_elements_text(feature_val)
      LOOP
        SELECT weight INTO user_weight 
        FROM preference_weights 
        WHERE profile_id = p_profile_id 
          AND feature_type = feature_key::feature_type 
          AND feature_value = ingredient;
        
        IF user_weight IS NOT NULL THEN
          total_score := total_score + user_weight;
        END IF;
      END LOOP;
    ELSE
      SELECT weight INTO user_weight 
      FROM preference_weights 
      WHERE profile_id = p_profile_id 
        AND feature_type = feature_key::feature_type 
        AND feature_value = feature_val::text;
      
      IF user_weight IS NOT NULL THEN
        total_score := total_score + user_weight;
      END IF;
    END IF;
  END LOOP;
  
  RETURN total_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get next recipe to rate (unrated, high external rating)
CREATE OR REPLACE FUNCTION get_next_recipe_to_rate(p_profile_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  url TEXT,
  image_url TEXT,
  ingredients JSONB,
  prep_time_minutes INTEGER,
  total_time_minutes INTEGER,
  external_rating DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.url,
    r.image_url,
    r.ingredients,
    r.prep_time_minutes,
    r.total_time_minutes,
    r.external_rating
  FROM recipes r
  WHERE NOT EXISTS (
    SELECT 1 FROM ratings rt 
    WHERE rt.recipe_id = r.id AND rt.profile_id = p_profile_id
  )
  ORDER BY r.external_rating DESC NULLS LAST, RANDOM()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get family suggestions
CREATE OR REPLACE FUNCTION get_family_suggestions(p_household_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  recipe_id UUID,
  recipe_name TEXT,
  image_url TEXT,
  min_score DECIMAL,
  scores JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH household_profiles AS (
    SELECT id, display_name FROM profiles WHERE household_id = p_household_id
  ),
  recipe_scores AS (
    SELECT 
      r.id AS rid,
      r.name AS rname,
      r.image_url AS rimg,
      p.id AS pid,
      p.display_name AS pname,
      calculate_recipe_score(p.id, r.id) AS score
    FROM recipes r
    CROSS JOIN household_profiles p
  ),
  aggregated AS (
    SELECT 
      rid,
      rname,
      rimg,
      MIN(score) AS min_score,
      jsonb_object_agg(pname, score) AS scores
    FROM recipe_scores
    GROUP BY rid, rname, rimg
  )
  SELECT 
    rid AS recipe_id,
    rname AS recipe_name,
    rimg AS image_url,
    min_score,
    scores
  FROM aggregated
  WHERE min_score > 0
  ORDER BY min_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- SEED DATA (for testing)
-- ===========================================

-- You can uncomment this to add test data
/*
INSERT INTO households (id, name) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Test Family');
*/
