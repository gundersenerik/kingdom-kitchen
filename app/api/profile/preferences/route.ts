/**
 * GET /api/profile/preferences
 * 
 * Get the current user's learned preference weights.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { PreferencesResponse } from '@/lib/types';

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
    
    // Get preference weights, sorted by absolute weight (strongest first)
    const { data: weights, error: weightsError } = await supabase
      .from('preference_weights')
      .select('feature_type, feature_value, weight, sample_count')
      .eq('profile_id', profile.id)
      .order('weight', { ascending: false });
    
    if (weightsError) {
      console.error('Weights error:', weightsError);
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 }
      );
    }
    
    // Format response
    const response: PreferencesResponse = {
      preferences: (weights || []).map(w => ({
        feature: `${w.feature_type}:${w.feature_value}`,
        weight: w.weight,
        sample_count: w.sample_count,
      })),
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Preferences error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
