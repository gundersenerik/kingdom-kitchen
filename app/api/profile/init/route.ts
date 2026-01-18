/**
 * POST /api/profile/init
 *
 * Initialize profile for a user (creates household + profile if needed).
 * Called after login to ensure user has a profile.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Get auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient(authHeader);

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, household_id, display_name')
      .eq('user_id', user.id)
      .single();

    if (existingProfile && existingProfile.household_id) {
      return NextResponse.json({
        success: true,
        profile: existingProfile,
        created: false,
      });
    }

    // Need to create profile - use service role client to bypass RLS
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Create household
    const displayName = user.email?.split('@')[0] || 'User';
    const { data: household, error: householdError } = await adminClient
      .from('households')
      .insert({ name: `${displayName}'s Family` })
      .select('id')
      .single();

    if (householdError || !household) {
      console.error('Failed to create household:', householdError);
      return NextResponse.json(
        { error: 'Failed to create household' },
        { status: 500 }
      );
    }

    // Create profile
    const { data: newProfile, error: profileError } = await adminClient
      .from('profiles')
      .insert({
        user_id: user.id,
        household_id: household.id,
        display_name: displayName,
      })
      .select('id, household_id, display_name')
      .single();

    if (profileError || !newProfile) {
      console.error('Failed to create profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to create profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: newProfile,
      created: true,
    });
  } catch (error) {
    console.error('Profile init error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
