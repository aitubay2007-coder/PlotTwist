-- ================================================================
-- PlotTwist MVP — CLEAN REBUILD
-- Run this ENTIRE file in Supabase SQL Editor → New Query → Run
--
-- WARNING: This drops and recreates all RPC functions.
-- Tables are created with IF NOT EXISTS for safety.
-- ================================================================


-- =========================================================
-- 0. EXTENSIONS
-- =========================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =========================================================
-- 1. PROFILES (alter existing to match new schema)
-- =========================================================
-- Rename coins → coins_balance if old column exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='coins') THEN
    ALTER TABLE public.profiles RENAME COLUMN coins TO coins_balance;
  END IF;
END $$;

-- Ensure coins_balance exists with correct default
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coins_balance INT NOT NULL DEFAULT 1000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_daily_bonus DATE;

-- Drop columns we no longer need (safe — IF EXISTS)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS reputation;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS country;

-- Ensure non-negative balance
DO $$ BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_coins_nonnegative;
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_balance_nonneg;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
UPDATE public.profiles SET coins_balance = 0 WHERE coins_balance < 0;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_balance_nonneg CHECK (coins_balance >= 0);


-- =========================================================
-- 2. PREDICTIONS (recreate with clean schema)
-- =========================================================
-- Drop ALL old constraints that may conflict (including the original status check)
DO $$ BEGIN
  ALTER TABLE public.predictions DROP CONSTRAINT IF EXISTS predictions_visibility_check;
  ALTER TABLE public.predictions DROP CONSTRAINT IF EXISTS predictions_type_check;
  ALTER TABLE public.predictions DROP CONSTRAINT IF EXISTS predictions_status_check;
  ALTER TABLE public.predictions DROP CONSTRAINT IF EXISTS predictions_status_check_v2;
  ALTER TABLE public.predictions DROP CONSTRAINT IF EXISTS predictions_mode_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add new columns
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'official';
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS resolved_outcome TEXT;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS visibility_token TEXT;

-- Migrate data from old columns to new
DO $$ BEGIN
  -- Copy deadline → deadline_at if deadline exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='predictions' AND column_name='deadline') THEN
    UPDATE public.predictions SET deadline_at = deadline::timestamptz WHERE deadline_at IS NULL AND deadline IS NOT NULL;
  END IF;

  -- Map old mode/visibility to new type
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='predictions' AND column_name='mode') THEN
    UPDATE public.predictions SET type = 'private' WHERE mode = 'unofficial' OR visibility = 'private';
    UPDATE public.predictions SET type = 'official' WHERE mode = 'official' AND (visibility IS NULL OR visibility = 'public');
  END IF;

  -- Map old status to new status + resolved_outcome
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='predictions' AND column_name='status') THEN
    UPDATE public.predictions SET resolved_outcome = 'yes' WHERE status = 'resolved_yes';
    UPDATE public.predictions SET resolved_outcome = 'no' WHERE status = 'resolved_no';
    UPDATE public.predictions SET status = 'resolved' WHERE status IN ('resolved_yes', 'resolved_no', 'cancelled');
    UPDATE public.predictions SET status = 'open' WHERE status = 'active';
  END IF;
END $$;

