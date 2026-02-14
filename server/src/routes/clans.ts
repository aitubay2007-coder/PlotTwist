import { Router, Response } from 'express';
import { supabaseAdmin, AuthRequest, requireAuth } from '../middleware/auth';
import crypto from 'crypto';

export const clanRoutes = Router();

// Get my clans
clanRoutes.get('/my', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('clan_members')
      .select('role, joined_at, clans(id, name, description, avatar_url, created_at, profiles!clans_creator_id_fkey(username))')
      .eq('user_id', req.userId);

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get clan details
clanRoutes.get('/:id', async (req, res) => {
  try {
    const { data: clan, error } = await supabaseAdmin
      .from('clans')
      .select('*, profiles!clans_creator_id_fkey(username, avatar_url), clan_members(user_id, role, joined_at, profiles(username, avatar_url, coins, reputation))')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Clan not found' });
    res.json(clan);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create clan
clanRoutes.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Clan name is required' });

    const invite_code = crypto.randomBytes(6).toString('hex');

    const { data: clan, error } = await supabaseAdmin
      .from('clans')
      .insert({ name, description: description || null, creator_id: req.userId, invite_code })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Add creator as admin member
    await supabaseAdmin.from('clan_members').insert({
      clan_id: clan.id,
      user_id: req.userId,
      role: 'admin',
    });

    res.status(201).json(clan);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Join clan by invite code
clanRoutes.post('/join/:inviteCode', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data: clan } = await supabaseAdmin
      .from('clans')
      .select('id')
      .eq('invite_code', req.params.inviteCode)
      .single();

    if (!clan) return res.status(404).json({ error: 'Invalid invite code' });

    // Check not already member
    const { data: existing } = await supabaseAdmin
      .from('clan_members')
      .select('id')
      .eq('clan_id', clan.id)
      .eq('user_id', req.userId)
      .single();

    if (existing) return res.status(400).json({ error: 'Already a member of this clan' });

    const { data, error } = await supabaseAdmin
      .from('clan_members')
      .insert({ clan_id: clan.id, user_id: req.userId, role: 'member' })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});
