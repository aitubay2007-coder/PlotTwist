-- ================================================================
-- 017: Remove challenge/clan references from RPCs
-- After simplification, challenges and clans are no longer used.
-- This rewrites RPCs to remove dead references that would error
-- if those tables are ever dropped.
-- Run this ENTIRE file in Supabase SQL Editor → New Query → Run
-- ================================================================

-- 1. Drop old accept_challenge and award_clan_xp_for_user functions
DROP FUNCTION IF EXISTS public.accept_challenge(UUID);
DROP FUNCTION IF EXISTS public.award_clan_xp_for_user(UUID, INTEGER);

-- 2. Clean resolve_prediction (no more challenge auto-resolve or clan XP)
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
  payout INTEGER;
  winners_count INTEGER := 0;
  total_paid INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  SELECT * INTO pred FROM public.predictions WHERE id = pred_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Prediction not found'); END IF;
  IF pred.status != 'active' THEN RETURN json_build_object('error', 'Prediction already resolved'); END IF;
  IF outcome NOT IN ('yes', 'no') THEN RETURN json_build_object('error', 'Invalid outcome'); END IF;

  SELECT * INTO caller_profile FROM public.profiles WHERE id = auth.uid();

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

  UPDATE public.predictions
  SET status = CASE WHEN outcome = 'yes' THEN 'resolved_yes' ELSE 'resolved_no' END,
      resolved_at = NOW()
  WHERE id = pred_id;

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

  UPDATE public.profiles SET reputation = reputation + 2
  WHERE id IN (SELECT b.user_id FROM public.bets b WHERE b.prediction_id = pred_id AND b.position = losing_side);

  RETURN json_build_object(
    'success', true, 'outcome', outcome,
    'winners', winners_count, 'total_paid', total_paid, 'total_pool', total_pool,
    'mode', pred.mode
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Clean finalize_disputed_prediction (no more challenge reversal, fix refund type)
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

  SELECT COUNT(*) INTO yes_votes FROM public.prediction_disputes WHERE prediction_id = pred_id AND vote = 'yes';
  SELECT COUNT(*) INTO no_votes FROM public.prediction_disputes WHERE prediction_id = pred_id AND vote = 'no';

  old_outcome := CASE WHEN pred.status = 'resolved_yes' THEN 'yes' ELSE 'no' END;

  -- Tie: refund everyone
  IF yes_votes = no_votes THEN
    FOR bet IN SELECT b.user_id, b.amount FROM public.bets b WHERE b.prediction_id = pred_id
    LOOP
      UPDATE public.profiles SET coins = coins + bet.amount WHERE id = bet.user_id;
      INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
      VALUES (bet.user_id, 'bet_won', bet.amount, pred_id, 'Dispute tie - refund');
    END LOOP;

    UPDATE public.predictions SET status = 'cancelled', disputed = true WHERE id = pred_id;
    RETURN json_build_object('success', true, 'result', 'tie_refund', 'yes_votes', yes_votes, 'no_votes', no_votes);
  END IF;

  IF yes_votes > no_votes THEN
    new_outcome := 'yes';
  ELSE
    new_outcome := 'no';
  END IF;

  IF new_outcome = old_outcome THEN
    RETURN json_build_object('success', true, 'result', 'confirmed', 'outcome', new_outcome, 'yes_votes', yes_votes, 'no_votes', no_votes);
  END IF;

  -- === REVERSE original resolution ===
  total_pool := pred.total_pool;

  winning_pool := CASE WHEN old_outcome = 'yes' THEN pred.total_yes ELSE pred.total_no END;
  IF winning_pool > 0 AND total_pool > 0 THEN
    FOR bet IN SELECT b.user_id, b.amount FROM public.bets b WHERE b.prediction_id = pred_id AND b.position = old_outcome
    LOOP
      payout := ROUND((bet.amount::NUMERIC / winning_pool::NUMERIC) * total_pool::NUMERIC);
      UPDATE public.profiles SET coins = GREATEST(0, coins - payout), reputation = GREATEST(0, reputation - 10) WHERE id = bet.user_id;
    END LOOP;
  END IF;

  -- === PAY new correct winners ===
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
