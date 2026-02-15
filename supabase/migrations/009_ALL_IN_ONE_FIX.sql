-- ================================================================
-- PlotTwist: ALL-IN-ONE FIX (combines migrations 005-008)
-- Run this ENTIRE file in Supabase SQL Editor → New Query → Run
-- ================================================================

-- ==========================================
-- PART 1: Tables & Columns (safe to re-run)
-- ==========================================

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  reference_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, read) WHERE read = false;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Prediction comments table
CREATE TABLE IF NOT EXISTS public.prediction_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prediction_comments_pred ON public.prediction_comments(prediction_id, created_at);
ALTER TABLE public.prediction_comments ENABLE ROW LEVEL SECURITY;

-- Add last_daily_bonus column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_daily_bonus DATE;

-- Add coins non-negative constraint
DO $$ BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_coins_nonnegative;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_coins_nonnegative CHECK (coins >= 0);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Fix any negative coin balances first
UPDATE public.profiles SET coins = 0 WHERE coins < 0;

-- ==========================================
-- PART 2: RLS Policies (safe to re-run with DO blocks)
-- ==========================================

DO $$ BEGIN
  CREATE POLICY "Users can see own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Comments are publicly readable" ON public.prediction_comments FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can comment" ON public.prediction_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own comments" ON public.prediction_comments FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can leave clans" ON public.clan_members FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Creators can delete own clans" ON public.clans FOR DELETE USING (auth.uid() = creator_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Restrict transactions INSERT to own user_id
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON public.transactions;
  CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ==========================================
-- PART 3: RPC Functions (CREATE OR REPLACE = safe to re-run)
-- ==========================================

-- 3a. SECURE increment_coins
CREATE OR REPLACE FUNCTION public.increment_coins(user_id_param UUID, amount_param INTEGER)
RETURNS VOID AS $$
DECLARE
  current_coins INTEGER;
BEGIN
  IF user_id_param != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT coins INTO current_coins FROM public.profiles WHERE id = user_id_param FOR UPDATE;

  IF amount_param < 0 AND (current_coins + amount_param) < 0 THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  UPDATE public.profiles SET coins = coins + amount_param WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3b. SECURE place_bet (atomic: checks balance, deducts, inserts bet, updates pool)
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

-- 3c. SECURE claim_daily_bonus (once per day, with race condition protection)
CREATE OR REPLACE FUNCTION public.claim_daily_bonus(user_id_param UUID)
RETURNS JSON AS $$
DECLARE
  last_claim DATE;
BEGIN
  IF user_id_param != auth.uid() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

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

-- 3d. SECURE accept_challenge (escrows challenged user's coins)
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

  SELECT coins INTO challenged_coins FROM public.profiles WHERE id = ch.challenged_id FOR UPDATE;
  IF challenged_coins < ch.amount THEN
    RETURN json_build_object('error', 'Insufficient coins');
  END IF;

  UPDATE public.profiles SET coins = coins - ch.amount WHERE id = ch.challenged_id;

  INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
  VALUES (ch.challenged_id, 'challenge_accepted', ch.amount, challenge_id_param, 'Challenge accepted - coins escrowed');

  UPDATE public.challenges SET status = 'accepted' WHERE id = challenge_id_param;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3e. SECURE award_clan_xp_for_user (with XP cap)
CREATE OR REPLACE FUNCTION public.award_clan_xp_for_user(user_id_param UUID, xp_amount INTEGER)
RETURNS VOID AS $$
DECLARE
  user_clan_id UUID;
BEGIN
  IF user_id_param != auth.uid() THEN
    RETURN;
  END IF;

  IF xp_amount > 50 THEN xp_amount := 50; END IF;
  IF xp_amount < 1 THEN RETURN; END IF;

  SELECT cm.clan_id INTO user_clan_id
  FROM public.clan_members cm WHERE cm.user_id = user_id_param LIMIT 1;
  IF user_clan_id IS NOT NULL THEN
    PERFORM public.add_clan_xp(user_clan_id, xp_amount);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3f. resolve_prediction (with challenge auto-resolve + clan XP)
CREATE OR REPLACE FUNCTION public.resolve_prediction(pred_id UUID, outcome TEXT)
RETURNS JSON AS $$
DECLARE
  pred RECORD;
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
  IF pred.creator_id != auth.uid() THEN RETURN json_build_object('error', 'Only the creator can resolve'); END IF;
  IF outcome NOT IN ('yes', 'no') THEN RETURN json_build_object('error', 'Invalid outcome'); END IF;

  winning_side := outcome;
  losing_side := CASE WHEN outcome = 'yes' THEN 'no' ELSE 'yes' END;
  winning_pool := CASE WHEN outcome = 'yes' THEN pred.total_yes ELSE pred.total_no END;
  total_pool := pred.total_pool;

  UPDATE public.predictions
  SET status = CASE WHEN outcome = 'yes' THEN 'resolved_yes' ELSE 'resolved_no' END
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

  SELECT cm.clan_id INTO creator_clan_id
  FROM public.clan_members cm WHERE cm.user_id = pred.creator_id LIMIT 1;
  IF creator_clan_id IS NOT NULL THEN
    PERFORM public.add_clan_xp(creator_clan_id, 10);
  END IF;

  RETURN json_build_object(
    'success', true, 'outcome', outcome,
    'winners', winners_count, 'total_paid', total_paid, 'total_pool', total_pool
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- DONE! All functions and tables are ready.
-- ==========================================
