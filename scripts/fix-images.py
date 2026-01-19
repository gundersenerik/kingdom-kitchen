#!/usr/bin/env python3
"""
Image URL Fixer for Meal Planner

This script:
1. Checks all recipe image URLs in the database
2. Identifies broken images (404s, timeouts, etc.)
3. Re-fetches image URLs from the source pages
4. Updates the database with working image URLs

Usage:
    python scripts/fix-images.py --check          # Only check, don't fix
    python scripts/fix-images.py --fix            # Check and fix broken images
    python scripts/fix-images.py --fix --limit 50 # Fix up to 50 broken images

Requirements:
    pip install requests beautifulsoup4 supabase python-dotenv
"""

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, Tuple
from urllib.parse import urljoin
from dotenv import load_dotenv

try:
    import requests
    from bs4 import BeautifulSoup
    from supabase import create_client, Client
except ImportError:
    print("Missing dependencies. Install with:")
    print("  pip install requests beautifulsoup4 supabase python-dotenv")
    sys.exit(1)

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing Supabase credentials in environment")
    print("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Request headers to mimic a browser
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
}


def check_image_url(url: str, timeout: int = 10) -> Tuple[bool, int]:
    """
    Check if an image URL is accessible.
    Returns (is_valid, status_code)
    """
    if not url:
        return False, 0

    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True, headers=HEADERS)
        return response.status_code == 200, response.status_code
    except requests.Timeout:
        return False, -1  # Timeout
    except requests.RequestException as e:
        return False, -2  # Other error


def extract_image_from_page(url: str) -> Optional[str]:
    """
    Extract the best image URL from a recipe page.
    Tries multiple methods in order of reliability.
    """
    try:
        response = requests.get(url, timeout=15, headers=HEADERS)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        # Method 1: Look for JSON-LD schema (most reliable)
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string)
                # Handle array of schemas
                if isinstance(data, list):
                    for item in data:
                        if item.get('@type') == 'Recipe' and item.get('image'):
                            img = item['image']
                            if isinstance(img, list):
                                return img[0] if img else None
                            elif isinstance(img, dict):
                                return img.get('url')
                            return img
                # Handle single schema
                elif data.get('@type') == 'Recipe' and data.get('image'):
                    img = data['image']
                    if isinstance(img, list):
                        return img[0] if img else None
                    elif isinstance(img, dict):
                        return img.get('url')
                    return img
            except json.JSONDecodeError:
                continue

        # Method 2: Check for notificationPreview (Arla specific)
        page_text = response.text
        preview_match = re.search(r'notificationPreview\s*=\s*(\{[^;]+\})', page_text)
        if preview_match:
            try:
                preview_data = json.loads(preview_match.group(1))
                if preview_data.get('picture', {}).get('url'):
                    return preview_data['picture']['url']
            except json.JSONDecodeError:
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
                    return urljoin(url, src)

        # Method 6: Find the largest image (likely the recipe image)
        all_imgs = soup.find_all('img')
        candidates = []
        for img in all_imgs:
            src = img.get('src') or img.get('data-src')
            if not src or src.startswith('data:'):
                continue
            # Skip common non-recipe images
            if any(x in src.lower() for x in ['logo', 'icon', 'avatar', 'profile', 'ad-', 'banner']):
                continue
            # Prefer images with recipe-related attributes
            alt = (img.get('alt') or '').lower()
            classes = ' '.join(img.get('class', []))
            if 'recipe' in classes.lower() or 'recipe' in alt or 'mat' in alt:
                candidates.insert(0, urljoin(url, src))
            else:
                candidates.append(urljoin(url, src))

        if candidates:
            return candidates[0]

        return None

    except Exception as e:
        print(f"    Error extracting image from {url}: {e}")
        return None


def check_recipe_image(recipe: dict) -> dict:
    """
    Check a single recipe's image URL.
    Returns recipe with status info.
    """
    recipe_id = recipe['id']
    name = recipe['name']
    image_url = recipe.get('image_url')
    source_url = recipe.get('url')

    result = {
        'id': recipe_id,
        'name': name,
        'url': source_url,
        'old_image_url': image_url,
        'new_image_url': None,
        'status': 'unknown',
    }

    if not image_url:
        result['status'] = 'missing'
    else:
        is_valid, status_code = check_image_url(image_url)
        if is_valid:
            result['status'] = 'ok'
        else:
            result['status'] = 'broken'
            result['error_code'] = status_code

    return result


