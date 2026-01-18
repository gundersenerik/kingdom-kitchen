/**
 * GET /api/recipes/suggest
 * 
 * Get recipe suggestions for the user or family.
 * 
 * Query params:
 * - for: 'me' | 'family' (default: 'family')
 * - limit: number (default: 10)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getSuggestionsForUser, getFamilySuggestions } from '@/lib/recommendation';
import { explainSuggestion } from '@/lib/features';
import { RecipeFeatures, SuggestionsResponse, RecipeSuggestion } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    // Get auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const supabase = createServerClient(authHeader);
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user's profile with household
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, household_id')
      .eq('user_id', user.id)
      .single();
    
    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const forParam = searchParams.get('for') || 'family';
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    
    if (forParam === 'me') {
      // Personal suggestions
      const suggestions = await getSuggestionsForUser(profile.id, authHeader, limit);
      
      // Get user's weights for explanations
      const { data: weights } = await supabase
        .from('preference_weights')
        .select('feature_type, feature_value, weight')
        .eq('profile_id', profile.id)
        .gt('weight', 0.3);
      
      const response: SuggestionsResponse = {
        suggestions: suggestions.map(s => ({
          recipe: s.recipe,
          family_score: s.score,
          individual_scores: { 'me': s.score },
          why: explainSuggestion(s.recipe.features as RecipeFeatures, weights || []),
        })),
      };
      
      return NextResponse.json(response);
      
    } else {
      // Family suggestions
      if (!profile.household_id) {
        return NextResponse.json(
          { error: 'Not part of a household' },
          { status: 400 }
        );
      }
      
      const familySuggestions = await getFamilySuggestions(
        profile.household_id,
        authHeader,
        limit
      );
      
      // Fetch full recipe data for suggestions
      const recipeIds = familySuggestions.map(s => s.recipe_id);
      const { data: recipes } = await supabase
        .from('recipes')
        .select('*')
        .in('id', recipeIds);
      
      const recipeMap = new Map(recipes?.map(r => [r.id, r]) || []);
      
      const response: SuggestionsResponse = {
        suggestions: familySuggestions
          .filter(s => recipeMap.has(s.recipe_id))
          .map(s => ({
            recipe: recipeMap.get(s.recipe_id)!,
            family_score: s.min_score,
            individual_scores: s.scores,
          })),
      };
      
      return NextResponse.json(response);
    }
    
  } catch (error) {
    console.error('Suggestions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
