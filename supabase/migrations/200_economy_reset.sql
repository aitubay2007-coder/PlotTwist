-- ================================================================
-- PlotTwist — ECONOMY RESET
-- Resets all users to 1000 coins, clears bets, predictions, transactions.
-- Run in Supabase SQL Editor ONCE before launch.
-- ================================================================

-- 1. Delete all bets
DELETE FROM public.bets;

-- 2. Delete all predictions
DELETE FROM public.predictions;

-- 3. Delete all transactions
DELETE FROM public.transactions;

-- 4. Reset all profiles to 1000 coins, clear daily bonus
UPDATE public.profiles
SET coins_balance = 1000,
    last_daily_bonus = NULL;

-- 5. Insert a fresh "bonus" transaction for each user
INSERT INTO public.transactions (user_id, type, delta)
SELECT id, 'bonus', 1000 FROM public.profiles;

-- 6. Fix RLS: drop old official-only policy, create new one
DROP POLICY IF EXISTS "predictions_select_official" ON public.predictions;
DROP POLICY IF EXISTS "predictions_select" ON public.predictions;

CREATE POLICY "predictions_select" ON public.predictions FOR SELECT
  USING (
    type = 'official'
    OR creator_id = auth.uid()
    OR id IN (SELECT prediction_id FROM public.bets WHERE user_id = auth.uid())
  );

-- 7. Recreate resolve functions with refund logic for 0 winners
CREATE OR REPLACE FUNCTION public.resolve_official(
  p_prediction_id UUID,
  p_outcome TEXT
)
RETURNS JSON AS $$
DECLARE
  v_pred public.predictions;
  v_caller public.profiles;
  v_total_pool INT;
  v_winners_pool INT;
  v_bet RECORD;
  v_payout INT;
  v_winners INT := 0;
  v_paid INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  IF p_outcome NOT IN ('yes', 'no') THEN
    RETURN json_build_object('error', 'Invalid outcome');
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_caller.is_admin, false) THEN
    RETURN json_build_object('error', 'Only admins can resolve official predictions');
  END IF;

  SELECT * INTO v_pred FROM public.predictions WHERE id = p_prediction_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Not found'); END IF;
  IF v_pred.type != 'official' THEN RETURN json_build_object('error', 'Not an official prediction'); END IF;
  IF v_pred.status != 'open' THEN RETURN json_build_object('error', 'Already resolved'); END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_pool FROM public.bets WHERE prediction_id = p_prediction_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_winners_pool FROM public.bets WHERE prediction_id = p_prediction_id AND outcome = p_outcome;

  IF v_winners_pool > 0 AND v_total_pool > 0 THEN
    FOR v_bet IN
      SELECT user_id, amount FROM public.bets
      WHERE prediction_id = p_prediction_id AND outcome = p_outcome
    LOOP
      v_payout := ROUND((v_bet.amount::NUMERIC / v_winners_pool::NUMERIC) * v_total_pool::NUMERIC);
      UPDATE public.profiles SET coins_balance = coins_balance + v_payout WHERE id = v_bet.user_id;
      INSERT INTO public.transactions (user_id, type, delta)
      VALUES (v_bet.user_id, 'payout', v_payout);
      v_winners := v_winners + 1;
      v_paid := v_paid + v_payout;
    END LOOP;
  ELSIF v_total_pool > 0 AND v_winners_pool = 0 THEN
    FOR v_bet IN
      SELECT user_id, amount FROM public.bets WHERE prediction_id = p_prediction_id
    LOOP
      UPDATE public.profiles SET coins_balance = coins_balance + v_bet.amount WHERE id = v_bet.user_id;
      INSERT INTO public.transactions (user_id, type, delta)
      VALUES (v_bet.user_id, 'refund', v_bet.amount);
      v_paid := v_paid + v_bet.amount;
    END LOOP;
  END IF;

  UPDATE public.predictions SET status = 'resolved', resolved_outcome = p_outcome WHERE id = p_prediction_id;

  RETURN json_build_object('success', true, 'winners', v_winners, 'total_paid', v_paid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.resolve_private(
  p_prediction_id UUID,
  p_outcome TEXT
)
RETURNS JSON AS $$
DECLARE
  v_pred public.predictions;
  v_total_pool INT;
  v_winners_pool INT;
  v_bet RECORD;
  v_payout INT;
  v_winners INT := 0;
  v_paid INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  IF p_outcome NOT IN ('yes', 'no') THEN
    RETURN json_build_object('error', 'Invalid outcome');
  END IF;

  SELECT * INTO v_pred FROM public.predictions WHERE id = p_prediction_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Not found'); END IF;
  IF v_pred.type != 'private' THEN RETURN json_build_object('error', 'Not a private prediction'); END IF;
  IF v_pred.creator_id != auth.uid() THEN RETURN json_build_object('error', 'Only the creator can resolve'); END IF;
  IF v_pred.status != 'open' THEN RETURN json_build_object('error', 'Already resolved'); END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_pool FROM public.bets WHERE prediction_id = p_prediction_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_winners_pool FROM public.bets WHERE prediction_id = p_prediction_id AND outcome = p_outcome;

  IF v_winners_pool > 0 AND v_total_pool > 0 THEN
    FOR v_bet IN
      SELECT user_id, amount FROM public.bets
      WHERE prediction_id = p_prediction_id AND outcome = p_outcome
    LOOP
      v_payout := ROUND((v_bet.amount::NUMERIC / v_winners_pool::NUMERIC) * v_total_pool::NUMERIC);
      UPDATE public.profiles SET coins_balance = coins_balance + v_payout WHERE id = v_bet.user_id;
      INSERT INTO public.transactions (user_id, type, delta)
      VALUES (v_bet.user_id, 'payout', v_payout);
      v_winners := v_winners + 1;
      v_paid := v_paid + v_payout;
    END LOOP;
  ELSIF v_total_pool > 0 AND v_winners_pool = 0 THEN
    FOR v_bet IN
      SELECT user_id, amount FROM public.bets WHERE prediction_id = p_prediction_id
    LOOP
      UPDATE public.profiles SET coins_balance = coins_balance + v_bet.amount WHERE id = v_bet.user_id;
      INSERT INTO public.transactions (user_id, type, delta)
      VALUES (v_bet.user_id, 'refund', v_bet.amount);
      v_paid := v_paid + v_bet.amount;
    END LOOP;
  END IF;

  UPDATE public.predictions SET status = 'resolved', resolved_outcome = p_outcome WHERE id = p_prediction_id;

  RETURN json_build_object('success', true, 'winners', v_winners, 'total_paid', v_paid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done! All users have 1000 coins, clean slate.
