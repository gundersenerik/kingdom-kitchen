# Supabase Setup Instructions for Meal Planner

## Context

This is a meal planning app for picky eaters. The database needs to store:
- Households (family units)
- Profiles (family members, linked to auth)
- Recipes (scraped from Swedish recipe sites)
- Ratings (user feedback on recipes)
- Preference weights (learned taste profiles)
- Meal plans (weekly schedules)

## Step 1: Run the Database Schema

Execute the following SQL in order. This creates all tables, enums, indexes, RLS policies, and functions.

### 1.1 Enable UUID Extension
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 1.2 Create Enums
```sql
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
```

### 1.3 Create Tables

**Households:**
```sql
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Profiles:**
```sql
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
```

**Recipes:**
```sql
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT,
  source TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  image_url TEXT,
  description TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]',
  instructions TEXT[] DEFAULT '{}',
  features JSONB NOT NULL DEFAULT '{}',
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  total_time_minutes INTEGER,
  servings TEXT,
  external_rating DECIMAL(3,2),
  external_rating_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Ratings:**
```sql
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  rating rating_value NOT NULL,
  excluded_ingredients TEXT[] DEFAULT '{}',
  notes TEXT,
  suitable_for TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, recipe_id)
);
```

**Preference Weights:**
```sql
CREATE TABLE preference_weights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  feature_type feature_type NOT NULL,
  feature_value TEXT NOT NULL,
  weight DECIMAL(4,3) NOT NULL DEFAULT 0.0,
  sample_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, feature_type, feature_value)
);
```

**Meal Plans:**
```sql
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  meals JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, week_start)
);
```

### 1.4 Create Indexes
```sql
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
```

### 1.5 Enable Row Level Security
```sql
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE preference_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
```

### 1.6 Create RLS Policies

**Households:**
```sql
CREATE POLICY "Users can view their household" ON households
  FOR SELECT USING (
    id IN (SELECT household_id FROM profiles WHERE user_id = auth.uid())
  );
```

**Profiles:**
```sql
CREATE POLICY "Users can view household members" ON profiles
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());
```

**Ratings:**
```sql
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
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );
```

**Preference Weights:**
```sql
CREATE POLICY "Users can view own preferences" ON preference_weights
  FOR SELECT USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage own preferences" ON preference_weights
  FOR ALL USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );
```

**Meal Plans:**
```sql
CREATE POLICY "Household members can manage meal plans" ON meal_plans
  FOR ALL USING (
    household_id IN (SELECT household_id FROM profiles WHERE user_id = auth.uid())
  );
```

### 1.7 Create the Auto-Update Weights Function

This is the core "learning" function. It runs automatically when a rating is inserted.

```sql
CREATE OR REPLACE FUNCTION update_preference_weights()
RETURNS TRIGGER AS $$
DECLARE
  recipe_features JSONB;
  feature_key TEXT;
  feature_val JSONB;
  weight_delta DECIMAL(4,3);
  ingredient TEXT;
BEGIN
  SELECT features INTO recipe_features FROM recipes WHERE id = NEW.recipe_id;
  
  weight_delta := CASE NEW.rating
    WHEN 'loved' THEN 0.15
    WHEN 'liked' THEN 0.08
    WHEN 'neutral' THEN 0.0
    WHEN 'disliked' THEN -0.08
    WHEN 'hated' THEN -0.15
  END;
  
  FOR feature_key, feature_val IN SELECT * FROM jsonb_each(recipe_features)
  LOOP
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
      INSERT INTO preference_weights (profile_id, feature_type, feature_value, weight, sample_count)
      VALUES (NEW.profile_id, feature_key::feature_type, feature_val::text, weight_delta, 1)
      ON CONFLICT (profile_id, feature_type, feature_value)
      DO UPDATE SET 
        weight = GREATEST(-1.0, LEAST(1.0, preference_weights.weight + weight_delta)),
        sample_count = preference_weights.sample_count + 1,
        updated_at = NOW();
    END IF;
  END LOOP;
  
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
```

### 1.8 Create the Trigger
```sql
CREATE TRIGGER on_rating_insert
  AFTER INSERT ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_preference_weights();
```

### 1.9 Create Helper Functions

**Get next recipe to rate:**
```sql
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
    r.id, r.name, r.url, r.image_url, r.ingredients,
    r.prep_time_minutes, r.total_time_minutes, r.external_rating
  FROM recipes r
  WHERE NOT EXISTS (
    SELECT 1 FROM ratings rt 
    WHERE rt.recipe_id = r.id AND rt.profile_id = p_profile_id
  )
  ORDER BY r.external_rating DESC NULLS LAST, RANDOM()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Calculate recipe score:**
```sql
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
```

**Get family suggestions:**
```sql
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
      r.id AS rid, r.name AS rname, r.image_url AS rimg,
      p.id AS pid, p.display_name AS pname,
      calculate_recipe_score(p.id, r.id) AS score
    FROM recipes r
    CROSS JOIN household_profiles p
  ),
  aggregated AS (
    SELECT 
      rid, rname, rimg,
      MIN(score) AS min_score,
      jsonb_object_agg(pname, score) AS scores
    FROM recipe_scores
    GROUP BY rid, rname, rimg
  )
  SELECT rid, rname, rimg, aggregated.min_score, aggregated.scores
  FROM aggregated
  WHERE aggregated.min_score > 0
  ORDER BY aggregated.min_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Step 2: Configure Authentication

In Supabase Dashboard → Authentication → URL Configuration:

1. **Site URL**: Set to your production URL (or `http://localhost:3000` for dev)

2. **Redirect URLs**: Add:
   - `http://localhost:3000/auth/callback`
   - `https://your-app.vercel.app/auth/callback` (after deployment)

3. **Email Templates** (optional): Customize the confirmation email to be in Swedish

## Step 3: Get API Keys

Go to Settings → API and note:
- **Project URL**: `https://xxxxx.supabase.co`
- **anon/public key**: For frontend (safe to expose)
- **service_role key**: For scraper only (keep secret!)

## Step 4: Verify Setup

Run these queries to confirm everything works:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Should return: households, profiles, recipes, ratings, preference_weights, meal_plans

-- Check enums exist
SELECT typname FROM pg_type WHERE typname IN ('rating_value', 'feature_type');

-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

-- Should include: update_preference_weights, calculate_recipe_score, 
--                 get_next_recipe_to_rate, get_family_suggestions

-- Check trigger exists
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- Should return: on_rating_insert
```

## Step 5: Insert Test Data (Optional)

```sql
-- Create a test household
INSERT INTO households (id, name) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Test Family');

-- Insert a sample recipe
INSERT INTO recipes (source, name, url, ingredients, features) VALUES (
  'test',
  'Pasta Carbonara',
  'https://example.com/carbonara',
  '[{"amount": "400g", "ingredient": "pasta"}, {"amount": "200g", "ingredient": "bacon"}]',
  '{"cuisine": "italian", "protein": ["pork"], "carb": "pasta", "prep_time_bucket": "quick"}'
);

-- Verify
SELECT * FROM recipes;
SELECT * FROM households;
```

## Summary Checklist

- [ ] UUID extension enabled
- [ ] Enums created (rating_value, feature_type)
- [ ] All 6 tables created
- [ ] Indexes created
- [ ] RLS enabled on 5 tables
- [ ] RLS policies created
- [ ] update_preference_weights function created
- [ ] on_rating_insert trigger created
- [ ] Helper functions created
- [ ] Auth redirect URLs configured
- [ ] API keys noted

## Environment Variables for the App

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
```
