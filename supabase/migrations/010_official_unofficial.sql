-- ==========================================
-- 010: OFFICIAL vs UNOFFICIAL PREDICTIONS
-- ==========================================

-- 1. Add mode column to predictions
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'official'
  CHECK (mode IN ('official', 'unofficial'));

-- 2. Add resolved_at timestamp for dispute window tracking
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 3. Add disputed flag
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS disputed BOOLEAN NOT NULL DEFAULT false;

-- 4. Add is_admin flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 5. Prediction disputes table (for voting on unofficial results)
CREATE TABLE IF NOT EXISTS public.prediction_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prediction_id, user_id)
);

ALTER TABLE public.prediction_disputes ENABLE ROW LEVEL SECURITY;

-- Participants can read disputes
CREATE POLICY "Anyone can read disputes"
  ON public.prediction_disputes FOR SELECT
  USING (true);

-- Bettors can create disputes
CREATE POLICY "Bettors can dispute"
  ON public.prediction_disputes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.bets b
      WHERE b.prediction_id = prediction_disputes.prediction_id
        AND b.user_id = auth.uid()
    )
  );

-- ==========================================
-- 6. Updated resolve_prediction RPC
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
  SELECT * INTO pred FROM public.predictions WHERE id = pred_id;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Prediction not found'); END IF;
  IF pred.status != 'active' THEN RETURN json_build_object('error', 'Prediction already resolved'); END IF;
  IF outcome NOT IN ('yes', 'no') THEN RETURN json_build_object('error', 'Invalid outcome'); END IF;

  -- Get caller profile
  SELECT * INTO caller_profile FROM public.profiles WHERE id = auth.uid();

  -- Permission check based on mode
  IF pred.mode = 'official' THEN
    -- Official: only admins can resolve
    IF NOT COALESCE(caller_profile.is_admin, false) THEN
      RETURN json_build_object('error', 'Only admins can resolve official predictions');
    END IF;
  ELSE
    -- Unofficial: only the creator can resolve
    IF pred.creator_id != auth.uid() THEN
      RETURN json_build_object('error', 'Only the creator can resolve');
    END IF;
  END IF;

  winning_side := outcome;
  losing_side := CASE WHEN outcome = 'yes' THEN 'no' ELSE 'yes' END;
  winning_pool := CASE WHEN outcome = 'yes' THEN pred.total_yes ELSE pred.total_no END;
  total_pool := pred.total_pool;

  -- For unofficial: mark as resolved but set resolved_at for dispute window
  IF pred.mode = 'unofficial' THEN
    UPDATE public.predictions
    SET status = CASE WHEN outcome = 'yes' THEN 'resolved_yes' ELSE 'resolved_no' END,
        resolved_at = NOW()
    WHERE id = pred_id;
  ELSE
    -- Official: resolve immediately (no dispute window)
    UPDATE public.predictions
    SET status = CASE WHEN outcome = 'yes' THEN 'resolved_yes' ELSE 'resolved_no' END,
        resolved_at = NOW()
    WHERE id = pred_id;
  END IF;

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
-- 7. Dispute prediction RPC
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
  SELECT * INTO pred FROM public.predictions WHERE id = pred_id;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Prediction not found'); END IF;

  -- Must be unofficial and resolved
  IF pred.mode != 'unofficial' THEN
    RETURN json_build_object('error', 'Only unofficial predictions can be disputed');
  END IF;
  IF pred.status NOT IN ('resolved_yes', 'resolved_no') THEN
    RETURN json_build_object('error', 'Prediction is not resolved');
  END IF;
  IF pred.resolved_at IS NULL THEN
    RETURN json_build_object('error', 'No resolution timestamp');
  END IF;

  -- Check 24h window
  hours_since_resolve := EXTRACT(EPOCH FROM (NOW() - pred.resolved_at)) / 3600;
  IF hours_since_resolve > 24 THEN
    RETURN json_build_object('error', 'Dispute window has closed (24h)');
  END IF;

  -- Must be a bettor on this prediction
  IF NOT EXISTS (
    SELECT 1 FROM public.bets WHERE prediction_id = pred_id AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object('error', 'Only bettors can dispute');
  END IF;

  -- Cannot be the creator
  IF pred.creator_id = auth.uid() THEN
    RETURN json_build_object('error', 'Creator cannot dispute own prediction');
  END IF;

  -- Check for existing dispute
  SELECT * INTO existing_dispute FROM public.prediction_disputes
  WHERE prediction_id = pred_id AND user_id = auth.uid();
  IF FOUND THEN
    RETURN json_build_object('error', 'You already voted in this dispute');
  END IF;

  IF vote_param NOT IN ('yes', 'no') THEN
    RETURN json_build_object('error', 'Vote must be yes or no');
  END IF;

  -- Insert dispute vote
  INSERT INTO public.prediction_disputes (prediction_id, user_id, vote, reason)
  VALUES (pred_id, auth.uid(), vote_param, reason_param);

  -- Mark prediction as disputed
  UPDATE public.predictions SET disputed = true WHERE id = pred_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 8. Finalize disputed prediction RPC
-- ==========================================
CREATE OR REPLACE FUNCTION public.finalize_disputed_prediction(pred_id UUID)
RETURNS JSON AS $$
DECLARE
  pred RECORD;
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
  SELECT * INTO pred FROM public.predictions WHERE id = pred_id;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Prediction not found'); END IF;
  IF pred.mode != 'unofficial' THEN RETURN json_build_object('error', 'Not unofficial'); END IF;
  IF NOT pred.disputed THEN RETURN json_build_object('error', 'Not disputed'); END IF;
  IF pred.resolved_at IS NULL THEN RETURN json_build_object('error', 'No resolution timestamp'); END IF;

  hours_since_resolve := EXTRACT(EPOCH FROM (NOW() - pred.resolved_at)) / 3600;
  IF hours_since_resolve < 24 THEN
    RETURN json_build_object('error', 'Dispute window still open');
  END IF;

  -- Count votes
  SELECT COUNT(*) INTO yes_votes FROM public.prediction_disputes WHERE prediction_id = pred_id AND vote = 'yes';
  SELECT COUNT(*) INTO no_votes FROM public.prediction_disputes WHERE prediction_id = pred_id AND vote = 'no';

  old_outcome := CASE WHEN pred.status = 'resolved_yes' THEN 'yes' ELSE 'no' END;

  -- Determine new outcome by majority vote
  IF yes_votes > no_votes THEN
    new_outcome := 'yes';
  ELSIF no_votes > yes_votes THEN
    new_outcome := 'no';
  ELSE
    -- Tie: refund everyone
    FOR bet IN SELECT b.user_id, b.amount FROM public.bets b WHERE b.prediction_id = pred_id
    LOOP
      UPDATE public.profiles SET coins = coins + bet.amount WHERE id = bet.user_id;
      INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
      VALUES (bet.user_id, 'challenge_refund', bet.amount, pred_id, 'Dispute tie - refund');
    END LOOP;

    -- Refund challenges too
    FOR ch IN SELECT * FROM public.challenges WHERE prediction_id = pred_id AND status = 'resolved'
    LOOP
      UPDATE public.profiles SET coins = coins + ch.amount WHERE id = ch.challenger_id;
      UPDATE public.profiles SET coins = coins + ch.amount WHERE id = ch.challenged_id;
    END LOOP;

    UPDATE public.predictions SET status = 'cancelled', disputed = true WHERE id = pred_id;
    RETURN json_build_object('success', true, 'result', 'tie_refund', 'yes_votes', yes_votes, 'no_votes', no_votes);
  END IF;

  -- If vote confirms original outcome, nothing changes
  IF new_outcome = old_outcome THEN
    RETURN json_build_object('success', true, 'result', 'confirmed', 'outcome', new_outcome, 'yes_votes', yes_votes, 'no_votes', no_votes);
  END IF;

  -- REVERSE the original resolution: take back from original winners, pay new winners
  -- First, reverse original payouts
  FOR bet IN SELECT b.user_id, b.amount FROM public.bets b WHERE b.prediction_id = pred_id AND b.position = old_outcome
  LOOP
    total_pool := pred.total_pool;
    winning_pool := CASE WHEN old_outcome = 'yes' THEN pred.total_yes ELSE pred.total_no END;
    IF winning_pool > 0 AND total_pool > 0 THEN
      payout := ROUND((bet.amount::NUMERIC / winning_pool::NUMERIC) * total_pool::NUMERIC);
      UPDATE public.profiles SET coins = GREATEST(0, coins - payout) WHERE id = bet.user_id;
    END IF;
  END LOOP;

  -- Now pay the correct winners
  total_pool := pred.total_pool;
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

  -- Update prediction status
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
