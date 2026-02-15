-- PlotTwist: Secure all RPCs with auth.uid() checks
-- Run this in Supabase SQL Editor
-- CRITICAL: Prevents users from calling RPCs with someone else's user_id

-- ============================================
-- 1. SECURE increment_coins
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_coins(user_id_param UUID, amount_param INTEGER)
RETURNS VOID AS $$
DECLARE
  current_coins INTEGER;
BEGIN
  -- Auth check: only allow users to modify their own coins
  IF user_id_param != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: cannot modify another user''s coins';
  END IF;

  SELECT coins INTO current_coins FROM public.profiles WHERE id = user_id_param FOR UPDATE;

  -- If deducting, check balance
  IF amount_param < 0 AND (current_coins + amount_param) < 0 THEN
    RAISE EXCEPTION 'Insufficient coins: have %, need %', current_coins, ABS(amount_param);
  END IF;

  UPDATE public.profiles
  SET coins = coins + amount_param
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. SECURE place_bet
-- ============================================
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
BEGIN
  -- Auth check: only allow users to place bets for themselves
  IF user_id_param != auth.uid() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Validate position
  IF position_param NOT IN ('yes', 'no') THEN
    RETURN json_build_object('error', 'Invalid position');
  END IF;
  
  -- Validate amount
  IF amount_param < 10 THEN
    RETURN json_build_object('error', 'Minimum bet is 10 coins');
  END IF;

  -- Check prediction is active
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

  -- Check balance (lock row to prevent race conditions)
  SELECT coins INTO user_coins FROM public.profiles WHERE id = user_id_param FOR UPDATE;
  IF user_coins < amount_param THEN
    RETURN json_build_object('error', 'Insufficient coins');
  END IF;

  -- Deduct coins
  UPDATE public.profiles SET coins = coins - amount_param WHERE id = user_id_param;

  -- Insert bet
  INSERT INTO public.bets (user_id, prediction_id, position, amount)
  VALUES (user_id_param, prediction_id_param, position_param, amount_param);

  -- Update prediction pool
  IF position_param = 'yes' THEN
    UPDATE public.predictions SET total_yes = total_yes + amount_param, total_pool = total_pool + amount_param WHERE id = prediction_id_param;
  ELSE
    UPDATE public.predictions SET total_no = total_no + amount_param, total_pool = total_pool + amount_param WHERE id = prediction_id_param;
  END IF;

  -- Log transaction
  INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
  VALUES (user_id_param, 'bet_placed', amount_param, prediction_id_param, 'Bet placed: ' || UPPER(position_param));

  RETURN json_build_object('success', true, 'remaining_coins', user_coins - amount_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. SECURE claim_daily_bonus + fix race condition
-- ============================================
CREATE OR REPLACE FUNCTION public.claim_daily_bonus(user_id_param UUID)
RETURNS JSON AS $$
DECLARE
  last_claim DATE;
BEGIN
  -- Auth check: only allow users to claim their own bonus
  IF user_id_param != auth.uid() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Lock row to prevent double-claim race condition
  SELECT last_daily_bonus INTO last_claim FROM public.profiles WHERE id = user_id_param FOR UPDATE;

  IF last_claim IS NOT NULL AND last_claim = CURRENT_DATE THEN
    RETURN json_build_object('error', 'already_claimed');
  END IF;

  UPDATE public.profiles
  SET coins = coins + 50, last_daily_bonus = CURRENT_DATE
  WHERE id = user_id_param;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (user_id_param, 'daily_bonus', 50, 'Daily bonus');

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. SECURE award_clan_xp_for_user
-- ============================================
CREATE OR REPLACE FUNCTION public.award_clan_xp_for_user(user_id_param UUID, xp_amount INTEGER)
RETURNS VOID AS $$
DECLARE
  user_clan_id UUID;
BEGIN
  -- Auth check: only allow users to award XP for themselves
  IF user_id_param != auth.uid() THEN
    RETURN;
  END IF;

  -- Cap XP amount to prevent abuse (max 50 XP per call)
  IF xp_amount > 50 THEN
    xp_amount := 50;
  END IF;
  IF xp_amount < 1 THEN
    RETURN;
  END IF;

  SELECT cm.clan_id INTO user_clan_id
  FROM public.clan_members cm WHERE cm.user_id = user_id_param LIMIT 1;
  IF user_clan_id IS NOT NULL THEN
    PERFORM public.add_clan_xp(user_clan_id, xp_amount);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Restrict transactions INSERT to own user_id
-- ============================================
DO $$
BEGIN
  -- Drop the overly permissive policy if it exists
  DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON public.transactions;
  
  -- Create a proper policy that only allows inserting rows for yourself
  CREATE POLICY "Users can insert own transactions" ON public.transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
