-- PlotTwist: Critical Fixes + UX Features
-- Run this in Supabase SQL Editor

-- ==========================================
-- 1. CHALLENGE RESOLUTION (auto-resolve when prediction ends)
-- ==========================================

-- Replace resolve_prediction to also handle challenges + clan XP
CREATE OR REPLACE FUNCTION public.resolve_prediction(
  pred_id UUID,
  outcome TEXT
)
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

  -- Pay out bet winners
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

  -- *** AUTO-RESOLVE CHALLENGES ***
  FOR ch IN
    SELECT * FROM public.challenges
    WHERE prediction_id = pred_id AND status = 'accepted'
  LOOP
    -- Determine winner
    IF ch.challenger_position = winning_side THEN
      -- Challenger wins
      UPDATE public.profiles SET coins = coins + (ch.amount * 2), reputation = reputation + 15 WHERE id = ch.challenger_id;
      UPDATE public.profiles SET reputation = reputation + 3 WHERE id = ch.challenged_id;
      INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
      VALUES (ch.challenger_id, 'challenge_won', ch.amount * 2, ch.id, 'Won challenge');
    ELSE
      -- Challenged wins
      UPDATE public.profiles SET coins = coins + (ch.amount * 2), reputation = reputation + 15 WHERE id = ch.challenged_id;
      UPDATE public.profiles SET reputation = reputation + 3 WHERE id = ch.challenger_id;
      INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
      VALUES (ch.challenged_id, 'challenge_won', ch.amount * 2, ch.id, 'Won challenge');
    END IF;
    UPDATE public.challenges SET status = 'resolved' WHERE id = ch.id;
  END LOOP;

  -- *** AWARD CLAN XP to creator's clan ***
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
-- 2. CLAN LEAVE/DELETE RLS POLICIES
-- ==========================================

-- Allow members to leave (delete own membership)
CREATE POLICY "Users can leave clans" ON public.clan_members
  FOR DELETE USING (auth.uid() = user_id);

-- Allow clan creators to delete their clans
CREATE POLICY "Creators can delete own clans" ON public.clans
  FOR DELETE USING (auth.uid() = creator_id);

-- ==========================================
-- 3. NOTIFICATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('challenge_received', 'challenge_accepted', 'challenge_declined', 'prediction_resolved', 'bet_won', 'clan_joined')),
  title TEXT NOT NULL,
  body TEXT,
  reference_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, read) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- ==========================================
-- 4. PREDICTION COMMENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.prediction_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prediction_comments_pred ON public.prediction_comments(prediction_id, created_at);

ALTER TABLE public.prediction_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are publicly readable" ON public.prediction_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can comment" ON public.prediction_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.prediction_comments
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 5. HELPER: Award clan XP on bet (client-callable)
-- ==========================================
CREATE OR REPLACE FUNCTION public.award_clan_xp_for_user(user_id_param UUID, xp_amount INTEGER)
RETURNS VOID AS $$
DECLARE
  user_clan_id UUID;
BEGIN
  SELECT cm.clan_id INTO user_clan_id
  FROM public.clan_members cm WHERE cm.user_id = user_id_param LIMIT 1;
  IF user_clan_id IS NOT NULL THEN
    PERFORM public.add_clan_xp(user_clan_id, xp_amount);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
