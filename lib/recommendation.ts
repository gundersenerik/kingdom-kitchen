/**
 * Recommendation Engine
 * 
 * Handles scoring recipes for users and families based on learned preference weights.
 */

import { createServerClient } from './supabase';
import { Recipe, RecipeFeatures, PreferenceWeight, FamilyScoredRecipe } from './types';

/**
 * Calculate a recipe's score for a specific user
 */
export function calculateScore(
  recipeFeatures: RecipeFeatures,
  userWeights: PreferenceWeight[]
): number {
  let totalScore = 0;
  
  // Create a lookup map for quick weight access
  const weightMap = new Map<string, number>();
  for (const w of userWeights) {
    const key = `${w.feature_type}:${w.feature_value}`;
    weightMap.set(key, w.weight);
  }
  
  // Score each feature
  for (const [featureType, featureValue] of Object.entries(recipeFeatures)) {
    if (featureValue === undefined || featureValue === null) continue;
    
    if (Array.isArray(featureValue)) {
      // Array features (proteins, ingredients)
      for (const val of featureValue) {
        const key = `${featureType}:${val}`;
        const weight = weightMap.get(key);
        if (weight !== undefined) {
          totalScore += weight;
        }
      }
    } else {
      // Scalar features (cuisine, carb, spice_level)
      const key = `${featureType}:${featureValue}`;
      const weight = weightMap.get(key);
      if (weight !== undefined) {
        totalScore += weight;
      }
    }
  }
  
  return totalScore;
}

/**
 * Get recipe suggestions for a single user
 */
export async function getSuggestionsForUser(
  profileId: string,
  authHeader: string,
  limit: number = 10
): Promise<{ recipe: Recipe; score: number }[]> {
  const supabase = createServerClient(authHeader);
  
  // Get user's preference weights
  const { data: weights, error: weightsError } = await supabase
    .from('preference_weights')
    .select('*')
    .eq('profile_id', profileId);
  
  if (weightsError) throw weightsError;
  
  // Get unrated recipes
  const { data: recipes, error: recipesError } = await supabase
    .from('recipes')
    .select('*')
    .not('id', 'in', `(
      SELECT recipe_id FROM ratings WHERE profile_id = '${profileId}'
    )`)
    .limit(100); // Get a pool to score
  
  if (recipesError) throw recipesError;
  
  // Score and sort
  const scored = recipes
    .map(recipe => ({
      recipe,
      score: calculateScore(recipe.features as RecipeFeatures, weights || []),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  return scored;
}

/**
 * Get recipe suggestions that work for the whole family
 */
export async function getFamilySuggestions(
  householdId: string,
  authHeader: string,
  limit: number = 10
): Promise<FamilyScoredRecipe[]> {
  const supabase = createServerClient(authHeader);
  
  // Get all household profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('household_id', householdId);
  
  if (profilesError) throw profilesError;
  if (!profiles || profiles.length === 0) {
    return [];
  }
  
  // Get all preference weights for the household
  const profileIds = profiles.map(p => p.id);
  const { data: allWeights, error: weightsError } = await supabase
    .from('preference_weights')
    .select('*')
    .in('profile_id', profileIds);
  
  if (weightsError) throw weightsError;
  
  // Group weights by profile
  const weightsByProfile = new Map<string, PreferenceWeight[]>();
  for (const profile of profiles) {
    weightsByProfile.set(
      profile.id,
      (allWeights || []).filter(w => w.profile_id === profile.id)
    );
  }
  
  // Get recipes (prioritize highly-rated external ones)
  const { data: recipes, error: recipesError } = await supabase
    .from('recipes')
    .select('*')
    .order('external_rating', { ascending: false, nullsFirst: false })
    .limit(200);
  
  if (recipesError) throw recipesError;
  
  // Score each recipe for each family member
  const familyScored: FamilyScoredRecipe[] = [];
  
  for (const recipe of recipes || []) {
    const scores: { [name: string]: number } = {};
    let minScore = Infinity;
    
    for (const profile of profiles) {
      const weights = weightsByProfile.get(profile.id) || [];
      const score = calculateScore(recipe.features as RecipeFeatures, weights);
      scores[profile.display_name] = Math.round(score * 100) / 100;
      minScore = Math.min(minScore, score);
    }
    
    // Only include if everyone has a positive score (or no data yet)
    // For cold start, min score will be 0, which is acceptable
    if (minScore >= 0) {
      familyScored.push({
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        image_url: recipe.image_url,
        min_score: Math.round(minScore * 100) / 100,
        scores,
      });
    }
  }
  
  // Sort by minimum family score (the "weakest link" determines ranking)
  familyScored.sort((a, b) => b.min_score - a.min_score);
  
  return familyScored.slice(0, limit);
}

/**
 * Get the next recipe to rate for a user
 * 
 * Strategy:
 * 1. Prioritize unrated recipes
 * 2. For cold start (< 20 ratings), show high external rating recipes
 * 3. After that, show a mix to explore preferences
 */
export async function getNextRecipeToRate(
  profileId: string,
  authHeader: string
): Promise<Recipe | null> {
  const supabase = createServerClient(authHeader);
  
  // Count user's ratings
  const { count } = await supabase
    .from('ratings')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId);
  
  const ratingCount = count || 0;
  
  // Get IDs of already-rated recipes
  const { data: ratedRecipes } = await supabase
    .from('ratings')
    .select('recipe_id')
    .eq('profile_id', profileId);
  
  const ratedIds = (ratedRecipes || []).map(r => r.recipe_id);
  
  // Build query for unrated recipes
  let query = supabase
    .from('recipes')
    .select('*');
  
  if (ratedIds.length > 0) {
    query = query.not('id', 'in', `(${ratedIds.join(',')})`);
  }
  
  // Cold start: prioritize popular recipes
  if (ratingCount < 20) {
    query = query
      .order('external_rating', { ascending: false, nullsFirst: false })
      .limit(1);
  } else {
    // After initial training, add some randomness
    query = query
      .order('external_rating', { ascending: false, nullsFirst: false })
      .limit(20);
  }
  
  const { data: recipes, error } = await query;
  
  if (error) throw error;
  if (!recipes || recipes.length === 0) return null;
  
  // For established users, pick randomly from top candidates
  if (ratingCount >= 20) {
    const randomIndex = Math.floor(Math.random() * recipes.length);
    return recipes[randomIndex];
  }
  
  return recipes[0];
}

/**
 * Get the weight delta for a rating value
 */
export function getRatingDelta(rating: string): number {
  switch (rating) {
    case 'loved': return 0.15;
    case 'liked': return 0.08;
    case 'neutral': return 0.0;
    case 'disliked': return -0.08;
    case 'hated': return -0.15;
    default: return 0.0;
  }
}
