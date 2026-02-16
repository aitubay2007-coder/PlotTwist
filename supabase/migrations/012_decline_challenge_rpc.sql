-- decline_challenge RPC: atomically decline + refund challenger
-- Run in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.decline_challenge(challenge_id_param UUID)
RETURNS JSON AS $$
DECLARE
  ch RECORD;
BEGIN
  -- Verify caller is the challenged user and challenge is pending
  SELECT * INTO ch
  FROM public.challenges
  WHERE id = challenge_id_param
    AND challenged_id = auth.uid()
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Challenge not found or not yours');
  END IF;

  -- Update status to declined
  UPDATE public.challenges SET status = 'declined' WHERE id = challenge_id_param;

  -- Refund challenger's escrowed coins
  UPDATE public.profiles
  SET coins = coins + ch.amount
  WHERE id = ch.challenger_id;

  -- Log refund transaction
  INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
  VALUES (ch.challenger_id, 'challenge_refund', ch.amount, challenge_id_param, 'Challenge declined — refund');

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix: drop the old bets policy by its correct original name
DROP POLICY IF EXISTS "Authenticated users can create bets" ON public.bets;
