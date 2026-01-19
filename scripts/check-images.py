#!/usr/bin/env python3
"""Check image URLs in the database and report broken ones."""

import os
import sys
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing Supabase credentials")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_image(recipe):
    """Check if image URL is accessible."""
    recipe_id = recipe['id']
    name = recipe['name']
    url = recipe.get('image_url')
    
    if not url:
        return {'id': recipe_id, 'name': name, 'url': None, 'status': 'missing', 'code': None}
    
    try:
        response = requests.head(url, timeout=10, allow_redirects=True)
        if response.status_code == 200:
            return {'id': recipe_id, 'name': name, 'url': url, 'status': 'ok', 'code': 200}
        else:
            return {'id': recipe_id, 'name': name, 'url': url, 'status': 'broken', 'code': response.status_code}
    except Exception as e:
        return {'id': recipe_id, 'name': name, 'url': url, 'status': 'error', 'code': str(e)}

# Fetch all recipes
print("Fetching recipes from database...")
result = supabase.table('recipes').select('id, name, image_url, source').execute()
recipes = result.data

print(f"Found {len(recipes)} recipes. Checking images...\n")

# Check images in parallel
ok_count = 0
broken_count = 0
missing_count = 0
error_count = 0

broken_recipes = []
missing_recipes = []

with ThreadPoolExecutor(max_workers=10) as executor:
    futures = {executor.submit(check_image, r): r for r in recipes}
    
    for i, future in enumerate(as_completed(futures)):
        result = future.result()
        if result['status'] == 'ok':
            ok_count += 1
        elif result['status'] == 'broken':
            broken_count += 1
            broken_recipes.append(result)
        elif result['status'] == 'missing':
            missing_count += 1
            missing_recipes.append(result)
        else:
            error_count += 1
            broken_recipes.append(result)
        
        # Progress
        if (i + 1) % 50 == 0:
            print(f"Checked {i + 1}/{len(recipes)}...")

print(f"\n{'='*60}")
print(f"RESULTS:")
print(f"{'='*60}")
print(f"✅ Working images: {ok_count}")
print(f"❌ Broken images: {broken_count}")
print(f"⚠️  Missing URLs: {missing_count}")
print(f"🔴 Errors: {error_count}")
print(f"{'='*60}")

if broken_recipes:
    print(f"\nBroken images ({len(broken_recipes)}):")
    # Group by domain
    domains = {}
    for r in broken_recipes:
        if r['url']:
            domain = r['url'].split('/')[2] if '/' in r['url'] else 'unknown'
        else:
            domain = 'no-url'
        domains[domain] = domains.get(domain, 0) + 1
    
    print("\nBroken images by domain:")
    for domain, count in sorted(domains.items(), key=lambda x: -x[1]):
        print(f"  {domain}: {count}")
    
    print("\nFirst 10 broken:")
    for r in broken_recipes[:10]:
        print(f"  - {r['name']}: {r['code']} ({r['url'][:60] if r['url'] else 'N/A'}...)")

if missing_recipes:
    print(f"\nRecipes with no image URL ({len(missing_recipes)}):")
    for r in missing_recipes[:10]:
        print(f"  - {r['name']}")
