# Meal Planner for Picky Eaters

## 1. Overview

**Problem:** Family members are picky eaters. 90% of recipes get rejected, making meal planning frustrating.

**Solution:** A "Tinder for recipes" app where family members swipe to rate recipes. The system learns preferences and suggests meals everyone will enjoy.

**Core features:**
- Scrape Swedish recipe banks (Arla, etc.) into database
- Each family member rates recipes (like/dislike/conditional)
- System learns individual preferences automatically
- Suggests meals that work for the whole family
- Weekly meal planning

## 2. Tech Stack

| Layer | Tool | Why |
|-------|------|-----|
| Database | Supabase (PostgreSQL) | Auth, RLS, user knows it |
| Backend | Vercel API routes (Python) | Fast deploy, portable to FastAPI later |
| Frontend | Next.js (React) | Vercel-native, handles deployment |
| Recommendations | Weighted scoring | Right tool for structured preferences |
| Scraping | recipe-scrapers library | Supports Swedish sites |
| Auth | Supabase Auth | Built-in, handles families |

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS                                    │
│                    (Family members)                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS FRONTEND                              │
│              (Vercel hosted, React)                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │ Rating UI   │ │ Meal Plan   │ │ Family View │                │
│  │ (Swipe)     │ │ (Weekly)    │ │ (Settings)  │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL API ROUTES                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │ /api/rate   │ │ /api/suggest│ │ /api/plan   │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │ Recipes     │ │ Ratings     │ │ Preferences │                │
│  │ (scraped)   │ │ (per user)  │ │ (weights)   │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
│  ┌─────────────┐ ┌─────────────┐                                │
│  │ Households  │ │ Profiles    │                                │
│  └─────────────┘ └─────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
                      ▲
                      │
┌─────────────────────┴───────────────────────────────────────────┐
│                    SCRAPER (Separate job)                        │
│              recipe-scrapers → Supabase                          │
└─────────────────────────────────────────────────────────────────┘
```

## 4. Database Schema

See `/sql/schema.sql` for complete SQL.

### Tables:

**households** - A family unit
- id, name, created_at

**profiles** - Individual family members (linked to Supabase Auth)
- id, household_id, user_id (auth), display_name, created_at

**recipes** - Scraped recipes
- id, external_id, source, name, url, image_url
- ingredients (jsonb), instructions (text[])
- features (jsonb) - extracted features for matching
- prep_time, cook_time, servings
- external_rating, external_rating_count
- created_at

**ratings** - User ratings on recipes
- id, profile_id, recipe_id
- rating (enum: loved, liked, neutral, disliked, hated)
- excluded_ingredients (text[]) - "I'd like it without X"
- notes, created_at

**preference_weights** - Learned preferences per user
- id, profile_id, feature_type, feature_value, weight
- updated_at

**meal_plans** - Weekly plans
- id, household_id, week_start, meals (jsonb), created_at

## 5. Recommendation Algorithm

### Feature Extraction
Every recipe gets features extracted:
```json
{
  "cuisine": "swedish",
  "protein": ["beef", "pork"],
  "carb": "potato",
  "cooking_method": "fried",
  "prep_time_bucket": "quick",
  "ingredients": ["onion", "cream", "breadcrumbs"],
  "spice_level": "mild"
}
```

### Weight Updates
After each rating:
1. Extract recipe features
2. For each feature, adjust user's weight:
   - Loved: weight += 0.15
   - Liked: weight += 0.08
   - Neutral: weight += 0.0
   - Disliked: weight -= 0.08
   - Hated: weight -= 0.15
3. Clamp weights between -1.0 and +1.0
4. Handle excluded ingredients: weight -= 0.2 for that specific ingredient

### Scoring a Recipe
```
score = sum(recipe_feature_value * user_weight for each feature)
```

### Family Suggestions
```
family_score = min(individual_scores) 
-- Only suggest if EVERYONE scores above threshold
```

## 6. Decision Log

| Decision | Choice | Why NOT the alternative |
|----------|--------|------------------------|
| Database | Supabase | User knows it, auth built-in. NOT Airtable (record limits) |
| Recommendations | Weighted scoring | Explainable, works with small data. NOT LLM (doesn't learn), NOT vectors (overkill) |
| Backend | Vercel Python | Fast deploy. Code structured to migrate to FastAPI later |
| Frontend | Next.js | Vercel-native. User had issues with plain React locally |
| Scraping | recipe-scrapers | Supports Swedish sites, well-maintained |

## 7. API Endpoints

### POST /api/recipes/rate
Rate a recipe.
```json
// Request
{
  "recipe_id": "uuid",
  "rating": "liked",
  "excluded_ingredients": ["salmon"],
  "notes": "Would be great without the fish"
}

