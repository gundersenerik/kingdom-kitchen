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
        'recipe_path': '/recept/',
        'supports_scraper': True,
    },
    'ica': {
        'base_url': 'https://www.ica.se',
        'recipe_path': '/recept/',
        'supports_scraper': True,
    },
    'koket': {
        'base_url': 'https://www.koket.se',
        'recipe_path': '/',
        'supports_scraper': True,
    },
    'tasteline': {
        'base_url': 'https://www.tasteline.com',
        'recipe_path': '/recept/',
        'supports_scraper': True,
    },
    'coop': {
        'base_url': 'https://www.coop.se',
        'recipe_path': '/recept/',
        'supports_scraper': True,
    },
    'receptse': {
        'base_url': 'https://recept.se',
        'recipe_path': '/',
        'supports_scraper': True,
    },
    'godare': {
        'base_url': 'https://www.godare.se',
        'recipe_path': '/recept/',
        'supports_scraper': True,
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

    # Combine all text for ingredient analysis
    all_text = ' '.join([name.lower()] + [i.lower() for i in ingredients])

    # For meal type detection, ONLY use the recipe name
    # This prevents false positives from ingredients like "juice" (citrus juice) or "grädde" (cream)
    name_lower = name.lower()

    # Detect meal type based on recipe NAME only
    meal_type = 'main'  # Default to main dish (lunch/dinner)
    for mtype, keywords in MEAL_TYPE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in name_lower:
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


def get_existing_urls() -> set:
    """Get URLs already in the database to avoid re-scraping."""
    try:
        result = supabase.table('recipes').select('url').execute()
        return {r['url'] for r in result.data} if result.data else set()
    except:
        return set()


# Source-specific configuration for URL discovery
SOURCE_CONFIG = {
    'arla': {
        'base_url': 'https://www.arla.se',
        'recipe_pattern': '/recept/',
        'skip_patterns': ['/samling/', '/arla-mat-app/', '/matkanalen/', '/inspiration/', '/arla-mat/', '/kategori/'],
        'category_pages': [
            '/recept/', '/recept/samling/vardag/', '/recept/samling/middag/', '/recept/samling/lunch/',
            '/recept/samling/snabb-middag/', '/recept/samling/billig/', '/recept/samling/kyckling/',
            '/recept/samling/pasta/', '/recept/samling/fisk/', '/recept/samling/vegetariskt/',
            '/recept/samling/soppa/', '/recept/samling/gratang/', '/recept/samling/sallad/',
            '/recept/samling/gryta/', '/recept/samling/korv/', '/recept/samling/kottfars/',
            '/recept/samling/lax/', '/recept/samling/potatis/', '/recept/samling/ris/',
            '/recept/samling/wok/', '/recept/samling/pizza/', '/recept/samling/tacos/',
            '/recept/samling/thai/', '/recept/samling/indiskt/', '/recept/samling/italienskt/',
            '/recept/samling/mexikanskt/', '/recept/samling/asiatiskt/',
        ],
    },
    'ica': {
        'base_url': 'https://www.ica.se',
        'recipe_pattern': '/recept/',
        'skip_patterns': ['/recept/tips/', '/recept/inspiration/', '/recept/matkasse/', '/recept/sok/'],
        'category_pages': [
            '/recept/', '/recept/middagstips/', '/recept/vegetariskt/', '/recept/fisk-och-skaldjur/',
            '/recept/kyckling/', '/recept/kott/', '/recept/pasta-och-ris/', '/recept/sallad/',
            '/recept/soppa/', '/recept/gratang/', '/recept/gryta/', '/recept/pizza/',
            '/recept/asiatiskt/', '/recept/indiskt/', '/recept/mexikanskt/', '/recept/italienskt/',
            '/recept/barnfavoriter/', '/recept/snabbt-och-enkelt/', '/recept/billig-mat/',
            '/recept/grillat/', '/recept/surdeg/', '/recept/lunch/',
        ],
    },
    'koket': {
        'base_url': 'https://www.koket.se',
        'recipe_pattern': '/',  # Köket uses direct URLs like /lasagne/
        'skip_patterns': ['/kategori/', '/tips/', '/kokbok/', '/mat-dryck/', '/utrustning/'],
        'category_pages': [
            '/recept/', '/middagsrecept/', '/vardagsmat/', '/vegetariska-recept/',
            '/fisk-och-skaldjursrecept/', '/kycklingrecept/', '/pastarecept/', '/gratangrecept/',
            '/soppa/', '/gryta/', '/sallad/', '/pizza/', '/asiatisk-mat/',
            '/indisk-mat/', '/mexikanskt/', '/italiensk-mat/', '/snabba-recept/',
        ],
        'has_json_ld': True,  # Köket uses structured data we can parse
    },
    'tasteline': {
        'base_url': 'https://www.tasteline.com',
        'recipe_pattern': '/recept/',
        'skip_patterns': ['/kategori/', '/tips/', '/om-oss/'],
        'category_pages': [
            '/recept/', '/recept/middag/', '/recept/vegetariskt/', '/recept/fisk/',
            '/recept/kyckling/', '/recept/kott/', '/recept/pasta/', '/recept/sallad/',
            '/recept/soppa/', '/recept/gratang/', '/recept/gryta/', '/recept/pizza/',
            '/recept/asiatiskt/', '/recept/indiskt/', '/recept/mexikanskt/', '/recept/italienskt/',
        ],
    },
    'coop': {
        'base_url': 'https://www.coop.se',
        'recipe_pattern': '/recept/',
        'skip_patterns': ['/recept/kategori/', '/recept/tema/', '/recept/sok/'],
        'category_pages': [
            '/recept/', '/recept/kategori/middag/', '/recept/kategori/vegetariskt/',
            '/recept/kategori/fisk-skaldjur/', '/recept/kategori/kyckling/', '/recept/kategori/kott/',
            '/recept/kategori/pasta/', '/recept/kategori/sallad/', '/recept/kategori/soppa/',
            '/recept/kategori/gratang/', '/recept/kategori/gryta/', '/recept/kategori/pizza/',
            '/recept/kategori/snabb-mat/', '/recept/kategori/barnmat/',
        ],
    },
    'receptse': {
        'base_url': 'https://recept.se',
        'recipe_pattern': '/',  # recept.se uses direct URLs
        'skip_patterns': ['/kategori/', '/om/', '/kontakt/', '/tips/'],
        'category_pages': [
            '/', '/middag/', '/vegetariskt/', '/fisk/', '/kyckling/', '/kott/',
            '/pasta/', '/sallad/', '/soppa/', '/gratang/', '/gryta/',
        ],
    },
    'godare': {
        'base_url': 'https://www.godare.se',
        'recipe_pattern': '/recept/',
        'skip_patterns': ['/recept/kategori/', '/recept/sok/'],
        'category_pages': [
            '/recept/', '/recept/middag/', '/recept/vegetariskt/', '/recept/fisk/',
            '/recept/kyckling/', '/recept/kott/', '/recept/pasta/', '/recept/sallad/',
            '/recept/soppa/', '/recept/gryta/',
        ],
    },
}


def get_recipe_urls(source: str, limit: int = 100) -> list:
    """Get recipe URLs from any supported source."""

    if source not in SOURCE_CONFIG:
        print(f"Unknown source: {source}")
        return []

    config = SOURCE_CONFIG[source]
    base_url = config['base_url']
    recipe_pattern = config['recipe_pattern']
    skip_patterns = config.get('skip_patterns', [])
    category_pages = config.get('category_pages', ['/'])

    print(f"Fetching recipe URLs from {source.upper()}...")
    urls = []
    seen = set()

    # Get existing URLs to skip
    existing_urls = get_existing_urls()
    print(f"  {len(existing_urls)} recipes already in database")

    def is_recipe_url(url: str) -> bool:
        """Check if URL looks like a recipe page."""
        if not url.startswith(base_url):
            return False
        path = url.replace(base_url, '')

        # Must contain recipe pattern (for most sites)
        if recipe_pattern != '/' and recipe_pattern not in path:
            return False

        # Skip known non-recipe patterns
        if any(skip in path for skip in skip_patterns):
            return False

        # Must have actual content after the pattern
        path_parts = path.strip('/').split('/')
        if recipe_pattern == '/recept/':
            # For /recept/ sites, need something after /recept/
            if len(path_parts) < 2 or path_parts[-1] == 'recept':
                return False
        elif recipe_pattern == '/':
            # For sites with direct URLs, need at least one path segment
            if len(path_parts) < 1 or path_parts[0] == '':
                return False

        return True

    def add_url(url: str) -> bool:
        """Add URL if valid and not seen/existing."""
        # Normalize URL
        url = url.split('?')[0].split('#')[0]
        if not url.endswith('/'):
            url += '/'

        if url in seen or url in existing_urls:
            return False
        if not is_recipe_url(url):
            return False

        seen.add(url)
        urls.append(url)
        return True

    def extract_recipe_urls_from_html(html: str) -> list:
        """Extract recipe URLs from HTML content."""
        soup = BeautifulSoup(html, 'html.parser')
        found = []

        for link in soup.find_all('a', href=True):
            href = link['href']

            # Build full URL
            if href.startswith('http'):
                full_url = href
            elif href.startswith('/'):
                full_url = f"{base_url}{href}"
            else:
                continue

            # Only keep URLs from this source
            if full_url.startswith(base_url):
                found.append(full_url)

        return found

    def extract_urls_from_json_ld(html: str) -> list:
        """Extract recipe URLs from JSON-LD structured data."""
        soup = BeautifulSoup(html, 'html.parser')
        found = []

        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string)
                if isinstance(data, list):
                    for item in data:
                        if item.get('@type') == 'Recipe' and item.get('url'):
                            found.append(item['url'])
                elif isinstance(data, dict):
                    if data.get('@type') == 'Recipe' and data.get('url'):
                        found.append(data['url'])
            except:
                continue

        return found

    # Strategy 1: Crawl category pages with pagination
    print(f"  Crawling {len(category_pages)} category pages...")

    for i, cat_path in enumerate(category_pages):
        if len(urls) >= limit:
            break

        cat_url = f"{base_url}{cat_path}"

        # Try multiple pages for each category
        for page_num in range(1, 20):  # Try up to 20 pages per category
            if len(urls) >= limit:
                break

            # Common pagination patterns
            if page_num == 1:
                page_url = cat_url
            else:
                # Try different pagination schemes
                page_url = f"{cat_url}?page={page_num}"

            try:
                response = requests.get(page_url, timeout=15, headers=HEADERS)
                if response.status_code != 200:
                    break

                # Extract URLs from page
                found_urls = extract_recipe_urls_from_html(response.text)

                # Also try JSON-LD if supported
                if config.get('has_json_ld'):
                    found_urls.extend(extract_urls_from_json_ld(response.text))

                added = 0
                for url in found_urls:
                    if add_url(url):
                        added += 1

                if added > 0:
                    cat_name = cat_path.strip('/').split('/')[-1] or 'home'
                    print(f"    [{i+1}/{len(category_pages)}] {cat_name} p{page_num}: +{added} (total: {len(urls)})")
                elif page_num > 1:
                    # No new recipes on this page, move to next category
                    break

            except Exception as e:
                if page_num == 1:
                    print(f"    Error crawling {cat_path}: {e}")
                break

    # Strategy 2: Try sitemap
    if len(urls) < limit:
        print(f"  Trying sitemap...")
        try:
            sitemap_url = f"{base_url}/sitemap.xml"
            response = requests.get(sitemap_url, timeout=30, headers=HEADERS)

            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'xml')

                for loc in soup.find_all('loc'):
                    url = loc.text

                    # Direct recipe URL
                    if add_url(url):
                        if len(urls) >= limit:
                            break
                        continue

                    # Check nested sitemaps
                    if url.endswith('.xml'):
                        try:
                            child_resp = requests.get(url, timeout=30, headers=HEADERS)
                            if child_resp.status_code == 200:
                                child_soup = BeautifulSoup(child_resp.text, 'xml')
                                for child_loc in child_soup.find_all('loc'):
                                    if add_url(child_loc.text):
                                        if len(urls) >= limit:
                                            break
                        except:
                            pass

                    if len(urls) >= limit:
                        break

        except Exception as e:
            print(f"    Sitemap error: {e}")

    # Strategy 3: Crawl related recipes from found pages
    if len(urls) < limit and len(urls) > 0:
        print(f"  Looking for related recipes...")
        sample_urls = list(urls)[:30]

        for sample_url in sample_urls:
            if len(urls) >= limit:
                break
            try:
                response = requests.get(sample_url, timeout=15, headers=HEADERS)
                if response.status_code == 200:
                    found = extract_recipe_urls_from_html(response.text)
                    added = sum(1 for url in found if add_url(url))
                    if added > 0:
                        print(f"    +{added} related recipes (total: {len(urls)})")
            except:
                pass

    print(f"  Found {len(urls)} new recipe URLs to scrape")
    return urls[:limit]


