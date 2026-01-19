/**
 * GET /api/recipes/next
 * 
 * Get the next recipe for the user to rate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getNextRecipeToRate } from '@/lib/recommendation';
import { NextRecipeResponse } from '@/lib/types';

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
    
    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get exclude parameter (to avoid returning the same recipe twice)
    const { searchParams } = new URL(request.url);
    const excludeId = searchParams.get('exclude');

    // Get next recipe
    const recipe = await getNextRecipeToRate(profile.id, authHeader, excludeId || undefined);

    const response: NextRecipeResponse = {
      recipe: recipe,
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Next recipe error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
