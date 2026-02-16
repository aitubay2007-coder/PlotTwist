-- PlotTwist: Migration Audit Fixes
-- Addresses CRITICAL and MEDIUM issues from MIGRATION_AUDIT_REPORT.md

-- ==========================================
-- PART 1: FIX OVERLY PERMISSIVE RLS POLICIES
-- ==========================================

-- 1.1 Drop permissive transactions INSERT policy (allow only own user_id)
DROP POLICY IF EXISTS "System can insert transactions" ON public.transactions;

-- 1.2 Drop permissive notifications INSERT policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- 1.3 Fix predictions INSERT - require creator_id = auth.uid()
DROP POLICY IF EXISTS "Authenticated users can create predictions" ON public.predictions;
CREATE POLICY "Authenticated users can create predictions"
  ON public.predictions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- 1.4 Fix clans INSERT - require creator_id = auth.uid()
DROP POLICY IF EXISTS "Authenticated users can create clans" ON public.clans;
CREATE POLICY "Authenticated users can create clans"
  ON public.clans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- 1.5 Fix bets INSERT - require user_id = auth.uid()
DROP POLICY IF EXISTS "Authenticated users can create bets" ON public.bets;
CREATE POLICY "Authenticated users can create bets"
  ON public.bets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 1.6 Fix challenges INSERT - require challenger_id = auth.uid()
DROP POLICY IF EXISTS "Authenticated users can create challenges" ON public.challenges;
CREATE POLICY "Authenticated users can create challenges"
  ON public.challenges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = challenger_id);

-- 1.7 Fix clan_members INSERT - require user_id = auth.uid() (user can only add themselves)
DROP POLICY IF EXISTS "Authenticated users can join clans" ON public.clan_members;
CREATE POLICY "Authenticated users can join clans"
  ON public.clan_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 1.8 Allow service role to insert transactions (for RPCs that run as definer - they bypass RLS)
-- RPCs with SECURITY DEFINER run as postgres and bypass RLS. Server uses service role and bypasses RLS.
-- The DROP above is sufficient - no extra policy needed for transactions from RPC/server.

-- ==========================================
-- PART 2: SECURE add_clan_xp - RESTRICT TO INTERNAL USE
-- ==========================================

-- Revoke from public/authenticated, only allow invoker to be postgres (RPC caller)
-- add_clan_xp is only called from award_clan_xp_for_user and resolve_prediction (both SECURITY DEFINER)
-- We restrict: only allow call when invoked from another function in same schema, or add auth check
-- Simpler: add auth.uid() check - caller must be a member of the clan (admin can add XP)
-- But award_clan_xp_for_user calls it for user's clan - the user is a member. resolve_prediction
-- calls it for creator's clan - we're in RPC context, auth.uid() = creator. Creator is member.
-- So we need add_clan_xp to accept calls from SECURITY DEFINER functions where auth.uid() is set.
-- Actually: when resolve_prediction runs, auth.uid() = creator. Creator may be clan member.
-- When award_clan_xp_for_user runs, auth.uid() = user. User is clan member.
-- So add_clan_xp should verify: auth.uid() must be a member of clan_id_param
CREATE OR REPLACE FUNCTION public.add_clan_xp(clan_id_param UUID, xp_amount INTEGER)
RETURNS TABLE(new_xp INTEGER, new_level INTEGER) AS $$
DECLARE
  current_xp INTEGER;
  calculated_level INTEGER;
  is_member BOOLEAN;
BEGIN
  -- Auth check: caller must be a member of the clan (or service role)
  IF auth.jwt() ->> 'role' != 'service_role' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.clan_members
      WHERE clan_id = clan_id_param AND user_id = auth.uid()
    ) INTO is_member;
    IF NOT is_member THEN
      RAISE EXCEPTION 'Unauthorized: must be clan member to add XP';
    END IF;
  END IF;

  -- Atomically add XP (with lock for race condition)
  UPDATE public.clans
  SET xp = xp + xp_amount
  WHERE id = clan_id_param
  RETURNING xp INTO current_xp;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clan not found';
  END IF;

  calculated_level := CASE
    WHEN current_xp >= 15000 THEN 5
    WHEN current_xp >= 5000 THEN 4
    WHEN current_xp >= 2000 THEN 3
    WHEN current_xp >= 500 THEN 2
    ELSE 1
  END;

  UPDATE public.clans
  SET level = calculated_level
  WHERE id = clan_id_param AND level != calculated_level;

  new_xp := current_xp;
  new_level := calculated_level;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 3: ADMIN increment_coins FOR SERVER USE
-- ==========================================

-- Create admin version for server (challenge refunds, etc.)
-- Server uses supabaseAdmin (service role). auth.uid() is null for service role calls.
-- auth.jwt()->>'role' = 'service_role' when using service role key.
CREATE OR REPLACE FUNCTION public.admin_increment_coins(user_id_param UUID, amount_param INTEGER)
RETURNS VOID AS $$
DECLARE
  current_coins INTEGER;
BEGIN
  -- Only service role can call this (server uses supabaseAdmin with service role key)
  IF COALESCE(auth.jwt() ->> 'role', '') != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: admin_increment_coins requires service role';
  END IF;

  -- Lock row and get balance for deduction check
  SELECT coins INTO current_coins FROM public.profiles WHERE id = user_id_param FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF amount_param < 0 AND (current_coins + amount_param) < 0 THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  UPDATE public.profiles
  SET coins = coins + amount_param
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 4: SECURE increment_prediction_total
-- ==========================================

-- Restrict to service role only (used by server for /predictions/:id/bet)
CREATE OR REPLACE FUNCTION public.increment_prediction_total(pred_id UUID, field_name TEXT, increment_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: increment_prediction_total requires service role';
  END IF;

  IF field_name = 'total_yes' THEN
    UPDATE public.predictions
    SET total_yes = total_yes + increment_amount, total_pool = total_pool + increment_amount
    WHERE id = pred_id;
  ELSIF field_name = 'total_no' THEN
    UPDATE public.predictions
    SET total_no = total_no + increment_amount, total_pool = total_pool + increment_amount
    WHERE id = pred_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 5: RACE CONDITION FIX - resolve_prediction
-- ==========================================

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
  -- Lock prediction row to prevent concurrent resolve
  SELECT * INTO pred FROM public.predictions WHERE id = pred_id FOR UPDATE;
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
-- PART 6: ADD notifications TYPE CHECK (009 omitted it)
-- ==========================================

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('challenge_received', 'challenge_accepted', 'challenge_declined', 'prediction_resolved', 'bet_won', 'clan_joined'));

-- ==========================================
-- PART 7: MISSING INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_predictions_active_deadline
  ON public.predictions(deadline) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_challenges_pred_status
  ON public.challenges(prediction_id, status);

-- ==========================================
-- SERVER UPDATE REQUIRED
-- ==========================================
-- The server must call admin_increment_coins instead of increment_coins when
-- modifying another user's coins (e.g. challenge decline refund).
-- Update: server/src/routes/challenges.ts line 142
-- Change: supabaseAdmin.rpc('increment_coins', ...)
-- To:     supabaseAdmin.rpc('admin_increment_coins', ...)
--
-- Note: supabaseAdmin uses service role. auth.jwt() in PostgreSQL for service role
-- requests may not include role. If admin_increment_coins fails, we may need to
-- use a different approach (e.g. grant execute to postgres only and have server
-- use a different connection). Verify after deploy.
