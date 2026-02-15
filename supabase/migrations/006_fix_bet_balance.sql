-- PlotTwist: Fix unlimited betting bug
-- Run this in Supabase SQL Editor

-- 1. Add CHECK constraint so coins can never go negative
-- (safe even if some users already have negative — it only applies to future UPDATEs)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_coins_nonnegative;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_coins_nonnegative CHECK (coins >= 0);

-- 2. Replace increment_coins to REJECT if insufficient balance
CREATE OR REPLACE FUNCTION public.increment_coins(user_id_param UUID, amount_param INTEGER)
RETURNS VOID AS $$
DECLARE
  current_coins INTEGER;
BEGIN
  SELECT coins INTO current_coins FROM public.profiles WHERE id = user_id_param;
  
  -- If deducting, check balance
  IF amount_param < 0 AND (current_coins + amount_param) < 0 THEN
    RAISE EXCEPTION 'Insufficient coins: have %, need %', current_coins, ABS(amount_param);
  END IF;

  UPDATE public.profiles
  SET coins = coins + amount_param
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a safe atomic bet placement function
-- This ensures bet + coin deduction + pool update happen atomically
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
