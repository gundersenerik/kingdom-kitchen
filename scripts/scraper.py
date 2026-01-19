#!/usr/bin/env python3
"""
Recipe Scraper for Meal Planner

Scrapes recipes from Swedish recipe sites and stores them in Supabase.

Usage:
    python scripts/scraper.py --source arla --limit 100
    python scripts/scraper.py --source arla --url https://www.arla.se/recept/kottbullar/

Requirements:
    pip install recipe-scrapers requests supabase python-dotenv beautifulsoup4
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin
from dotenv import load_dotenv

try:
    from recipe_scrapers import scrape_me
    import requests
    from bs4 import BeautifulSoup
    from supabase import create_client, Client
except ImportError:
    print("Missing dependencies. Install with:")
    print("  pip install recipe-scrapers requests supabase python-dotenv beautifulsoup4")
    sys.exit(1)

# Request headers to mimic a browser
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
}

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

# Meal type detection keywords
MEAL_TYPE_KEYWORDS = {
    'dessert': ['tårta', 'kaka', 'muffins', 'cupcake', 'brownie', 'glass', 'mousse',
                'pannacotta', 'cheesecake', 'kladdkaka', 'chokladboll', 'biskvi',
                'dessert', 'efterrätt', 'godis', 'karamell', 'praliner'],
    'breakfast': ['frukost', 'morgon', 'overnight', 'granola', 'müsli', 'gröt',
                  'äggröra', 'omelett', 'smoothie bowl'],
    'snack': ['snacks', 'tilltugg', 'mellanmål', 'dippsås', 'chips', 'popcorn'],
    'drink': ['dryck', 'smoothie', 'juice', 'lemonad', 'kaffe', 'te', 'cocktail',
              'milkshake', 'drink'],
    'baking': ['baka', 'bakelse', 'bröd', 'bulle', 'kanelbulle', 'kardemummabulle',
               'scones', 'croissant'],
    # If none of the above match, it's likely a main dish (lunch/dinner)
}


def validate_image_url(url: str, timeout: int = 10) -> bool:
    """Check if an image URL is accessible and returns a valid image."""
    if not url:
        return False
    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True, headers=HEADERS)
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            return 'image' in content_type.lower()
        return False
    except:
        return False


def extract_image_from_html(html: str, base_url: str) -> Optional[str]:
    """
    Extract the best image URL from HTML content.
    Uses multiple methods in order of reliability.
    """
    soup = BeautifulSoup(html, 'html.parser')

    # Method 1: Look for JSON-LD schema (most reliable)
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(script.string)
            schemas = data if isinstance(data, list) else [data]
            for schema in schemas:
                if schema.get('@type') == 'Recipe' and schema.get('image'):
                    img = schema['image']
                    if isinstance(img, list):
                        return img[0] if img else None
                    elif isinstance(img, dict):
                        return img.get('url')
                    return img
        except (json.JSONDecodeError, TypeError):
            continue

    # Method 2: Check for notificationPreview (Arla specific)
    preview_match = re.search(r'notificationPreview\s*=\s*(\{[^;]+\})', html)
    if preview_match:
        try:
            preview_data = json.loads(preview_match.group(1))
            if preview_data.get('picture', {}).get('url'):
                return preview_data['picture']['url']
        except (json.JSONDecodeError, TypeError):
            pass

    # Method 3: Open Graph meta tag
    og_image = soup.find('meta', property='og:image')
    if og_image and og_image.get('content'):
        return og_image['content']

    # Method 4: Twitter card image
    twitter_image = soup.find('meta', {'name': 'twitter:image'})
    if twitter_image and twitter_image.get('content'):
        return twitter_image['content']

    # Method 5: Look for large images in common recipe containers
    for selector in ['.recipe-hero img', '.recipe-image img', '[class*="recipe"] img',
                     '.hero-image img', 'article img', 'main img']:
        img = soup.select_one(selector)
        if img:
            src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
            if src and not src.startswith('data:'):
                return urljoin(base_url, src)

    return None


def get_best_image_url(scraper_image: Optional[str], url: str, html: Optional[str] = None) -> Optional[str]:
    """
    Get the best working image URL for a recipe.
    First validates the scraper's image, then falls back to extraction.
    """
    # Try the scraper's image first
    if scraper_image and validate_image_url(scraper_image):
        return scraper_image

    # If scraper image is broken, try to extract from page HTML
    if html:
        extracted = extract_image_from_html(html, url)
        if extracted and validate_image_url(extracted):
            return extracted

    # Last resort: fetch the page and extract
    try:
        response = requests.get(url, timeout=15, headers=HEADERS)
        if response.status_code == 200:
            extracted = extract_image_from_html(response.text, url)
            if extracted and validate_image_url(extracted):
                return extracted
    except:
        pass

    # Return scraper image even if unvalidated (better than nothing)
    return scraper_image


def extract_features(ingredients: list, name: str, prep_time: int = 0, cook_time: int = 0) -> dict:
    """Extract structured features from recipe data."""
    features = {}

    # Combine all text
    all_text = ' '.join([name.lower()] + [i.lower() for i in ingredients])

    # Detect meal type
    meal_type = 'main'  # Default to main dish (lunch/dinner)
    for mtype, keywords in MEAL_TYPE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in all_text:
                meal_type = mtype
                break
        if meal_type != 'main':
            break
    features['meal_type'] = meal_type
    
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
        # Try with wild_mode first (newer versions), fall back to without it
        try:
            scraper = scrape_me(url, wild_mode=True)
        except TypeError:
            # Older version of recipe-scrapers doesn't support wild_mode
            scraper = scrape_me(url)
        
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
        
        # Get and validate image URL
        scraper_image = scraper.image()
        image_url = get_best_image_url(scraper_image, url)

        if image_url != scraper_image:
            print(f"    📸 Fixed image URL (was broken)")

        return {
            'source': source,
            'name': scraper.title(),
            'url': url,
            'image_url': image_url,
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

    if source == 'arla':
        # Fetch real recipe URLs from Arla's sitemap
        print("Fetching recipe URLs from Arla sitemap...")
        urls = []

        try:
            # Arla has a sitemap index
            sitemap_url = 'https://www.arla.se/sitemap.xml'
            response = requests.get(sitemap_url, timeout=30, headers=HEADERS)

            if response.status_code == 200:
                # Parse sitemap to find recipe sitemap
                soup = BeautifulSoup(response.text, 'xml')

                # Look for recipe-specific sitemap or parse main sitemap
                for loc in soup.find_all('loc'):
                    url = loc.text
                    if 'recept' in url and url.endswith('.xml'):
                        # Found recipe sitemap, fetch it
                        print(f"  Found recipe sitemap: {url}")
                        recipe_sitemap = requests.get(url, timeout=30, headers=HEADERS)
                        if recipe_sitemap.status_code == 200:
                            recipe_soup = BeautifulSoup(recipe_sitemap.text, 'xml')
                            for recipe_loc in recipe_soup.find_all('loc'):
                                recipe_url = recipe_loc.text
                                if '/recept/' in recipe_url and not recipe_url.endswith('/recept/'):
                                    urls.append(recipe_url)
                                    if len(urls) >= limit:
                                        break
                        if len(urls) >= limit:
                            break

                # If no recipe sitemap found, look for recipe URLs directly
                if not urls:
                    for loc in soup.find_all('loc'):
                        url = loc.text
                        if '/recept/' in url and not url.endswith('/recept/'):
                            urls.append(url)
                            if len(urls) >= limit:
                                break

            if urls:
                print(f"  Found {len(urls)} recipe URLs from sitemap")
                return urls[:limit]

        except Exception as e:
            print(f"  Error fetching sitemap: {e}")

        # Fallback: crawl recipe listing page
        print("  Falling back to crawling recipe listing...")

        # URLs to skip (not actual recipes)
        skip_patterns = ['/samling/', '/arla-mat-app/', '/matkanalen/', '/inspiration/', '/arla-mat/']

        try:
            listing_url = 'https://www.arla.se/recept/'
            response = requests.get(listing_url, timeout=30, headers=HEADERS)

            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')

                # Find recipe links
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    if '/recept/' in href and href.count('/') >= 3:
                        # Skip non-recipe pages
                        if any(skip in href for skip in skip_patterns):
                            continue
                        full_url = href if href.startswith('http') else f"https://www.arla.se{href}"
                        if full_url not in urls and not full_url.endswith('/recept/'):
                            urls.append(full_url)
                            if len(urls) >= limit:
                                break

                print(f"  Found {len(urls)} recipe URLs from listing")

        except Exception as e:
            print(f"  Error crawling listing: {e}")

        # Ultimate fallback: known popular recipes
        if not urls:
            print("  Using fallback list of popular recipes...")
            urls = [
                'https://www.arla.se/recept/kottbullar/',
                'https://www.arla.se/recept/lasagne/',
                'https://www.arla.se/recept/pannkakor/',
                'https://www.arla.se/recept/pasta-carbonara/',
                'https://www.arla.se/recept/korvstroganoff/',
                'https://www.arla.se/recept/kycklinggryta/',
                'https://www.arla.se/recept/fiskgratang/',
                'https://www.arla.se/recept/kottfarssas/',
                'https://www.arla.se/recept/falukorv-stroganoff/',
                'https://www.arla.se/recept/raggmunk/',
                'https://www.arla.se/recept/pytt-i-panna/',
                'https://www.arla.se/recept/spaghetti-och-kottpullar/',
                'https://www.arla.se/recept/grillad-kyckling/',
                'https://www.arla.se/recept/kycklingsallad/',
                'https://www.arla.se/recept/laxpasta/',
                'https://www.arla.se/recept/falafel/',
                'https://www.arla.se/recept/vegetarisk-lasagne/',
                'https://www.arla.se/recept/potatisgratang/',
                'https://www.arla.se/recept/chili-con-carne/',
                'https://www.arla.se/recept/chicken-tikka-masala/',
            ]

        return urls[:limit]

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
