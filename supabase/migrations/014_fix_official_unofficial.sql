-- ==========================================
-- 014: FIX Official/Unofficial - restore mode logic lost by 013
-- ==========================================

-- 013_audit_fixes overwrote resolve_prediction with an older version
-- that doesn't know about mode, is_admin, or resolved_at.
-- This migration restores the correct version with all fixes.

-- ==========================================
-- 1. FIXED resolve_prediction (mode-aware + FOR UPDATE + auth check)
-- ==========================================
CREATE OR REPLACE FUNCTION public.resolve_prediction(pred_id UUID, outcome TEXT)
RETURNS JSON AS $$
DECLARE
  pred RECORD;
  caller_profile RECORD;
  winning_side TEXT;
  losing_side TEXT;
  winning_pool INTEGER;
  total_pool INTEGER;
  bet RECORD;
  ch RECORD;
  payout INTEGER;
  winners_count INTEGER := 0;
  total_paid INTEGER := 0;
  creator_clan_id UUID;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Lock prediction row to prevent concurrent resolve
  SELECT * INTO pred FROM public.predictions WHERE id = pred_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Prediction not found'); END IF;
  IF pred.status != 'active' THEN RETURN json_build_object('error', 'Prediction already resolved'); END IF;
  IF outcome NOT IN ('yes', 'no') THEN RETURN json_build_object('error', 'Invalid outcome'); END IF;

  -- Get caller profile
  SELECT * INTO caller_profile FROM public.profiles WHERE id = auth.uid();

  -- Permission check based on mode
  IF pred.mode = 'official' THEN
    IF NOT COALESCE(caller_profile.is_admin, false) THEN
      RETURN json_build_object('error', 'Only admins can resolve official predictions');
    END IF;
  ELSE
    IF pred.creator_id != auth.uid() THEN
      RETURN json_build_object('error', 'Only the creator can resolve');
    END IF;
  END IF;

  winning_side := outcome;
  losing_side := CASE WHEN outcome = 'yes' THEN 'no' ELSE 'yes' END;
  winning_pool := CASE WHEN outcome = 'yes' THEN pred.total_yes ELSE pred.total_no END;
  total_pool := pred.total_pool;

  -- Update prediction status and resolved_at
  UPDATE public.predictions
  SET status = CASE WHEN outcome = 'yes' THEN 'resolved_yes' ELSE 'resolved_no' END,
      resolved_at = NOW()
  WHERE id = pred_id;

  -- Pay out bet winners
  IF winning_pool > 0 AND total_pool > 0 THEN
    FOR bet IN
      SELECT b.user_id, b.amount FROM public.bets b
      WHERE b.prediction_id = pred_id AND b.position = winning_side
    LOOP
      payout := ROUND((bet.amount::NUMERIC / winning_pool::NUMERIC) * total_pool::NUMERIC);
      UPDATE public.profiles SET coins = coins + payout, reputation = reputation + 10 WHERE id = bet.user_id;
      INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
      VALUES (bet.user_id, 'bet_won', payout, pred_id, 'Won prediction bet');
      winners_count := winners_count + 1;
      total_paid := total_paid + payout;
    END LOOP;
  END IF;

  -- Losers get +2 reputation for participating
  UPDATE public.profiles SET reputation = reputation + 2
  WHERE id IN (SELECT b.user_id FROM public.bets b WHERE b.prediction_id = pred_id AND b.position = losing_side);

  -- Auto-resolve challenges
  FOR ch IN
    SELECT * FROM public.challenges WHERE prediction_id = pred_id AND status = 'accepted'
  LOOP
    IF ch.challenger_position = winning_side THEN
      UPDATE public.profiles SET coins = coins + (ch.amount * 2), reputation = reputation + 15 WHERE id = ch.challenger_id;
      UPDATE public.profiles SET reputation = reputation + 3 WHERE id = ch.challenged_id;
      INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
      VALUES (ch.challenger_id, 'challenge_won', ch.amount * 2, ch.id, 'Won challenge');
    ELSE
      UPDATE public.profiles SET coins = coins + (ch.amount * 2), reputation = reputation + 15 WHERE id = ch.challenged_id;
      UPDATE public.profiles SET reputation = reputation + 3 WHERE id = ch.challenger_id;
      INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
      VALUES (ch.challenged_id, 'challenge_won', ch.amount * 2, ch.id, 'Won challenge');
    END IF;
    UPDATE public.challenges SET status = 'resolved' WHERE id = ch.id;
  END LOOP;

  -- Award clan XP to creator's clan
  SELECT cm.clan_id INTO creator_clan_id
  FROM public.clan_members cm WHERE cm.user_id = pred.creator_id LIMIT 1;
  IF creator_clan_id IS NOT NULL THEN
    PERFORM public.add_clan_xp(creator_clan_id, 10);
  END IF;

  RETURN json_build_object(
    'success', true, 'outcome', outcome,
    'winners', winners_count, 'total_paid', total_paid, 'total_pool', total_pool,
    'mode', pred.mode
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 2. FIXED dispute_prediction (auth check + cancelled guard)
-- ==========================================
CREATE OR REPLACE FUNCTION public.dispute_prediction(
  pred_id UUID,
  vote_param TEXT,
  reason_param TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  pred RECORD;
  existing_dispute RECORD;
  hours_since_resolve NUMERIC;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  SELECT * INTO pred FROM public.predictions WHERE id = pred_id;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Prediction not found'); END IF;

  IF pred.mode != 'unofficial' THEN
    RETURN json_build_object('error', 'Only unofficial predictions can be disputed');
  END IF;
  IF pred.status NOT IN ('resolved_yes', 'resolved_no') THEN
    RETURN json_build_object('error', 'Prediction is not resolved');
  END IF;
  IF pred.resolved_at IS NULL THEN
    RETURN json_build_object('error', 'No resolution timestamp');
  END IF;

  hours_since_resolve := EXTRACT(EPOCH FROM (NOW() - pred.resolved_at)) / 3600;
  IF hours_since_resolve > 24 THEN
    RETURN json_build_object('error', 'Dispute window has closed (24h)');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bets WHERE prediction_id = pred_id AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object('error', 'Only bettors can dispute');
  END IF;

  IF pred.creator_id = auth.uid() THEN
    RETURN json_build_object('error', 'Creator cannot dispute own prediction');
  END IF;

  SELECT * INTO existing_dispute FROM public.prediction_disputes
  WHERE prediction_id = pred_id AND user_id = auth.uid();
  IF FOUND THEN
    RETURN json_build_object('error', 'You already voted in this dispute');
  END IF;

  IF vote_param NOT IN ('yes', 'no') THEN
    RETURN json_build_object('error', 'Vote must be yes or no');
  END IF;

  INSERT INTO public.prediction_disputes (prediction_id, user_id, vote, reason)
  VALUES (pred_id, auth.uid(), vote_param, reason_param);

  UPDATE public.predictions SET disputed = true WHERE id = pred_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 3. FIXED finalize_disputed_prediction
--    + permission check
--    + FOR UPDATE lock
--    + challenge reversal
--    + reputation reversal
--    + cancelled guard
-- ==========================================
CREATE OR REPLACE FUNCTION public.finalize_disputed_prediction(pred_id UUID)
RETURNS JSON AS $$
DECLARE
  pred RECORD;
  caller_profile RECORD;
  hours_since_resolve NUMERIC;
  yes_votes INTEGER;
  no_votes INTEGER;
  new_outcome TEXT;
  old_outcome TEXT;
  bet RECORD;
  ch RECORD;
  payout INTEGER;
  winning_pool INTEGER;
  total_pool INTEGER;
  winners_count INTEGER := 0;
  total_paid INTEGER := 0;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Lock prediction row
  SELECT * INTO pred FROM public.predictions WHERE id = pred_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Prediction not found'); END IF;
  IF pred.mode != 'unofficial' THEN RETURN json_build_object('error', 'Not unofficial'); END IF;
  IF NOT pred.disputed THEN RETURN json_build_object('error', 'Not disputed'); END IF;
  IF pred.status = 'cancelled' THEN RETURN json_build_object('error', 'Prediction was cancelled'); END IF;
  IF pred.resolved_at IS NULL THEN RETURN json_build_object('error', 'No resolution timestamp'); END IF;

  -- Permission: only admins or the creator can finalize
  SELECT * INTO caller_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(caller_profile.is_admin, false) AND pred.creator_id != auth.uid() THEN
    RETURN json_build_object('error', 'Only admins or the creator can finalize disputes');
  END IF;

  hours_since_resolve := EXTRACT(EPOCH FROM (NOW() - pred.resolved_at)) / 3600;
  IF hours_since_resolve < 24 THEN
    RETURN json_build_object('error', 'Dispute window still open');
  END IF;

  SELECT COUNT(*) INTO yes_votes FROM public.prediction_disputes WHERE prediction_id = pred_id AND vote = 'yes';
  SELECT COUNT(*) INTO no_votes FROM public.prediction_disputes WHERE prediction_id = pred_id AND vote = 'no';

  old_outcome := CASE WHEN pred.status = 'resolved_yes' THEN 'yes' ELSE 'no' END;

  -- Tie: refund everyone
  IF yes_votes = no_votes THEN
    FOR bet IN SELECT b.user_id, b.amount FROM public.bets b WHERE b.prediction_id = pred_id
    LOOP
      UPDATE public.profiles SET coins = coins + bet.amount WHERE id = bet.user_id;
      INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
      VALUES (bet.user_id, 'challenge_refund', bet.amount, pred_id, 'Dispute tie - refund');
    END LOOP;

    FOR ch IN SELECT * FROM public.challenges WHERE prediction_id = pred_id AND status = 'resolved'
    LOOP
      UPDATE public.profiles SET coins = coins + ch.amount WHERE id = ch.challenger_id;
      UPDATE public.profiles SET coins = coins + ch.amount WHERE id = ch.challenged_id;
    END LOOP;

    UPDATE public.predictions SET status = 'cancelled', disputed = true WHERE id = pred_id;
    RETURN json_build_object('success', true, 'result', 'tie_refund', 'yes_votes', yes_votes, 'no_votes', no_votes);
  END IF;

  -- Majority wins
  IF yes_votes > no_votes THEN
    new_outcome := 'yes';
  ELSE
    new_outcome := 'no';
  END IF;

  -- If vote confirms original outcome, nothing to reverse
  IF new_outcome = old_outcome THEN
    RETURN json_build_object('success', true, 'result', 'confirmed', 'outcome', new_outcome, 'yes_votes', yes_votes, 'no_votes', no_votes);
  END IF;

  -- === REVERSE original resolution ===

  total_pool := pred.total_pool;

  -- 1. Reverse bet payouts from old winners (take back coins + reputation)
  winning_pool := CASE WHEN old_outcome = 'yes' THEN pred.total_yes ELSE pred.total_no END;
  IF winning_pool > 0 AND total_pool > 0 THEN
    FOR bet IN SELECT b.user_id, b.amount FROM public.bets b WHERE b.prediction_id = pred_id AND b.position = old_outcome
    LOOP
      payout := ROUND((bet.amount::NUMERIC / winning_pool::NUMERIC) * total_pool::NUMERIC);
      UPDATE public.profiles SET coins = GREATEST(0, coins - payout), reputation = GREATEST(0, reputation - 10) WHERE id = bet.user_id;
    END LOOP;
  END IF;

  -- 2. Reverse challenge payouts from old winners
  FOR ch IN SELECT * FROM public.challenges WHERE prediction_id = pred_id AND status = 'resolved'
  LOOP
    IF ch.challenger_position = old_outcome THEN
      UPDATE public.profiles SET coins = GREATEST(0, coins - (ch.amount * 2)), reputation = GREATEST(0, reputation - 15) WHERE id = ch.challenger_id;
      UPDATE public.profiles SET reputation = GREATEST(0, reputation - 3) WHERE id = ch.challenged_id;
    ELSE
      UPDATE public.profiles SET coins = GREATEST(0, coins - (ch.amount * 2)), reputation = GREATEST(0, reputation - 15) WHERE id = ch.challenged_id;
      UPDATE public.profiles SET reputation = GREATEST(0, reputation - 3) WHERE id = ch.challenger_id;
    END IF;
  END LOOP;

  -- === PAY new correct winners ===

  -- 3. Pay new bet winners
  winning_pool := CASE WHEN new_outcome = 'yes' THEN pred.total_yes ELSE pred.total_no END;
  IF winning_pool > 0 AND total_pool > 0 THEN
    FOR bet IN SELECT b.user_id, b.amount FROM public.bets b WHERE b.prediction_id = pred_id AND b.position = new_outcome
    LOOP
      payout := ROUND((bet.amount::NUMERIC / winning_pool::NUMERIC) * total_pool::NUMERIC);
      UPDATE public.profiles SET coins = coins + payout, reputation = reputation + 10 WHERE id = bet.user_id;
      INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
      VALUES (bet.user_id, 'bet_won', payout, pred_id, 'Won after dispute reversal');
      winners_count := winners_count + 1;
      total_paid := total_paid + payout;
    END LOOP;
  END IF;

  -- 4. Pay new challenge winners
  FOR ch IN SELECT * FROM public.challenges WHERE prediction_id = pred_id AND status = 'resolved'
  LOOP
    IF ch.challenger_position = new_outcome THEN
      UPDATE public.profiles SET coins = coins + (ch.amount * 2), reputation = reputation + 15 WHERE id = ch.challenger_id;
      UPDATE public.profiles SET reputation = reputation + 3 WHERE id = ch.challenged_id;
      INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
      VALUES (ch.challenger_id, 'challenge_won', ch.amount * 2, ch.id, 'Won challenge after dispute');
    ELSE
      UPDATE public.profiles SET coins = coins + (ch.amount * 2), reputation = reputation + 15 WHERE id = ch.challenged_id;
      UPDATE public.profiles SET reputation = reputation + 3 WHERE id = ch.challenger_id;
      INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
      VALUES (ch.challenged_id, 'challenge_won', ch.amount * 2, ch.id, 'Won challenge after dispute');
    END IF;
  END LOOP;

  -- Update prediction status to new outcome
  UPDATE public.predictions
  SET status = CASE WHEN new_outcome = 'yes' THEN 'resolved_yes' ELSE 'resolved_no' END
  WHERE id = pred_id;

  RETURN json_build_object(
    'success', true, 'result', 'reversed',
    'new_outcome', new_outcome, 'old_outcome', old_outcome,
    'yes_votes', yes_votes, 'no_votes', no_votes,
    'winners', winners_count, 'total_paid', total_paid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 4. INDEX for dispute queries
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_prediction_disputes_pred_vote
  ON public.prediction_disputes(prediction_id, vote);
