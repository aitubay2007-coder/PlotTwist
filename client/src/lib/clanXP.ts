import { supabase } from './supabase';

/**
 * Award XP to the user's clan (if they belong to one).
 * Fails silently — clan XP is a bonus, not critical.
 */
export async function awardClanXP(userId: string, xpAmount: number): Promise<void> {
  try {
    await supabase.rpc('award_clan_xp_for_user', {
      user_id_param: userId,
      xp_amount: xpAmount,
    });
  } catch {
    // non-critical — swallow errors
  }
}
