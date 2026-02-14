import { Router, Response } from 'express';
import { supabaseAdmin, AuthRequest, requireAuth } from '../middleware/auth';

export const challengeRoutes = Router();

// Get my challenges
challengeRoutes.get('/my', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('challenges')
      .select('*, predictions(title), challenger:profiles!challenges_challenger_id_fkey(username, avatar_url), challenged:profiles!challenges_challenged_id_fkey(username, avatar_url)')
      .or(`challenger_id.eq.${req.userId},challenged_id.eq.${req.userId}`)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create challenge
challengeRoutes.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { challenged_id, prediction_id, position, amount } = req.body;
    if (!challenged_id || !prediction_id || !position || !amount) {
      return res.status(400).json({ error: 'Missing fields: challenged_id, prediction_id, position, amount' });
    }

    // Check balance
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('coins')
      .eq('id', req.userId)
      .single();

    if (!profile || profile.coins < amount) {
      return res.status(400).json({ error: 'Insufficient PlotCoins' });
    }

    const challenged_position = position === 'yes' ? 'no' : 'yes';

    const { data, error } = await supabaseAdmin
      .from('challenges')
      .insert({
        challenger_id: req.userId,
        challenged_id,
        prediction_id,
        challenger_position: position,
        challenged_position,
        amount,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Escrow challenger's coins
    await supabaseAdmin
      .from('profiles')
      .update({ coins: profile.coins - amount })
      .eq('id', req.userId);

    await supabaseAdmin.from('transactions').insert({
      user_id: req.userId,
      type: 'challenge_sent',
      amount: -amount,
      reference_id: data.id,
      description: 'Challenge escrow',
    });

    res.status(201).json(data);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept challenge
challengeRoutes.post('/:id/accept', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
    if (challenge.challenged_id !== req.userId) return res.status(403).json({ error: 'Not your challenge' });
    if (challenge.status !== 'pending') return res.status(400).json({ error: 'Challenge already responded' });

    // Check balance
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('coins')
      .eq('id', req.userId)
      .single();

    if (!profile || profile.coins < challenge.amount) {
      return res.status(400).json({ error: 'Insufficient PlotCoins' });
    }

    // Escrow challenged user's coins
    await supabaseAdmin
      .from('profiles')
      .update({ coins: profile.coins - challenge.amount })
      .eq('id', req.userId);

    await supabaseAdmin
      .from('challenges')
      .update({ status: 'accepted' })
      .eq('id', req.params.id);

    await supabaseAdmin.from('transactions').insert({
      user_id: req.userId,
      type: 'challenge_accepted',
      amount: -challenge.amount,
      reference_id: challenge.id,
      description: 'Challenge accepted escrow',
    });

    res.json({ message: 'Challenge accepted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Decline challenge
challengeRoutes.post('/:id/decline', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
    if (challenge.challenged_id !== req.userId) return res.status(403).json({ error: 'Not your challenge' });
    if (challenge.status !== 'pending') return res.status(400).json({ error: 'Challenge already responded' });

    // Refund challenger
    await supabaseAdmin.rpc('increment_coins', {
      user_id_param: challenge.challenger_id,
      amount_param: challenge.amount,
    });

    await supabaseAdmin
      .from('challenges')
      .update({ status: 'declined' })
      .eq('id', req.params.id);

    await supabaseAdmin.from('transactions').insert({
      user_id: challenge.challenger_id,
      type: 'challenge_refund',
      amount: challenge.amount,
      reference_id: challenge.id,
      description: 'Challenge declined - refund',
    });

    res.json({ message: 'Challenge declined' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});
