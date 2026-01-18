// Type definitions for Meal Planner

export type RatingValue = 'loved' | 'liked' | 'neutral' | 'disliked' | 'hated';

export type FeatureType = 
  | 'cuisine'
  | 'protein'
  | 'carb'
  | 'cooking_method'
  | 'prep_time_bucket'
  | 'ingredient'
  | 'spice_level'
  | 'meal_type';

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  household_id: string;
  display_name: string;
  avatar_url?: string;
  is_child: boolean;
  created_at: string;
}

export interface Ingredient {
  amount: string;
  ingredient: string;
  unit?: string;
}

export interface RecipeFeatures {
  cuisine?: string;
  protein?: string[];
  carb?: string;
  cooking_method?: string;
  prep_time_bucket?: 'quick' | 'medium' | 'long';
  ingredients?: string[];
  spice_level?: 'mild' | 'medium' | 'hot';
  meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export interface Recipe {
  id: string;
  external_id?: string;
  source: string;
  name: string;
  url: string;
  image_url?: string;
  description?: string;
  ingredients: Ingredient[];
  instructions: string[];
  features: RecipeFeatures;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  total_time_minutes?: number;
  servings?: string;
  external_rating?: number;
  external_rating_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Rating {
  id: string;
  profile_id: string;
  recipe_id: string;
  rating: RatingValue;
  excluded_ingredients: string[];
  notes?: string;
  suitable_for: string[];
  created_at: string;
  updated_at: string;
}

export interface PreferenceWeight {
  id: string;
  profile_id: string;
  feature_type: FeatureType;
  feature_value: string;
  weight: number;
  sample_count: number;
  updated_at: string;
}

export interface MealPlan {
  id: string;
  household_id: string;
  week_start: string;
  meals: {
    [day: string]: {
      lunch?: string;
      dinner?: string;
    };
  };
  created_at: string;
  updated_at: string;
}

// API Request/Response types

export interface RateRecipeRequest {
  recipe_id: string;
  rating: RatingValue;
  excluded_ingredients?: string[];
  notes?: string;
}

export interface RateRecipeResponse {
  success: boolean;
  updated_weights: number;
}

export interface NextRecipeResponse {
  recipe: Recipe | null;
}

export interface RecipeSuggestion {
  recipe: Recipe;
  family_score: number;
  individual_scores: { [profile_name: string]: number };
  why?: string;
}

export interface SuggestionsResponse {
  suggestions: RecipeSuggestion[];
}

export interface PreferencesResponse {
  preferences: {
    feature: string;
    weight: number;
    sample_count: number;
  }[];
}

// Utility types for the recommendation engine

export interface ScoredRecipe {
  recipe_id: string;
  score: number;
}

export interface FamilyScoredRecipe {
  recipe_id: string;
  recipe_name: string;
  image_url?: string;
  min_score: number;
  scores: { [profile_name: string]: number };
}