def fix_recipe_image(recipe: dict) -> Optional[str]:
    """
    Try to fix a broken recipe image by re-fetching from source.
    Returns new image URL if found, None otherwise.
    """
    source_url = recipe.get('url')
    if not source_url:
        return None

    print(f"    Fetching new image from {source_url}...")
    new_image = extract_image_from_page(source_url)

    if new_image:
        # Verify the new image works
        is_valid, _ = check_image_url(new_image)
        if is_valid:
            return new_image
        else:
            print(f"    New image URL also broken: {new_image[:60]}...")

    return None


def update_recipe_image(recipe_id: str, new_image_url: str) -> bool:
    """Update the recipe's image URL in the database."""
    try:
        result = supabase.table('recipes').update({
            'image_url': new_image_url
        }).eq('id', recipe_id).execute()
        return bool(result.data)
    except Exception as e:
        print(f"    Database error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Fix broken recipe images')
    parser.add_argument('--check', action='store_true', help='Only check images, do not fix')
    parser.add_argument('--fix', action='store_true', help='Check and fix broken images')
    parser.add_argument('--limit', type=int, default=0, help='Limit number of recipes to process (0 = all)')
    parser.add_argument('--workers', type=int, default=5, help='Number of parallel workers')

    args = parser.parse_args()

    if not args.check and not args.fix:
        print("Please specify --check or --fix")
        parser.print_help()
        sys.exit(1)

    print("\n🖼️  Recipe Image Checker/Fixer")
    print("=" * 50)

    # Fetch all recipes
    print("\nFetching recipes from database...")
    query = supabase.table('recipes').select('id, name, url, image_url, source')
    if args.limit > 0:
        query = query.limit(args.limit)

    result = query.execute()
    recipes = result.data
    print(f"Found {len(recipes)} recipes to check\n")

    # Check images in parallel
    print("Checking image URLs...")
    results = {
        'ok': [],
        'broken': [],
        'missing': [],
    }

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(check_recipe_image, r): r for r in recipes}

        for i, future in enumerate(as_completed(futures)):
            check_result = future.result()
            results[check_result['status']].append(check_result)

            if (i + 1) % 20 == 0:
                print(f"  Checked {i + 1}/{len(recipes)}...")

    # Print summary
    print("\n" + "=" * 50)
    print("RESULTS SUMMARY")
    print("=" * 50)
    print(f"✅ Working images: {len(results['ok'])}")
    print(f"❌ Broken images:  {len(results['broken'])}")
    print(f"⚠️  Missing URLs:   {len(results['missing'])}")

    if results['broken']:
        print("\n" + "-" * 50)
        print("BROKEN IMAGES:")
        print("-" * 50)
        # Group by domain
        domains = {}
        for r in results['broken']:
            if r['old_image_url']:
                try:
                    domain = r['old_image_url'].split('/')[2]
                except:
                    domain = 'unknown'
            else:
                domain = 'no-url'
            domains[domain] = domains.get(domain, 0) + 1

        print("\nBy domain:")
        for domain, count in sorted(domains.items(), key=lambda x: -x[1]):
            print(f"  {domain}: {count}")

        print("\nFirst 10 broken recipes:")
        for r in results['broken'][:10]:
            print(f"  - {r['name'][:40]} (error: {r.get('error_code', 'unknown')})")

    # Fix broken images if requested
    if args.fix and (results['broken'] or results['missing']):
        print("\n" + "=" * 50)
        print("FIXING BROKEN/MISSING IMAGES")
        print("=" * 50)

        to_fix = results['broken'] + results['missing']
        fixed_count = 0
        failed_count = 0

        for i, recipe in enumerate(to_fix):
            print(f"\n[{i + 1}/{len(to_fix)}] {recipe['name'][:50]}")

            new_image = fix_recipe_image(recipe)

            if new_image:
                if update_recipe_image(recipe['id'], new_image):
                    print(f"    ✅ Fixed: {new_image[:60]}...")
                    fixed_count += 1
                else:
                    print(f"    ❌ Failed to update database")
                    failed_count += 1
            else:
                print(f"    ❌ Could not find new image")
                failed_count += 1

            # Rate limiting
            time.sleep(0.5)

        print("\n" + "=" * 50)
        print("FIX RESULTS")
        print("=" * 50)
        print(f"✅ Successfully fixed: {fixed_count}")
        print(f"❌ Failed to fix:      {failed_count}")

    print("\nDone!")


if __name__ == '__main__':
    main()
