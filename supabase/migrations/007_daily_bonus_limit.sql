-- PlotTwist: Fix daily bonus exploit + challenge accept escrow
-- Run this in Supabase SQL Editor

-- 1. Add last_daily_bonus column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_daily_bonus DATE;

-- 2. RPC: Claim daily bonus (once per day)
CREATE OR REPLACE FUNCTION public.claim_daily_bonus(user_id_param UUID)
RETURNS JSON AS $$
DECLARE
  last_claim DATE;
BEGIN
  SELECT last_daily_bonus INTO last_claim FROM public.profiles WHERE id = user_id_param;

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

-- 3. RPC: Accept challenge (escrows challenged user's coins)
CREATE OR REPLACE FUNCTION public.accept_challenge(challenge_id_param UUID)
RETURNS JSON AS $$
DECLARE
  ch RECORD;
  challenged_coins INTEGER;
BEGIN
  SELECT * INTO ch FROM public.challenges WHERE id = challenge_id_param;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Challenge not found'); END IF;
  IF ch.status != 'pending' THEN RETURN json_build_object('error', 'Challenge is not pending'); END IF;
  IF ch.challenged_id != auth.uid() THEN RETURN json_build_object('error', 'Not your challenge'); END IF;

  -- Check challenged user has enough coins
  SELECT coins INTO challenged_coins FROM public.profiles WHERE id = ch.challenged_id FOR UPDATE;
  IF challenged_coins < ch.amount THEN
    RETURN json_build_object('error', 'Insufficient coins');
  END IF;

  -- Deduct coins from challenged user (escrow)
  UPDATE public.profiles SET coins = coins - ch.amount WHERE id = ch.challenged_id;

  -- Log transaction
  INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
  VALUES (ch.challenged_id, 'challenge_accepted', ch.amount, challenge_id_param, 'Challenge accepted - coins escrowed');

  -- Update status
  UPDATE public.challenges SET status = 'accepted' WHERE id = challenge_id_param;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