-- Apply constraints
DO $$ BEGIN
  ALTER TABLE public.predictions ADD CONSTRAINT predictions_type_check CHECK (type IN ('official', 'private'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.predictions ADD CONSTRAINT predictions_status_check_v2 CHECK (status IN ('open', 'resolved'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drop old columns we no longer need
ALTER TABLE public.predictions DROP COLUMN IF EXISTS deadline;
ALTER TABLE public.predictions DROP COLUMN IF EXISTS mode;
ALTER TABLE public.predictions DROP COLUMN IF EXISTS visibility;
ALTER TABLE public.predictions DROP COLUMN IF EXISTS show_id;
ALTER TABLE public.predictions DROP COLUMN IF EXISTS disputed;
ALTER TABLE public.predictions DROP COLUMN IF EXISTS resolved_at;
ALTER TABLE public.predictions DROP COLUMN IF EXISTS total_yes;
ALTER TABLE public.predictions DROP COLUMN IF EXISTS total_no;
ALTER TABLE public.predictions DROP COLUMN IF EXISTS total_pool;


-- =========================================================
-- 3. BETS (alter to match new schema)
-- =========================================================
-- Rename position → outcome if old column exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bets' AND column_name='position' AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bets' AND column_name='outcome')) THEN
    ALTER TABLE public.bets RENAME COLUMN position TO outcome;
  END IF;
END $$;

ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS outcome TEXT;

-- Remove duplicate bets (keep the first one per user per prediction)
DELETE FROM public.bets a USING public.bets b
WHERE a.prediction_id = b.prediction_id
  AND a.user_id = b.user_id
  AND a.created_at > b.created_at;

-- One bet per user per prediction
DO $$ BEGIN
  ALTER TABLE public.bets ADD CONSTRAINT bets_one_per_user UNIQUE (prediction_id, user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Min bet amount
DO $$ BEGIN
  ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_min_amount;
  ALTER TABLE public.bets ADD CONSTRAINT bets_min_amount CHECK (amount >= 10);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- =========================================================
-- 4. TRANSACTIONS (alter to match new schema)
-- =========================================================
-- Drop old type constraint FIRST so we can update values
DO $$ BEGIN
  ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add delta column
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS delta INT;

-- Migrate old data: amount → delta based on type
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='amount') THEN
    UPDATE public.transactions SET delta = -amount WHERE type IN ('bet_placed', 'challenge_sent', 'challenge_accepted') AND delta IS NULL;
    UPDATE public.transactions SET delta = amount WHERE type NOT IN ('bet_placed', 'challenge_sent', 'challenge_accepted') AND delta IS NULL;

    -- Normalize old type values to new enum
    UPDATE public.transactions SET type = 'bet' WHERE type = 'bet_placed';
    UPDATE public.transactions SET type = 'payout' WHERE type IN ('bet_won', 'challenge_won');
    UPDATE public.transactions SET type = 'bonus' WHERE type IN ('signup_bonus', 'daily_bonus');
    UPDATE public.transactions SET type = 'refund' WHERE type = 'challenge_refund';
  END IF;
END $$;

ALTER TABLE public.transactions ALTER COLUMN delta SET NOT NULL;

-- Drop old columns
ALTER TABLE public.transactions DROP COLUMN IF EXISTS amount;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS reference_id;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS description;


-- =========================================================
-- 5. DROP LEGACY TABLES (safe — IF EXISTS)
-- =========================================================
DROP TABLE IF EXISTS public.prediction_disputes CASCADE;
DROP TABLE IF EXISTS public.prediction_comments CASCADE;
DROP TABLE IF EXISTS public.challenges CASCADE;
DROP TABLE IF EXISTS public.clan_members CASCADE;
DROP TABLE IF EXISTS public.clan_chat_messages CASCADE;
DROP TABLE IF EXISTS public.clans CASCADE;
DROP TABLE IF EXISTS public.shows CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;


-- =========================================================
-- 6. DROP ALL LEGACY RPC FUNCTIONS
-- =========================================================
DROP FUNCTION IF EXISTS public.place_bet(UUID, UUID, TEXT, INT);
DROP FUNCTION IF EXISTS public.resolve_prediction(UUID, TEXT);
DROP FUNCTION IF EXISTS public.dispute_prediction(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.finalize_disputed_prediction(UUID);
DROP FUNCTION IF EXISTS public.claim_daily_bonus(UUID);
DROP FUNCTION IF EXISTS public.increment_coins(UUID, INT);
DROP FUNCTION IF EXISTS public.accept_challenge(UUID);
DROP FUNCTION IF EXISTS public.decline_challenge(UUID);
DROP FUNCTION IF EXISTS public.award_clan_xp_for_user(UUID, INT);
DROP FUNCTION IF EXISTS public.add_clan_xp(UUID, INT);


-- =========================================================
-- 7. RPC: create_prediction
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_prediction(
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_type TEXT DEFAULT 'official',
  p_deadline_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_token TEXT := NULL;
  v_row public.predictions;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  IF p_type NOT IN ('official', 'private') THEN
    RETURN json_build_object('error', 'Type must be official or private');
  END IF;

  IF p_deadline_at IS NULL OR p_deadline_at <= NOW() THEN
    RETURN json_build_object('error', 'Deadline must be in the future');
  END IF;

  IF p_type = 'private' THEN
    v_token := replace(gen_random_uuid()::text, '-', '');
  END IF;

  INSERT INTO public.predictions (creator_id, type, title, description, status, deadline_at, visibility_token)
  VALUES (auth.uid(), p_type, p_title, p_description, 'open', p_deadline_at, v_token)
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================
-- 8. RPC: place_bet
-- =========================================================
CREATE OR REPLACE FUNCTION public.place_bet(
  p_prediction_id UUID,
  p_outcome TEXT,
  p_amount INT
)
RETURNS JSON AS $$
DECLARE
  v_pred public.predictions;
  v_balance INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  IF p_outcome NOT IN ('yes', 'no') THEN
    RETURN json_build_object('error', 'Outcome must be yes or no');
  END IF;

  IF p_amount < 10 THEN
    RETURN json_build_object('error', 'Minimum bet is 10');
  END IF;

  -- Lock prediction row
  SELECT * INTO v_pred FROM public.predictions WHERE id = p_prediction_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Prediction not found');
  END IF;

  IF v_pred.status != 'open' THEN
    RETURN json_build_object('error', 'Prediction is not open');
  END IF;

  IF v_pred.deadline_at <= NOW() THEN
    RETURN json_build_object('error', 'Deadline has passed');
  END IF;

  -- Check duplicate bet
  IF EXISTS (SELECT 1 FROM public.bets WHERE prediction_id = p_prediction_id AND user_id = auth.uid()) THEN
    RETURN json_build_object('error', 'You already placed a bet');
  END IF;

  -- Lock user balance
  SELECT coins_balance INTO v_balance FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF v_balance < p_amount THEN
    RETURN json_build_object('error', 'Insufficient coins');
  END IF;

  -- Deduct balance
  UPDATE public.profiles SET coins_balance = coins_balance - p_amount WHERE id = auth.uid();

  -- Insert bet
  INSERT INTO public.bets (prediction_id, user_id, outcome, amount)
  VALUES (p_prediction_id, auth.uid(), p_outcome, p_amount);

  -- Insert transaction
  INSERT INTO public.transactions (user_id, type, delta)
  VALUES (auth.uid(), 'bet', -p_amount);

  RETURN json_build_object('success', true, 'remaining', v_balance - p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================
-- 9. RPC: resolve_official
-- =========================================================
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

  -- Calculate pools
  SELECT COALESCE(SUM(amount), 0) INTO v_total_pool FROM public.bets WHERE prediction_id = p_prediction_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_winners_pool FROM public.bets WHERE prediction_id = p_prediction_id AND outcome = p_outcome;
  SELECT COUNT(*) INTO v_winner_count FROM public.bets WHERE prediction_id = p_prediction_id AND outcome = p_outcome;

  -- Pay winners or refund everyone if no winners
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

  -- Mark resolved
  UPDATE public.predictions SET status = 'resolved', resolved_outcome = p_outcome WHERE id = p_prediction_id;

  RETURN json_build_object('success', true, 'winners', v_winners, 'total_paid', v_paid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================
-- 10. RPC: resolve_private
-- =========================================================
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

  -- Calculate pools
  SELECT COALESCE(SUM(amount), 0) INTO v_total_pool FROM public.bets WHERE prediction_id = p_prediction_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_winners_pool FROM public.bets WHERE prediction_id = p_prediction_id AND outcome = p_outcome;
  SELECT COUNT(*) INTO v_winner_count FROM public.bets WHERE prediction_id = p_prediction_id AND outcome = p_outcome;

  -- Pay winners or refund everyone if no winners
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


-- =========================================================
-- 11. RPC: claim_daily_bonus
-- =========================================================
CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
RETURNS JSON AS $$
DECLARE
  v_last DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  SELECT last_daily_bonus INTO v_last FROM public.profiles WHERE id = auth.uid() FOR UPDATE;

  IF v_last IS NOT NULL AND v_last >= CURRENT_DATE THEN
    RETURN json_build_object('error', 'already_claimed');
  END IF;

  UPDATE public.profiles
  SET coins_balance = coins_balance + 50, last_daily_bonus = CURRENT_DATE
  WHERE id = auth.uid();

  INSERT INTO public.transactions (user_id, type, delta)
  VALUES (auth.uid(), 'bonus', 50);

  RETURN json_build_object('success', true, 'amount', 50);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================
-- 12. RPC: get_private_prediction (access by token)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_private_prediction(p_token TEXT)
RETURNS JSON AS $$
DECLARE
  v_pred public.predictions;
  v_bets JSON;
BEGIN
  SELECT * INTO v_pred FROM public.predictions
  WHERE visibility_token = p_token AND type = 'private';

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Not found');
  END IF;

  SELECT json_agg(row_to_json(b)) INTO v_bets
  FROM (
    SELECT b.id, b.user_id, b.outcome, b.amount, b.created_at, p.username
    FROM public.bets b
    JOIN public.profiles p ON p.id = b.user_id
    WHERE b.prediction_id = v_pred.id
    ORDER BY b.created_at
  ) b;

  RETURN json_build_object(
    'prediction', row_to_json(v_pred),
    'bets', COALESCE(v_bets, '[]'::json),
    'creator', (SELECT username FROM public.profiles WHERE id = v_pred.creator_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================
-- 13. RLS POLICIES (drop all old, create clean)
-- =========================================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles readable" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- PREDICTIONS
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read predictions" ON public.predictions;
DROP POLICY IF EXISTS "predictions_select_official" ON public.predictions;
DROP POLICY IF EXISTS "predictions_select" ON public.predictions;
DROP POLICY IF EXISTS "predictions_insert" ON public.predictions;
DROP POLICY IF EXISTS "Authenticated users can create predictions" ON public.predictions;

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

-- BETS
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read bets" ON public.bets;
DROP POLICY IF EXISTS "bets_select" ON public.bets;
DROP POLICY IF EXISTS "bets_insert" ON public.bets;
DROP POLICY IF EXISTS "Authenticated users can place bets" ON public.bets;

CREATE POLICY "bets_select" ON public.bets FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.can_read_bet_for_prediction(auth.uid(), prediction_id)
  );

-- TRANSACTIONS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;

CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);


-- =========================================================
-- 14. INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_predictions_type_status ON public.predictions(type, status);
CREATE INDEX IF NOT EXISTS idx_bets_prediction ON public.bets(prediction_id);
CREATE INDEX IF NOT EXISTS idx_bets_user ON public.bets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_token ON public.predictions(visibility_token) WHERE visibility_token IS NOT NULL;


-- =========================================================
-- 15. AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, coins_balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8)),
    1000
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.transactions (user_id, type, delta)
  VALUES (NEW.id, 'bonus', 1000);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =========================================================
-- DONE
-- =========================================================
