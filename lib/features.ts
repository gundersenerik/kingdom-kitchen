/**
 * Feature extraction for the recommendation engine.
 * 
 * Extracts structured features from recipe data that can be used
 * for weighted preference matching.
 */

import { Ingredient, RecipeFeatures } from './types';

// Swedish ingredient mappings
const PROTEIN_KEYWORDS: { [key: string]: string } = {
  // Swedish
  'nötfärs': 'beef',
  'köttfärs': 'beef',
  'fläskfärs': 'pork',
  'blandfärs': 'mixed_meat',
  'kyckling': 'chicken',
  'kycklingfilé': 'chicken',
  'lax': 'salmon',
  'torsk': 'cod',
  'räkor': 'shrimp',
  'fisk': 'fish',
  'bacon': 'pork',
  'skinka': 'ham',
  'korv': 'sausage',
  'ägg': 'egg',
  'tofu': 'tofu',
  'linser': 'lentils',
  'bönor': 'beans',
  'kikärtor': 'chickpeas',
  'fläsk': 'pork',
  'lamm': 'lamb',
  // English
  'beef': 'beef',
  'chicken': 'chicken',
  'pork': 'pork',
  'salmon': 'salmon',
  'fish': 'fish',
  'shrimp': 'shrimp',
  'egg': 'egg',
  'eggs': 'egg',
};

const CARB_KEYWORDS: { [key: string]: string } = {
  'pasta': 'pasta',
  'spaghetti': 'pasta',
  'penne': 'pasta',
  'tagliatelle': 'pasta',
  'ris': 'rice',
  'rice': 'rice',
  'potatis': 'potato',
  'potato': 'potato',
  'bröd': 'bread',
  'bread': 'bread',
  'couscous': 'couscous',
  'nudlar': 'noodles',
  'noodles': 'noodles',
  'bulgur': 'bulgur',
  'quinoa': 'quinoa',
};

const CUISINE_KEYWORDS: { [key: string]: string } = {
  // Ingredients that signal cuisine
  'sojasås': 'asian',
  'soy sauce': 'asian',
  'ingefära': 'asian',
  'ginger': 'asian',
  'wasabi': 'japanese',
  'miso': 'japanese',
  'curry': 'indian',
  'garam masala': 'indian',
  'tikka': 'indian',
  'tandoori': 'indian',
  'taco': 'mexican',
  'salsa': 'mexican',
  'tortilla': 'mexican',
  'parmesan': 'italian',
  'mozzarella': 'italian',
  'basilika': 'italian',
  'pesto': 'italian',
  'feta': 'greek',
  'tzatziki': 'greek',
  'hummus': 'middle_eastern',
  'tahini': 'middle_eastern',
  'harissa': 'middle_eastern',
  'lingon': 'swedish',
  'dill': 'swedish',
  'grädde': 'swedish',
  'cream': 'swedish',
};

const SPICE_INDICATORS: { [key: string]: 'mild' | 'medium' | 'hot' } = {
  'chili': 'hot',
  'jalapeño': 'hot',
  'habanero': 'hot',
  'sriracha': 'hot',
  'cayenne': 'hot',
  'sambal': 'hot',
  'curry': 'medium',
  'paprika': 'mild',
  'peppar': 'mild',
  'pepper': 'mild',
};

/**
 * Extract features from a recipe for the recommendation engine
 */
