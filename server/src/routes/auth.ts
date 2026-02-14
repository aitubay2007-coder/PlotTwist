import { Router, Response } from 'express';
import { supabaseAdmin, AuthRequest, requireAuth } from '../middleware/auth';

export const authRoutes = Router();

// Get current user profile
authRoutes.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.userId)
      .single();

    if (error) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
authRoutes.patch('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { username, display_name, avatar_url, country } = req.body;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ username, display_name, avatar_url, country })
      .eq('id', req.userId)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});