// Response
{
  "success": true,
  "updated_weights": 5
}
```

### GET /api/recipes/next
Get next recipe to rate.
```json
// Response
{
  "recipe": {
    "id": "uuid",
    "name": "Köttbullar",
    "image_url": "...",
    "ingredients": [...],
    "prep_time": 30
  }
}
```

### GET /api/recipes/suggest?for=family
Get recipe suggestions.
```json
// Response
{
  "suggestions": [
    {
      "recipe": {...},
      "family_score": 1.2,
      "individual_scores": {
        "erik": 1.4,
        "lisa": 1.2,
        "kids": 1.5
      },
      "why": "Everyone likes pasta and cream sauce"
    }
  ]
}
```

### GET /api/profile/preferences
Get current user's learned preferences.
```json
// Response
{
  "preferences": [
    {"feature": "cuisine:swedish", "weight": 0.8},
    {"feature": "cuisine:indian", "weight": -0.7},
    {"feature": "ingredient:pasta", "weight": 0.9}
  ]
}
```

## 8. File Structure

```
meal-planner/
├── app/                    # Next.js app directory
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Home/landing
│   ├── login/page.tsx      # Auth
│   ├── rate/page.tsx       # Swipe rating UI
│   ├── suggest/page.tsx    # Family suggestions
│   ├── plan/page.tsx       # Weekly meal plan
│   └── profile/page.tsx    # User preferences view
│
├── components/             # React components
│   ├── RecipeCard.tsx      # Recipe display for swiping
│   ├── RatingButtons.tsx   # Like/dislike controls
│   ├── FamilyScores.tsx    # Show who likes what
│   └── WeekPlanner.tsx     # Calendar view
│
├── lib/                    # Core logic (portable)
│   ├── recommendation.ts   # Scoring algorithm
│   ├── features.ts         # Feature extraction
│   ├── supabase.ts         # DB client
│   └── types.ts            # TypeScript types
│
├── api/                    # Vercel API routes
│   ├── recipes/
│   │   ├── rate/route.ts
│   │   ├── next/route.ts
│   │   └── suggest/route.ts
│   └── profile/
│       └── preferences/route.ts
│
├── sql/                    # Database
│   └── schema.sql          # Full schema
│
├── scripts/                # Utilities
│   └── scraper.py          # Recipe scraping
│
└── docs/
    └── PROJECT_SPEC.md     # This file
```

## 9. Test Scenarios

### Scenario 1: Indian Food Rejection
1. Lisa rates 10 Indian recipes as "disliked"
2. Expected: `cuisine:indian` weight drops to ~-0.8
3. Expected: Next recipes shown exclude Indian cuisine
4. Verify: `GET /api/recipes/next` returns non-Indian recipes

### Scenario 2: Ingredient Exclusion
1. Erik rates "Laxpasta" as "liked" but excludes "salmon"
2. Expected: Base recipe features get positive weight
3. Expected: `ingredient:salmon` gets -0.2 penalty
4. Verify: Future salmon dishes score lower for Erik

### Scenario 3: Family Suggestion
1. Lisa: likes pasta (+0.8), dislikes fish (-0.6)
2. Erik: likes pasta (+0.7), likes fish (+0.5)
3. Kids: likes pasta (+0.9), neutral on fish (0.0)
4. Query: Family suggestions
5. Expected: Pasta dishes rank high, fish dishes excluded (Lisa vetoes)

### Scenario 4: Cold Start
1. New user joins household
2. Expected: Sees recipes sorted by external_rating (crowd favorites)
3. After 10 ratings: Personalized suggestions begin
4. After 30 ratings: Strong preference profile

## 10. Setup Commands

```bash
# 1. Clone/download project
cd meal-planner

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Push database schema
npx supabase db push

# 5. Run locally
npm run dev

# 6. Deploy to Vercel
vercel deploy
```

## 11. Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # Only for scraper/admin
```
