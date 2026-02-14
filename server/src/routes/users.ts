import { Router, Response } from 'express';
import { supabaseAdmin, AuthRequest, requireAuth } from '../middleware/auth';

export const userRoutes = Router();

// Get leaderboard
userRoutes.get('/leaderboard', async (req, res) => {
  try {
    const { country, limit = '50' } = req.query;
    let query = supabaseAdmin
      .from('profiles')
      .select('id, username, avatar_url, coins, reputation, country')
      .order('reputation', { ascending: false })
      .limit(Number(limit));

    if (country) query = query.eq('country', country);

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile by id
userRoutes.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, avatar_url, coins, reputation, country, created_at')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Claim daily bonus
userRoutes.post('/daily-bonus', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Check last bonus claim
    const { data: lastClaim } = await supabaseAdmin
      .from('transactions')
      .select('created_at')
      .eq('user_id', req.userId)
      .eq('type', 'daily_bonus')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastClaim) {
      const lastDate = new Date(lastClaim.created_at);
      const now = new Date();
      const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
      if (diffHours < 24) {
        return res.status(400).json({ error: 'Daily bonus already claimed', nextClaim: new Date(lastDate.getTime() + 24 * 60 * 60 * 1000) });
      }
    }

    const DAILY_BONUS = 50;
    await supabaseAdmin.rpc('increment_coins', { user_id_param: req.userId, amount_param: DAILY_BONUS });

    await supabaseAdmin.from('transactions').insert({
      user_id: req.userId,
      type: 'daily_bonus',
      amount: DAILY_BONUS,
      description: 'Daily login bonus',
    });

    res.json({ message: 'Daily bonus claimed!', amount: DAILY_BONUS });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});
