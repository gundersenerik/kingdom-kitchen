/**
 * POST /api/recipes/rate
 * 
 * Rate a recipe. This triggers the automatic weight update via DB trigger.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { RateRecipeRequest, RateRecipeResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
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
    
    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Parse request body
    const body: RateRecipeRequest = await request.json();
    const { recipe_id, rating, excluded_ingredients, notes } = body;
    
    // Validate
    if (!recipe_id || !rating) {
      return NextResponse.json(
        { error: 'recipe_id and rating are required' },
        { status: 400 }
      );
    }
    
    const validRatings = ['loved', 'liked', 'neutral', 'disliked', 'hated'];
    if (!validRatings.includes(rating)) {
      return NextResponse.json(
        { error: `rating must be one of: ${validRatings.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Insert or update rating
    const { error: ratingError } = await supabase
      .from('ratings')
      .upsert({
        profile_id: profile.id,
        recipe_id,
        rating,
        excluded_ingredients: excluded_ingredients || [],
        notes: notes || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'profile_id,recipe_id',
      });
    
    if (ratingError) {
      console.error('Rating error:', ratingError);
      return NextResponse.json(
        { error: 'Failed to save rating' },
        { status: 500 }
      );
    }
    
    // Count updated weights (for response info)
    const { count } = await supabase
      .from('preference_weights')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profile.id);
    
    const response: RateRecipeResponse = {
      success: true,
      updated_weights: count || 0,
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Rate recipe error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
