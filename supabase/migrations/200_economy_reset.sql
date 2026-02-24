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

CREATE OR REPLACE FUNCTION public.user_has_bet_on_prediction(p_user_id UUID, p_prediction_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bets b
    WHERE b.user_id = p_user_id
      AND b.prediction_id = p_prediction_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_bet_for_prediction(p_user_id UUID, p_prediction_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.predictions p
    WHERE p.id = p_prediction_id
      AND (p.type = 'official' OR p.creator_id = p_user_id)
  );
$$;

CREATE POLICY "predictions_select" ON public.predictions FOR SELECT
  USING (
    type = 'official'
    OR creator_id = auth.uid()
    OR public.user_has_bet_on_prediction(auth.uid(), id)
  );

DROP POLICY IF EXISTS "bets_select" ON public.bets;
CREATE POLICY "bets_select" ON public.bets FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.can_read_bet_for_prediction(auth.uid(), prediction_id)
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
  v_winner_count INT := 0;
  v_winner_idx INT := 0;
  v_remaining_pool INT := 0;
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
  SELECT COUNT(*) INTO v_winner_count FROM public.bets WHERE prediction_id = p_prediction_id AND outcome = p_outcome;

  IF v_winners_pool > 0 AND v_total_pool > 0 THEN
    v_remaining_pool := v_total_pool;
    FOR v_bet IN
      SELECT user_id, amount FROM public.bets
      WHERE prediction_id = p_prediction_id AND outcome = p_outcome
      ORDER BY user_id
    LOOP
      v_winner_idx := v_winner_idx + 1;
      IF v_winner_idx < v_winner_count THEN
        v_payout := FLOOR((v_bet.amount::NUMERIC * v_total_pool::NUMERIC) / v_winners_pool::NUMERIC);
        v_remaining_pool := v_remaining_pool - v_payout;
      ELSE
        v_payout := GREATEST(v_remaining_pool, 0);
      END IF;
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
  v_winner_count INT := 0;
  v_winner_idx INT := 0;
  v_remaining_pool INT := 0;
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
  SELECT COUNT(*) INTO v_winner_count FROM public.bets WHERE prediction_id = p_prediction_id AND outcome = p_outcome;

  IF v_winners_pool > 0 AND v_total_pool > 0 THEN
    v_remaining_pool := v_total_pool;
    FOR v_bet IN
      SELECT user_id, amount FROM public.bets
      WHERE prediction_id = p_prediction_id AND outcome = p_outcome
      ORDER BY user_id
    LOOP
      v_winner_idx := v_winner_idx + 1;
      IF v_winner_idx < v_winner_count THEN
        v_payout := FLOOR((v_bet.amount::NUMERIC * v_total_pool::NUMERIC) / v_winners_pool::NUMERIC);
        v_remaining_pool := v_remaining_pool - v_payout;
      ELSE
        v_payout := GREATEST(v_remaining_pool, 0);
      END IF;
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
