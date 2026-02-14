import { Router, Response } from 'express';
import { supabaseAdmin, AuthRequest, requireAuth } from '../middleware/auth';

export const predictionRoutes = Router();

// Get all predictions (with filters)
predictionRoutes.get('/', async (req, res) => {
  try {
    const { show_id, status, sort, limit = '20', offset = '0' } = req.query;
    let query = supabaseAdmin
      .from('predictions')
      .select('*, shows(title, poster_url, category), profiles!predictions_creator_id_fkey(username, avatar_url)')
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (show_id) query = query.eq('show_id', show_id);
    if (status) query = query.eq('status', status);

    if (sort === 'trending') {
      query = query.order('total_pool', { ascending: false });
    } else if (sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'ending_soon') {
      query = query.eq('status', 'active').order('deadline', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single prediction
predictionRoutes.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('predictions')
      .select('*, shows(title, poster_url, category), profiles!predictions_creator_id_fkey(username, avatar_url), bets(id, user_id, position, amount, created_at, profiles(username, avatar_url))')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Prediction not found' });
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create prediction
predictionRoutes.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, show_id, deadline } = req.body;
    if (!title || !show_id || !deadline) {
      return res.status(400).json({ error: 'Missing required fields: title, show_id, deadline' });
    }

    const { data, error } = await supabaseAdmin
      .from('predictions')
      .insert({
        title,
        description: description || null,
        show_id,
        creator_id: req.userId,
        deadline,
        status: 'active',
        total_yes: 0,
        total_no: 0,
        total_pool: 0,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Place a bet on a prediction
predictionRoutes.post('/:id/bet', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { position, amount } = req.body;
    if (!position || !amount || !['yes', 'no'].includes(position) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid bet: need position (yes/no) and positive amount' });
    }

    // Check user balance
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('coins')
      .eq('id', req.userId)
      .single();

    if (!profile || profile.coins < amount) {
      return res.status(400).json({ error: 'Insufficient PlotCoins' });
    }

    // Check prediction is active
    const { data: prediction } = await supabaseAdmin
      .from('predictions')
      .select('status, deadline')
      .eq('id', req.params.id)
      .single();

    if (!prediction || prediction.status !== 'active' || new Date(prediction.deadline) < new Date()) {
      return res.status(400).json({ error: 'Prediction is not active or has expired' });
    }

    // Deduct coins
    await supabaseAdmin
      .from('profiles')
      .update({ coins: profile.coins - amount })
      .eq('id', req.userId);

    // Create bet
    const { data: bet, error } = await supabaseAdmin
      .from('bets')
      .insert({
        user_id: req.userId,
        prediction_id: req.params.id,
        position,
        amount,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Update prediction totals
    const updateField = position === 'yes' ? 'total_yes' : 'total_no';
    await supabaseAdmin.rpc('increment_prediction_total', {
      pred_id: req.params.id,
      field_name: updateField,
      increment_amount: amount,
    });

    // Log transaction
    await supabaseAdmin.from('transactions').insert({
      user_id: req.userId,
      type: 'bet_placed',
      amount: -amount,
      reference_id: bet.id,
      description: `Bet on prediction: ${position.toUpperCase()}`,
    });

    res.status(201).json(bet);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Resolve prediction (admin only for now)
predictionRoutes.post('/:id/resolve', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { outcome } = req.body; // 'yes' or 'no'
    if (!['yes', 'no'].includes(outcome)) {
      return res.status(400).json({ error: 'Outcome must be yes or no' });
    }

    const { data: prediction } = await supabaseAdmin
      .from('predictions')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!prediction) return res.status(404).json({ error: 'Prediction not found' });
    if (prediction.creator_id !== req.userId) {
      return res.status(403).json({ error: 'Only the creator can resolve this prediction' });
    }

    // Get all bets
    const { data: bets } = await supabaseAdmin
      .from('bets')
      .select('*')
      .eq('prediction_id', req.params.id);

    if (!bets) return res.status(400).json({ error: 'No bets found' });

    const totalPool = prediction.total_yes + prediction.total_no;
    const winners = bets.filter(b => b.position === outcome);
    const totalWinning = outcome === 'yes' ? prediction.total_yes : prediction.total_no;

    // Distribute winnings
    for (const winner of winners) {
      const winnings = totalWinning > 0 ? Math.floor((winner.amount / totalWinning) * totalPool) : 0;
      await supabaseAdmin
        .from('profiles')
        .update({ coins: supabaseAdmin.rpc('increment_coins', { user_id_param: winner.user_id, amount_param: winnings }) })
        .eq('id', winner.user_id);
      
      // Actually, let's use RPC for atomic increment
      await supabaseAdmin.rpc('increment_coins', { user_id_param: winner.user_id, amount_param: winnings });

      await supabaseAdmin.from('transactions').insert({
        user_id: winner.user_id,
        type: 'bet_won',
        amount: winnings,
        reference_id: winner.id,
        description: `Won prediction bet`,
      });
    }

    // Update prediction status
    await supabaseAdmin
      .from('predictions')
      .update({ status: `resolved_${outcome}` })
      .eq('id', req.params.id);

    res.json({ message: 'Prediction resolved', outcome, totalPool, winnersCount: winners.length });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});