export function extractFeatures(
  ingredients: Ingredient[],
  recipeName: string,
  prepTime?: number,
  cookTime?: number
): RecipeFeatures {
  const features: RecipeFeatures = {};
  
  // Combine all text for analysis
  const allText = [
    recipeName.toLowerCase(),
    ...ingredients.map(i => i.ingredient.toLowerCase()),
  ].join(' ');
  
  // Extract proteins
  const proteins = new Set<string>();
  for (const [keyword, protein] of Object.entries(PROTEIN_KEYWORDS)) {
    if (allText.includes(keyword.toLowerCase())) {
      proteins.add(protein);
    }
  }
  if (proteins.size > 0) {
    features.protein = Array.from(proteins);
  }
  
  // Extract carbs
  for (const [keyword, carb] of Object.entries(CARB_KEYWORDS)) {
    if (allText.includes(keyword.toLowerCase())) {
      features.carb = carb;
      break;
    }
  }
  
  // Detect cuisine
  const cuisineCounts: { [cuisine: string]: number } = {};
  for (const [keyword, cuisine] of Object.entries(CUISINE_KEYWORDS)) {
    if (allText.includes(keyword.toLowerCase())) {
      cuisineCounts[cuisine] = (cuisineCounts[cuisine] || 0) + 1;
    }
  }
  // Pick the most frequent cuisine signal
  const topCuisine = Object.entries(cuisineCounts)
    .sort((a, b) => b[1] - a[1])[0];
  if (topCuisine) {
    features.cuisine = topCuisine[0];
  }
  
  // Detect spice level
  let spiceLevel: 'mild' | 'medium' | 'hot' = 'mild';
  for (const [keyword, level] of Object.entries(SPICE_INDICATORS)) {
    if (allText.includes(keyword.toLowerCase())) {
      if (level === 'hot') {
        spiceLevel = 'hot';
        break;
      } else if (level === 'medium') {
        spiceLevel = 'medium';
      }
    }
  }
  features.spice_level = spiceLevel;
  
  // Prep time bucket
  const totalTime = (prepTime || 0) + (cookTime || 0);
  if (totalTime > 0) {
    if (totalTime <= 30) {
      features.prep_time_bucket = 'quick';
    } else if (totalTime <= 60) {
      features.prep_time_bucket = 'medium';
    } else {
      features.prep_time_bucket = 'long';
    }
  }
  
  // Extract key ingredients (normalized)
  const keyIngredients = ingredients
    .map(i => normalizeIngredient(i.ingredient))
    .filter(i => i.length > 2)
    .slice(0, 10); // Top 10 ingredients
  
  if (keyIngredients.length > 0) {
    features.ingredients = keyIngredients;
  }
  
  return features;
}

/**
 * Normalize an ingredient name for matching
 */
function normalizeIngredient(ingredient: string): string {
  return ingredient
    .toLowerCase()
    .trim()
    // Remove common quantity/descriptor words
    .replace(/^(färsk|hackad|strimlad|skivad|riven|kokt|stekt|tärnad)\s+/, '')
    .replace(/\s+(färsk|hackad|strimlad|skivad|riven|kokt|stekt|tärnad)$/, '')
    // Remove parenthetical notes
    .replace(/\s*\([^)]*\)\s*/g, '')
    .trim();
}

/**
 * Get a human-readable explanation for why a recipe was suggested
 */
export function explainSuggestion(
  recipeFeatures: RecipeFeatures,
  userWeights: { feature_type: string; feature_value: string; weight: number }[]
): string {
  const positives: string[] = [];
  
  // Find matching positive weights
  for (const w of userWeights) {
    if (w.weight <= 0.3) continue;
    
    const featureValue = recipeFeatures[w.feature_type as keyof RecipeFeatures];
    if (!featureValue) continue;
    
    if (Array.isArray(featureValue)) {
      if (featureValue.includes(w.feature_value)) {
        positives.push(formatFeature(w.feature_type, w.feature_value));
      }
    } else if (featureValue === w.feature_value) {
      positives.push(formatFeature(w.feature_type, w.feature_value));
    }
  }
  
  if (positives.length === 0) {
    return 'Matches general preferences';
  }
  
  return `You like ${positives.slice(0, 3).join(', ')}`;
}

function formatFeature(type: string, value: string): string {
  switch (type) {
    case 'cuisine':
      return `${value} food`;
    case 'protein':
      return value;
    case 'carb':
      return value;
    case 'prep_time_bucket':
      return `${value} meals`;
    case 'ingredient':
      return value;
    case 'spice_level':
      return `${value} spice`;
    default:
      return value;
  }
}
