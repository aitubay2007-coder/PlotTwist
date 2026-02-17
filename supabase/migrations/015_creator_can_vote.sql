-- ==========================================
-- PlotTwist: Allow creator to vote in disputes (with 0.5 weight)
-- + Cap creator's bet on own unofficial predictions (max 200 coins)
-- Run this in Supabase SQL Editor
-- ==========================================

-- ==========================================
-- 1. UPDATED place_bet: cap creator's bet on own unofficial predictions
-- ==========================================
CREATE OR REPLACE FUNCTION public.place_bet(
  user_id_param UUID,
  prediction_id_param UUID,
  position_param TEXT,
  amount_param INTEGER
)
RETURNS JSON AS $$
DECLARE
  user_coins INTEGER;
  pred RECORD;
  existing_bet_total INTEGER;
  max_creator_bet CONSTANT INTEGER := 200;
BEGIN
  IF user_id_param != auth.uid() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  IF position_param NOT IN ('yes', 'no') THEN
    RETURN json_build_object('error', 'Invalid position');
  END IF;

  IF amount_param < 10 THEN
    RETURN json_build_object('error', 'Minimum bet is 10 coins');
  END IF;

  SELECT * INTO pred FROM public.predictions WHERE id = prediction_id_param;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Prediction not found');
  END IF;
  IF pred.status != 'active' THEN
    RETURN json_build_object('error', 'Prediction is not active');
  END IF;
  IF pred.deadline < NOW() THEN
    RETURN json_build_object('error', 'Prediction has expired');
  END IF;

  -- Anti-farming: cap creator's bet on own unofficial predictions
  IF pred.creator_id = user_id_param AND COALESCE(pred.mode, 'official') = 'unofficial' THEN
    SELECT COALESCE(SUM(b.amount), 0) INTO existing_bet_total
    FROM public.bets b WHERE b.prediction_id = prediction_id_param AND b.user_id = user_id_param;

    IF (existing_bet_total + amount_param) > max_creator_bet THEN
      RETURN json_build_object('error', 'creator_bet_limit', 'max', max_creator_bet, 'current', existing_bet_total);
    END IF;
  END IF;

  SELECT coins INTO user_coins FROM public.profiles WHERE id = user_id_param FOR UPDATE;
  IF user_coins < amount_param THEN
    RETURN json_build_object('error', 'Insufficient coins');
  END IF;

  UPDATE public.profiles SET coins = coins - amount_param WHERE id = user_id_param;

  INSERT INTO public.bets (user_id, prediction_id, position, amount)
  VALUES (user_id_param, prediction_id_param, position_param, amount_param);

  IF position_param = 'yes' THEN
    UPDATE public.predictions SET total_yes = total_yes + amount_param, total_pool = total_pool + amount_param WHERE id = prediction_id_param;
  ELSE
    UPDATE public.predictions SET total_no = total_no + amount_param, total_pool = total_pool + amount_param WHERE id = prediction_id_param;
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
  VALUES (user_id_param, 'bet_placed', amount_param, prediction_id_param, 'Bet placed: ' || UPPER(position_param));

  RETURN json_build_object('success', true, 'remaining_coins', user_coins - amount_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 2. UPDATED dispute_prediction: allow creator to vote
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

  -- Creator CAN vote now, but must have a bet (like everyone else)
  IF NOT EXISTS (
    SELECT 1 FROM public.bets WHERE prediction_id = pred_id AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object('error', 'Only bettors can dispute');
  END IF;

  -- REMOVED: creator block. Creator can now participate in disputes.

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

  RETURN json_build_object('success', true, 'is_creator', pred.creator_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 3. UPDATED finalize_disputed_prediction: creator vote = 0.5 weight
-- ==========================================
CREATE OR REPLACE FUNCTION public.finalize_disputed_prediction(pred_id UUID)
RETURNS JSON AS $$
DECLARE
  pred RECORD;
  caller_profile RECORD;
  hours_since_resolve NUMERIC;
  yes_votes NUMERIC;
  no_votes NUMERIC;
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
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  SELECT * INTO pred FROM public.predictions WHERE id = pred_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Prediction not found'); END IF;
  IF pred.mode != 'unofficial' THEN RETURN json_build_object('error', 'Not unofficial'); END IF;
  IF NOT pred.disputed THEN RETURN json_build_object('error', 'Not disputed'); END IF;
  IF pred.status = 'cancelled' THEN RETURN json_build_object('error', 'Prediction was cancelled'); END IF;
  IF pred.resolved_at IS NULL THEN RETURN json_build_object('error', 'No resolution timestamp'); END IF;

  SELECT * INTO caller_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(caller_profile.is_admin, false) AND pred.creator_id != auth.uid() THEN
    RETURN json_build_object('error', 'Only admins or the creator can finalize disputes');
  END IF;

  hours_since_resolve := EXTRACT(EPOCH FROM (NOW() - pred.resolved_at)) / 3600;
  IF hours_since_resolve < 24 THEN
    RETURN json_build_object('error', 'Dispute window still open');
  END IF;

  -- Count votes: creator's vote = 0.5, others = 1.0 (anti-farming)
  SELECT COALESCE(SUM(
    CASE WHEN d.user_id = pred.creator_id THEN 0.5 ELSE 1.0 END
  ), 0) INTO yes_votes
  FROM public.prediction_disputes d
  WHERE d.prediction_id = pred_id AND d.vote = 'yes';

  SELECT COALESCE(SUM(
    CASE WHEN d.user_id = pred.creator_id THEN 0.5 ELSE 1.0 END
  ), 0) INTO no_votes
  FROM public.prediction_disputes d
  WHERE d.prediction_id = pred_id AND d.vote = 'no';

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

  -- 1. Reverse bet payouts from old winners
  winning_pool := CASE WHEN old_outcome = 'yes' THEN pred.total_yes ELSE pred.total_no END;
  IF winning_pool > 0 AND total_pool > 0 THEN
    FOR bet IN SELECT b.user_id, b.amount FROM public.bets b WHERE b.prediction_id = pred_id AND b.position = old_outcome
    LOOP
      payout := ROUND((bet.amount::NUMERIC / winning_pool::NUMERIC) * total_pool::NUMERIC);
      UPDATE public.profiles SET coins = GREATEST(0, coins - payout), reputation = GREATEST(0, reputation - 10) WHERE id = bet.user_id;
    END LOOP;
  END IF;

  -- 2. Reverse challenge payouts
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
