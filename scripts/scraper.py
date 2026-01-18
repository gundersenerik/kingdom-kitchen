#!/usr/bin/env python3
"""
Recipe Scraper for Meal Planner

Scrapes recipes from Swedish recipe sites and stores them in Supabase.

Usage:
    python scripts/scraper.py --source arla --limit 100
    python scripts/scraper.py --source arla --url https://www.arla.se/recept/kottbullar/

Requirements:
    pip install recipe-scrapers requests supabase python-dotenv
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv

try:
    from recipe_scrapers import scrape_me
    import requests
    from supabase import create_client, Client
except ImportError:
    print("Missing dependencies. Install with:")
    print("  pip install recipe-scrapers requests supabase python-dotenv")
    sys.exit(1)

# Load environment variables
load_dotenv()

# Supabase setup
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing Supabase credentials in environment")
    print("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Swedish recipe sources
SOURCES = {
    'arla': {
        'base_url': 'https://www.arla.se',
        'recipe_list': 'https://www.arla.se/recept/',
        'supports_scraper': True,
    },
    'koket': {
        'base_url': 'https://www.koket.se',
        'recipe_list': 'https://www.koket.se/recept',
        'supports_scraper': True,  # Wild mode
    },
}

# Feature extraction keywords (same as TypeScript version)
PROTEIN_KEYWORDS = {
    'nötfärs': 'beef', 'köttfärs': 'beef', 'fläskfärs': 'pork',
    'blandfärs': 'mixed_meat', 'kyckling': 'chicken', 'kycklingfilé': 'chicken',
    'lax': 'salmon', 'torsk': 'cod', 'räkor': 'shrimp', 'fisk': 'fish',
    'bacon': 'pork', 'skinka': 'ham', 'korv': 'sausage', 'ägg': 'egg',
    'tofu': 'tofu', 'linser': 'lentils', 'bönor': 'beans',
    'kikärtor': 'chickpeas', 'fläsk': 'pork', 'lamm': 'lamb',
}

CUISINE_KEYWORDS = {
    'sojasås': 'asian', 'ingefära': 'asian', 'wasabi': 'japanese',
    'miso': 'japanese', 'curry': 'indian', 'garam masala': 'indian',
    'tikka': 'indian', 'tandoori': 'indian', 'taco': 'mexican',
    'salsa': 'mexican', 'tortilla': 'mexican', 'parmesan': 'italian',
    'mozzarella': 'italian', 'basilika': 'italian', 'pesto': 'italian',
    'feta': 'greek', 'tzatziki': 'greek', 'hummus': 'middle_eastern',
    'tahini': 'middle_eastern', 'harissa': 'middle_eastern',
    'lingon': 'swedish', 'dill': 'swedish', 'grädde': 'swedish',
}

CARB_KEYWORDS = {
    'pasta': 'pasta', 'spaghetti': 'pasta', 'penne': 'pasta',
    'ris': 'rice', 'potatis': 'potato', 'bröd': 'bread',
    'couscous': 'couscous', 'nudlar': 'noodles', 'bulgur': 'bulgur',
}


def extract_features(ingredients: list, name: str, prep_time: int = 0, cook_time: int = 0) -> dict:
    """Extract structured features from recipe data."""
    features = {}
    
    # Combine all text
    all_text = ' '.join([name.lower()] + [i.lower() for i in ingredients])
    
    # Extract proteins
    proteins = set()
    for keyword, protein in PROTEIN_KEYWORDS.items():
        if keyword in all_text:
            proteins.add(protein)
    if proteins:
        features['protein'] = list(proteins)
    
    # Extract carbs
    for keyword, carb in CARB_KEYWORDS.items():
        if keyword in all_text:
            features['carb'] = carb
            break
    
    # Detect cuisine
    cuisine_counts = {}
    for keyword, cuisine in CUISINE_KEYWORDS.items():
        if keyword in all_text:
            cuisine_counts[cuisine] = cuisine_counts.get(cuisine, 0) + 1
    if cuisine_counts:
        features['cuisine'] = max(cuisine_counts, key=cuisine_counts.get)
    
    # Time bucket
    total_time = prep_time + cook_time
    if total_time > 0:
        if total_time <= 30:
            features['prep_time_bucket'] = 'quick'
        elif total_time <= 60:
            features['prep_time_bucket'] = 'medium'
        else:
            features['prep_time_bucket'] = 'long'
    
    # Store key ingredients
    features['ingredients'] = ingredients[:10]
    
    return features


def scrape_recipe(url: str, source: str) -> Optional[dict]:
    """Scrape a single recipe URL."""
    try:
        scraper = scrape_me(url, wild_mode=True)
        
        # Extract data
        ingredients_raw = scraper.ingredients()
        
        # Parse ingredients into structured format
        ingredients = []
        for ing in ingredients_raw:
            # Basic parsing - could be enhanced
            ingredients.append({
                'amount': '',
                'ingredient': ing,
            })
        
        # Get timing
        try:
            prep_time = scraper.prep_time() or 0
        except:
            prep_time = 0
            
        try:
            cook_time = scraper.cook_time() or 0
        except:
            cook_time = 0
            
        try:
            total_time = scraper.total_time() or (prep_time + cook_time)
        except:
            total_time = prep_time + cook_time
        
        # Get ratings if available
        try:
            rating = scraper.ratings()
        except:
            rating = None
            
        try:
            rating_count = scraper.ratings_count()
        except:
            rating_count = None
        
        # Build features
        ingredient_names = [i['ingredient'] for i in ingredients]
        features = extract_features(
            ingredient_names,
            scraper.title(),
            prep_time,
            cook_time
        )
        
        return {
            'source': source,
            'name': scraper.title(),
            'url': url,
            'image_url': scraper.image(),
            'description': scraper.description() if hasattr(scraper, 'description') else None,
            'ingredients': ingredients,
            'instructions': scraper.instructions_list(),
            'features': features,
            'prep_time_minutes': prep_time if prep_time > 0 else None,
            'cook_time_minutes': cook_time if cook_time > 0 else None,
            'total_time_minutes': total_time if total_time > 0 else None,
            'servings': scraper.yields(),
            'external_rating': float(rating) if rating else None,
            'external_rating_count': int(rating_count) if rating_count else None,
        }
        
    except Exception as e:
        print(f"  Error scraping {url}: {e}")
        return None


def save_recipe(recipe: dict) -> bool:
    """Save recipe to Supabase."""
    try:
        # Check if already exists
        existing = supabase.table('recipes').select('id').eq('url', recipe['url']).execute()
        
        if existing.data:
            print(f"  Already exists: {recipe['name']}")
            return False
        
        # Insert
        result = supabase.table('recipes').insert(recipe).execute()
        
        if result.data:
            print(f"  Saved: {recipe['name']}")
            return True
        else:
            print(f"  Failed to save: {recipe['name']}")
            return False
            
    except Exception as e:
        print(f"  Database error: {e}")
        return False


def get_recipe_urls_from_sitemap(source: str, limit: int = 100) -> list:
    """Get recipe URLs from a source's sitemap or listing."""
    # This is a simplified version - in production you'd parse actual sitemaps
    # For demo purposes, returning some known recipe URLs
    
    if source == 'arla':
        # Sample Arla recipes
        return [
            'https://www.arla.se/recept/kottbullar/',
            'https://www.arla.se/recept/lasagne/',
            'https://www.arla.se/recept/pannkakor/',
            'https://www.arla.se/recept/pasta-carbonara/',
            'https://www.arla.se/recept/tacos/',
            'https://www.arla.se/recept/kycklinggryta/',
            'https://www.arla.se/recept/fiskgratang/',
            'https://www.arla.se/recept/kottfarssas/',
            'https://www.arla.se/recept/falukorv-stroganoff/',
            'https://www.arla.se/recept/raggmunk/',
        ][:limit]
    
    return []


