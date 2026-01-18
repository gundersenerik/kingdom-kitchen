/**
 * Profile Management Utilities
 *
 * Handles automatic profile and household creation for new users.
 */

import { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Ensure a user has a profile and household.
 * Creates them if they don't exist.
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  user: User
): Promise<{ profileId: string; householdId: string } | null> {
  try {
    // Check if profile exists
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, household_id')
      .eq('user_id', user.id)
      .single();

    if (existingProfile && existingProfile.household_id) {
      return {
        profileId: existingProfile.id,
        householdId: existingProfile.household_id,
      };
    }

    // If we get here, we need to create profile/household
    // This requires service role or appropriate RLS policies

    // First, create a household
    const displayName = user.email?.split('@')[0] || 'User';

    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert({ name: `${displayName}'s Family` })
      .select('id')
      .single();

    if (householdError || !household) {
      console.error('Failed to create household:', householdError);
      return null;
    }

    // Then create the profile
    const { data: newProfile, error: newProfileError } = await supabase
      .from('profiles')
      .insert({
        user_id: user.id,
        household_id: household.id,
        display_name: displayName,
      })
      .select('id, household_id')
      .single();

    if (newProfileError || !newProfile) {
      console.error('Failed to create profile:', newProfileError);
      return null;
    }

    return {
      profileId: newProfile.id,
      householdId: newProfile.household_id,
    };
  } catch (error) {
    console.error('Error ensuring profile:', error);
    return null;
  }
}

/**
 * Get profile for a user, creating if needed (uses admin client)
 */
export async function getOrCreateProfile(
  adminClient: SupabaseClient,
  user: User
): Promise<{ profileId: string; householdId: string } | null> {
  try {
    // Check if profile exists
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, household_id')
      .eq('user_id', user.id)
      .single();

    if (existingProfile && existingProfile.household_id) {
      return {
        profileId: existingProfile.id,
        householdId: existingProfile.household_id,
      };
    }

    // Create household and profile
    const displayName = user.email?.split('@')[0] || 'User';

    const { data: household } = await adminClient
      .from('households')
      .insert({ name: `${displayName}'s Family` })
      .select('id')
      .single();

    if (!household) return null;

    const { data: newProfile } = await adminClient
      .from('profiles')
      .insert({
        user_id: user.id,
        household_id: household.id,
        display_name: displayName,
      })
      .select('id, household_id')
      .single();

    if (!newProfile) return null;

    return {
      profileId: newProfile.id,
      householdId: newProfile.household_id,
    };
  } catch (error) {
    console.error('Error in getOrCreateProfile:', error);
    return null;
  }
}
