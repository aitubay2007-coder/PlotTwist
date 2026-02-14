-- PlotTwist: Initial Database Schema
-- Run this in Supabase SQL Editor

-- ==========================================
-- PROFILES (extends auth.users)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  coins INTEGER NOT NULL DEFAULT 1000,
  reputation INTEGER NOT NULL DEFAULT 0,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- SHOWS (catalog of series/anime/movies)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('anime', 'series', 'movie', 'sport', 'music', 'other')),
  poster_url TEXT,
  status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- PREDICTIONS (core entity)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved_yes', 'resolved_no', 'cancelled')),
  deadline TIMESTAMPTZ NOT NULL,
  total_yes INTEGER NOT NULL DEFAULT 0,
  total_no INTEGER NOT NULL DEFAULT 0,
  total_pool INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- BETS (user bets on predictions)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prediction_id UUID NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  position TEXT NOT NULL CHECK (position IN ('yes', 'no')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- CLANS (user groups)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.clans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- CLAN MEMBERS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.clan_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id UUID NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(clan_id, user_id)
);

-- ==========================================
-- CHALLENGES (friend vs friend)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenged_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prediction_id UUID NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  challenger_position TEXT NOT NULL CHECK (challenger_position IN ('yes', 'no')),
  challenged_position TEXT NOT NULL CHECK (challenged_position IN ('yes', 'no')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- TRANSACTIONS (virtual currency log)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('signup_bonus', 'bet_placed', 'bet_won', 'challenge_sent', 'challenge_accepted', 'challenge_won', 'challenge_refund', 'daily_bonus')),
  amount INTEGER NOT NULL,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_predictions_show_id ON public.predictions(show_id);
CREATE INDEX IF NOT EXISTS idx_predictions_status ON public.predictions(status);
CREATE INDEX IF NOT EXISTS idx_predictions_creator ON public.predictions(creator_id);
CREATE INDEX IF NOT EXISTS idx_bets_prediction ON public.bets(prediction_id);
CREATE INDEX IF NOT EXISTS idx_bets_user ON public.bets(user_id);
CREATE INDEX IF NOT EXISTS idx_clan_members_clan ON public.clan_members(clan_id);
CREATE INDEX IF NOT EXISTS idx_clan_members_user ON public.clan_members(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON public.challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON public.challenges(challenged_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_profiles_reputation ON public.profiles(reputation DESC);

-- ==========================================
-- RPC FUNCTIONS
-- ==========================================

-- Increment coins atomically
CREATE OR REPLACE FUNCTION public.increment_coins(user_id_param UUID, amount_param INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET coins = coins + amount_param
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment prediction totals atomically
CREATE OR REPLACE FUNCTION public.increment_prediction_total(pred_id UUID, field_name TEXT, increment_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  IF field_name = 'total_yes' THEN
    UPDATE public.predictions
    SET total_yes = total_yes + increment_amount,
        total_pool = total_pool + increment_amount
    WHERE id = pred_id;
  ELSIF field_name = 'total_no' THEN
    UPDATE public.predictions
    SET total_no = total_no + increment_amount,
        total_pool = total_pool + increment_amount
    WHERE id = pred_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, coins)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::TEXT, 8)),
    1000
  );
  -- Log signup bonus
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (NEW.id, 'signup_bonus', 1000, 'Welcome bonus!');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, own write
CREATE POLICY "Profiles are publicly readable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Shows: public read
CREATE POLICY "Shows are publicly readable" ON public.shows FOR SELECT USING (true);

-- Predictions: public read, authenticated create
CREATE POLICY "Predictions are publicly readable" ON public.predictions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create predictions" ON public.predictions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Creators can update own predictions" ON public.predictions FOR UPDATE USING (auth.uid() = creator_id);

-- Bets: public read, authenticated create
CREATE POLICY "Bets are publicly readable" ON public.bets FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create bets" ON public.bets FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Clans: public read, authenticated create
CREATE POLICY "Clans are publicly readable" ON public.clans FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create clans" ON public.clans FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Creators can update own clans" ON public.clans FOR UPDATE USING (auth.uid() = creator_id);

-- Clan members: public read, authenticated join
CREATE POLICY "Clan members are publicly readable" ON public.clan_members FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join clans" ON public.clan_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Challenges: participants can read, authenticated create
CREATE POLICY "Users can see own challenges" ON public.challenges FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);
CREATE POLICY "Authenticated users can create challenges" ON public.challenges FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Challenged user can update challenge" ON public.challenges FOR UPDATE USING (auth.uid() = challenged_id OR auth.uid() = challenger_id);

-- Transactions: users see own only
CREATE POLICY "Users can see own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert transactions" ON public.transactions FOR INSERT WITH CHECK (true);

-- ==========================================
-- SEED DATA: Popular Shows
-- ==========================================
INSERT INTO public.shows (id, title, category, status) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'One Piece', 'anime', 'ongoing'),
  ('a1000000-0000-0000-0000-000000000002', 'Squid Game', 'series', 'ongoing'),
  ('a1000000-0000-0000-0000-000000000003', 'Attack on Titan', 'anime', 'completed'),
  ('a1000000-0000-0000-0000-000000000004', 'Game of Thrones', 'series', 'completed'),
  ('a1000000-0000-0000-0000-000000000005', 'Jujutsu Kaisen', 'anime', 'ongoing'),
  ('a1000000-0000-0000-0000-000000000006', 'Stranger Things', 'series', 'ongoing'),
  ('a1000000-0000-0000-0000-000000000007', 'UFC', 'sport', 'ongoing'),
  ('a1000000-0000-0000-0000-000000000008', 'Music Industry', 'music', 'ongoing'),
  ('a1000000-0000-0000-0000-000000000009', 'The Last of Us', 'series', 'ongoing'),
  ('a1000000-0000-0000-0000-000000000010', 'Demon Slayer', 'anime', 'ongoing'),
  ('a1000000-0000-0000-0000-000000000011', 'House of the Dragon', 'series', 'ongoing'),
  ('a1000000-0000-0000-0000-000000000012', 'Solo Leveling', 'anime', 'ongoing')
ON CONFLICT DO NOTHING;