def main():
    parser = argparse.ArgumentParser(description='Scrape recipes for Meal Planner')
    parser.add_argument('--source', choices=list(SOURCES.keys()), default='arla',
                        help='Recipe source to scrape')
    parser.add_argument('--url', type=str, help='Scrape a specific URL')
    parser.add_argument('--limit', type=int, default=10, help='Max recipes to scrape')
    
    args = parser.parse_args()
    
    print(f"\n🍽️  Meal Planner Recipe Scraper")
    print(f"   Source: {args.source}")
    print(f"   Limit: {args.limit}")
    print()
    
    if args.url:
        # Scrape single URL
        print(f"Scraping: {args.url}")
        recipe = scrape_recipe(args.url, args.source)
        if recipe:
            save_recipe(recipe)
    else:
        # Scrape multiple
        urls = get_recipe_urls_from_sitemap(args.source, args.limit)
        print(f"Found {len(urls)} URLs to scrape\n")
        
        success = 0
        for i, url in enumerate(urls, 1):
            print(f"[{i}/{len(urls)}] {url}")
            recipe = scrape_recipe(url, args.source)
            if recipe and save_recipe(recipe):
                success += 1
        
        print(f"\n✅ Done! Saved {success}/{len(urls)} recipes")


if __name__ == '__main__':
    main()
