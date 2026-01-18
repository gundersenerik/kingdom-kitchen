# 🍽️ Måltidsplaneraren (Meal Planner)

A meal planning app for picky eaters. Rate recipes, learn preferences, get family-friendly suggestions.

## Tech Stack

- **Frontend**: Next.js 14 (React)
- **Backend**: Vercel API routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS
- **Recommendations**: Weighted preference scoring

## Quick Start

### 1. Prerequisites

- Node.js 18+
- A Supabase account (free tier works)
- Vercel account (for deployment)

### 2. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. Go to **SQL Editor** and run the contents of `sql/schema.sql`

3. Go to **Settings > API** and copy:
   - Project URL
   - anon/public key
   - service_role key (for scraper only)

4. Go to **Authentication > URL Configuration** and add:
   - Site URL: `http://localhost:3000` (dev) and your production URL
   - Redirect URLs: `http://localhost:3000/auth/callback`

### 3. Local Development

```bash
# Clone/download the project
cd meal-planner

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Populate Recipes

```bash
# Install Python dependencies
pip install recipe-scrapers requests supabase python-dotenv

# Run scraper
python scripts/scraper.py --source arla --limit 50
```

### 5. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Or via CLI:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Project Structure

```
meal-planner/
├── app/                    # Next.js pages
│   ├── api/               # API routes
│   ├── auth/              # Auth callback
│   ├── login/             # Login page
│   ├── rate/              # Rating interface
│   └── suggest/           # Suggestions page
├── components/            # React components
├── lib/                   # Core logic
│   ├── features.ts        # Feature extraction
│   ├── recommendation.ts  # Scoring algorithm
│   ├── supabase.ts       # DB client
│   └── types.ts          # TypeScript types
├── scripts/              # Utilities
│   └── scraper.py        # Recipe scraper
├── sql/                  # Database schema
└── docs/                 # Documentation
```

## How It Works

### Rating Flow
1. User sees a recipe card
2. User rates: 😍 loved, 👍 liked, 🤷 neutral, 👎 disliked, 🤮 hated
3. Can optionally exclude specific ingredients
4. System updates preference weights automatically

### Recommendation Algorithm
- Each recipe has features (cuisine, proteins, carbs, ingredients, etc.)
- Each user has learned weights per feature
- Score = sum of (feature × weight)
- Family suggestions use minimum score across all members

### Database Trigger
When a rating is inserted, a PostgreSQL trigger automatically:
1. Extracts the recipe's features
2. Updates the user's preference weights
3. Handles ingredient exclusions

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/recipes/next` | GET | Get next recipe to rate |
| `/api/recipes/rate` | POST | Submit a rating |
| `/api/recipes/suggest` | GET | Get suggestions |
| `/api/profile/preferences` | GET | View learned preferences |

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # Only for scraper
```

## Extending

### Adding More Recipe Sources

Edit `scripts/scraper.py` and add sources to the `SOURCES` dict. The `recipe-scrapers` library supports 500+ sites.

### Migrating to FastAPI

The business logic in `lib/` is isolated from the API routes. To migrate:

1. Create FastAPI routes that call the same `lib/` functions
2. Update the frontend to point to the new API
3. Deploy FastAPI separately (Railway, Render, etc.)

## License

MIT
