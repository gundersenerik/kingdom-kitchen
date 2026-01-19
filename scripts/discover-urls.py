#!/usr/bin/env python3
"""
Recipe URL Discovery Script

Discovers recipe URLs from Swedish recipe sites without needing database access.
Outputs URLs that can then be fed to the main scraper.

Usage:
    python scripts/discover-urls.py --source arla --limit 500 > urls.txt

Then scrape with:
    cat urls.txt | while read url; do python scripts/scraper.py --url "$url"; done

Requirements:
    pip install requests beautifulsoup4 lxml
"""

import argparse
import re
import sys
from urllib.parse import urljoin

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Missing dependencies. Install with:")
    print("  pip install requests beautifulsoup4 lxml")
    sys.exit(1)

# Request headers to mimic a browser
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
}


def discover_arla_urls(limit: int = 100) -> list:
    """Discover recipe URLs from Arla."""
    urls = []
    seen = set()

    # URLs to skip (not actual recipes)
    skip_patterns = ['/samling/', '/arla-mat-app/', '/matkanalen/', '/inspiration/',
                     '/arla-mat/', '/kategori/', '/om-recept/', '/tips/']

    def is_recipe_url(url: str) -> bool:
        """Check if URL looks like a recipe page."""
        if not url.startswith('https://www.arla.se/recept/'):
            return False
        if url == 'https://www.arla.se/recept/':
            return False
        if any(skip in url for skip in skip_patterns):
            return False
        # Must have a recipe slug after /recept/
        parts = url.replace('https://www.arla.se/recept/', '').strip('/').split('/')
        return len(parts) >= 1 and len(parts[0]) > 0

    def add_url(url: str) -> bool:
        """Add URL if valid and not seen."""
        # Normalize URL
        url = url.split('?')[0].split('#')[0]
        if not url.endswith('/'):
            url += '/'

        if url in seen:
            return False
        if not is_recipe_url(url):
            return False

        seen.add(url)
        urls.append(url)
        return True

    def extract_recipe_urls_from_html(html: str, base_url: str = 'https://www.arla.se') -> list:
        """Extract recipe URLs from HTML content."""
        soup = BeautifulSoup(html, 'html.parser')
        found = []

        for link in soup.find_all('a', href=True):
            href = link['href']
            if '/recept/' in href:
                full_url = href if href.startswith('http') else urljoin(base_url, href)
                found.append(full_url)

        return found

    def extract_urls_from_json(data, found_urls: list):
        """Recursively extract URLs from JSON data."""
        if isinstance(data, dict):
            for key, value in data.items():
                if key in ('url', 'link', 'path', 'href') and isinstance(value, str):
                    if '/recept/' in value:
                        if not value.startswith('http'):
                            value = f"https://www.arla.se{value}"
                        found_urls.append(value)
                else:
                    extract_urls_from_json(value, found_urls)
        elif isinstance(data, list):
            for item in data:
                extract_urls_from_json(item, found_urls)

    print("🔍 Discovering Arla recipe URLs...", file=sys.stderr)

    # Strategy 1: Try various API endpoints
    api_endpoints = [
        'https://www.arla.se/api/search/recipes',
        'https://www.arla.se/api/recipes',
        'https://www.arla.se/api/recipe/search',
        'https://www.arla.se/api/v1/recipes',
        'https://www.arla.se/recipes/api',
    ]

    for api_url in api_endpoints:
        if len(urls) >= limit:
            break

        print(f"  Trying API: {api_url}...", file=sys.stderr)

        for page in range(20):  # Try pagination
            if len(urls) >= limit:
                break

            try:
                params = {'size': 100, 'from': page * 100, 'page': page, 'limit': 100, 'offset': page * 100}
                response = requests.get(api_url, params=params, timeout=15, headers=HEADERS)

                if response.status_code == 200:
                    try:
                        data = response.json()
                        found = []
                        extract_urls_from_json(data, found)

                        added = 0
                        for url in found:
                            if add_url(url):
                                added += 1

                        if added > 0:
                            print(f"    Page {page}: +{added} URLs (total: {len(urls)})", file=sys.stderr)
                        elif page > 0:
                            break  # No more results
                    except:
                        break
                else:
                    break
            except Exception as e:
                break

    # Strategy 2: Crawl category pages
    category_pages = [
        'https://www.arla.se/recept/',
        'https://www.arla.se/recept/samling/alla/',
        'https://www.arla.se/recept/samling/vardag/',
        'https://www.arla.se/recept/samling/middag/',
        'https://www.arla.se/recept/samling/lunch/',
        'https://www.arla.se/recept/samling/snabb-middag/',
        'https://www.arla.se/recept/samling/billig/',
        'https://www.arla.se/recept/samling/kyckling/',
        'https://www.arla.se/recept/samling/pasta/',
        'https://www.arla.se/recept/samling/fisk/',
        'https://www.arla.se/recept/samling/vegetariskt/',
        'https://www.arla.se/recept/samling/soppa/',
        'https://www.arla.se/recept/samling/gratang/',
        'https://www.arla.se/recept/samling/sallad/',
        'https://www.arla.se/recept/samling/gryta/',
        'https://www.arla.se/recept/samling/korv/',
        'https://www.arla.se/recept/samling/kottfars/',
        'https://www.arla.se/recept/samling/lax/',
        'https://www.arla.se/recept/samling/potatis/',
        'https://www.arla.se/recept/samling/ris/',
        'https://www.arla.se/recept/samling/wok/',
        'https://www.arla.se/recept/samling/pizza/',
        'https://www.arla.se/recept/samling/tacos/',
        'https://www.arla.se/recept/samling/thai/',
        'https://www.arla.se/recept/samling/indiskt/',
        'https://www.arla.se/recept/samling/italienskt/',
        'https://www.arla.se/recept/samling/mexikanskt/',
        'https://www.arla.se/recept/samling/asiatiskt/',
        'https://www.arla.se/recept/samling/barnvanligt/',
        'https://www.arla.se/recept/samling/flaskkott/',
        'https://www.arla.se/recept/samling/notkott/',
        'https://www.arla.se/recept/samling/lamm/',
        'https://www.arla.se/recept/samling/skaldjur/',
        'https://www.arla.se/recept/samling/veganskt/',
        'https://www.arla.se/recept/samling/glutenfritt/',
        'https://www.arla.se/recept/samling/laktosfritt/',
        'https://www.arla.se/recept/samling/helg/',
        'https://www.arla.se/recept/samling/fest/',
        'https://www.arla.se/recept/samling/grillat/',
        'https://www.arla.se/recept/samling/picknick/',
        'https://www.arla.se/recept/samling/ugnsratter/',
    ]

    print(f"  Crawling {len(category_pages)} category pages...", file=sys.stderr)

    for i, page_url in enumerate(category_pages):
        if len(urls) >= limit:
            break

        try:
            response = requests.get(page_url, timeout=15, headers=HEADERS)
            if response.status_code == 200:
                found = extract_recipe_urls_from_html(response.text)
                added = 0
                for url in found:
                    if add_url(url):
                        added += 1

                if added > 0:
                    cat_name = page_url.rstrip('/').split('/')[-1] or 'home'
                    print(f"    [{i+1}/{len(category_pages)}] {cat_name}: +{added} (total: {len(urls)})", file=sys.stderr)
        except Exception as e:
            pass

    # Strategy 3: Check sitemap
    if len(urls) < limit:
        print("  Checking sitemap...", file=sys.stderr)
        try:
            # Main sitemap
            response = requests.get('https://www.arla.se/sitemap.xml', timeout=30, headers=HEADERS)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'xml')

                for loc in soup.find_all('loc'):
                    url = loc.text

                    # Direct recipe URLs
                    if add_url(url):
                        pass

                    # Check nested sitemaps
                    if 'sitemap' in url.lower() or url.endswith('.xml'):
                        try:
                            child_response = requests.get(url, timeout=30, headers=HEADERS)
                            if child_response.status_code == 200:
                                child_soup = BeautifulSoup(child_response.text, 'xml')
                                for child_loc in child_soup.find_all('loc'):
                                    child_url = child_loc.text
                                    if add_url(child_url):
                                        if len(urls) >= limit:
                                            break
                        except:
                            pass

                    if len(urls) >= limit:
                        break
        except Exception as e:
            print(f"  Sitemap error: {e}", file=sys.stderr)

    # Strategy 4: Crawl related recipes from found pages
    if len(urls) < limit:
        print("  Looking for related recipes on found pages...", file=sys.stderr)
        sample_urls = list(urls)[:30]

        for sample_url in sample_urls:
            if len(urls) >= limit:
                break
            try:
                response = requests.get(sample_url, timeout=15, headers=HEADERS)
                if response.status_code == 200:
                    found = extract_recipe_urls_from_html(response.text)
                    added = 0
                    for url in found:
                        if add_url(url):
                            added += 1
                    if added > 0:
                        print(f"    +{added} related recipes (total: {len(urls)})", file=sys.stderr)
            except:
                pass

    print(f"✅ Found {len(urls)} unique recipe URLs", file=sys.stderr)
    return urls[:limit]


def main():
    parser = argparse.ArgumentParser(description='Discover recipe URLs')
    parser.add_argument('--source', choices=['arla'], default='arla', help='Recipe source')
    parser.add_argument('--limit', type=int, default=100, help='Max URLs to discover')

    args = parser.parse_args()

    if args.source == 'arla':
        urls = discover_arla_urls(args.limit)
    else:
        urls = []

    # Output URLs (one per line)
    for url in urls:
        print(url)


if __name__ == '__main__':
    main()