# Keep old function name for backwards compatibility
def get_recipe_urls_from_sitemap(source: str, limit: int = 100) -> list:
    """Backwards compatible wrapper for get_recipe_urls."""
    return get_recipe_urls(source, limit)


def main():
    parser = argparse.ArgumentParser(description='Scrape recipes for Meal Planner')

    # Allow 'all' as a source option
    source_choices = list(SOURCES.keys()) + ['all']
    parser.add_argument('--source', choices=source_choices, default='arla',
                        help='Recipe source to scrape (use "all" for all sources)')
    parser.add_argument('--url', type=str, help='Scrape a specific URL')
    parser.add_argument('--limit', type=int, default=10, help='Max recipes to scrape (per source if using --source all)')
    parser.add_argument('--meal-type', type=str, default=None,
                        choices=['main', 'dessert', 'breakfast', 'snack', 'drink', 'baking'],
                        help='Only save recipes of this meal type (default: all)')

    args = parser.parse_args()

    print(f"\n🍽️  Meal Planner Recipe Scraper")
    print(f"   Source: {args.source}")
    print(f"   Limit: {args.limit}" + (" per source" if args.source == 'all' else ""))
    if args.meal_type:
        print(f"   Filter: {args.meal_type} only")
    print()

    if args.url:
        # Scrape single URL - detect source from URL
        detected_source = None
        for src, cfg in SOURCES.items():
            if cfg['base_url'] in args.url:
                detected_source = src
                break
        source = detected_source or args.source

        print(f"Scraping: {args.url} (source: {source})")
        recipe = scrape_recipe(args.url, source)
        if recipe:
            # Check meal type filter
            if args.meal_type:
                recipe_meal_type = recipe.get('features', {}).get('meal_type', 'main')
                if recipe_meal_type != args.meal_type:
                    print(f"  Skipped: {recipe['name']} (meal_type={recipe_meal_type}, wanted {args.meal_type})")
                else:
                    save_recipe(recipe)
            else:
                save_recipe(recipe)
    else:
        # Determine which sources to scrape
        sources_to_scrape = list(SOURCES.keys()) if args.source == 'all' else [args.source]

        total_success = 0
        total_skipped = 0

        for source in sources_to_scrape:
            if args.source == 'all':
                print(f"\n{'='*60}")
                print(f"  Scraping from {source.upper()}")
                print(f"{'='*60}\n")

            # Get URLs for this source
            urls = get_recipe_urls(source, args.limit * 3 if args.meal_type else args.limit)
            print(f"Found {len(urls)} URLs to scrape\n")

            success = 0
            skipped = 0
            for i, url in enumerate(urls, 1):
                # Stop if we have enough recipes of the desired type
                if args.meal_type and success >= args.limit:
                    break

                print(f"[{i}/{len(urls)}] {url}")
                recipe = scrape_recipe(url, source)

                if recipe:
                    # Check meal type filter
                    if args.meal_type:
                        recipe_meal_type = recipe.get('features', {}).get('meal_type', 'main')
                        if recipe_meal_type != args.meal_type:
                            print(f"  ⏭️  Skipped: meal_type={recipe_meal_type} (wanted {args.meal_type})")
                            skipped += 1
                            continue

                    if save_recipe(recipe):
                        success += 1

            print(f"\n✅ {source.upper()}: Saved {success} recipes")
            if args.meal_type:
                print(f"   Skipped {skipped} recipes (wrong meal type)")

            total_success += success
            total_skipped += skipped

        if args.source == 'all':
            print(f"\n{'='*60}")
            print(f"  TOTAL: Saved {total_success} recipes from {len(sources_to_scrape)} sources")
            if args.meal_type:
                print(f"  Skipped {total_skipped} recipes (wrong meal type)")
            print(f"{'='*60}")


if __name__ == '__main__':
    main()
