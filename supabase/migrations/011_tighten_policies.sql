-- Tighten INSERT policies to enforce auth.uid() ownership
-- Run this in Supabase SQL Editor

-- 1. Predictions: creator must be the current user
DROP POLICY IF EXISTS "Authenticated users can create predictions" ON public.predictions;
CREATE POLICY "Authenticated users can create predictions"
  ON public.predictions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- 2. Bets: user must be the current user
DROP POLICY IF EXISTS "Authenticated users can place bets" ON public.bets;
CREATE POLICY "Authenticated users can place bets"
  ON public.bets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Clans: creator must be the current user
DROP POLICY IF EXISTS "Authenticated users can create clans" ON public.clans;
CREATE POLICY "Authenticated users can create clans"
  ON public.clans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- 4. Clan members: user_id must be the current user (you can only add yourself)
DROP POLICY IF EXISTS "Authenticated users can join clans" ON public.clan_members;
CREATE POLICY "Authenticated users can join clans"
  ON public.clan_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Challenges: challenger must be the current user
DROP POLICY IF EXISTS "Authenticated users can create challenges" ON public.challenges;
CREATE POLICY "Authenticated users can create challenges"
  ON public.challenges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = challenger_id);

-- 6. Transactions: can only insert own transactions
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "System can insert transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 7. Add useful indexes
CREATE INDEX IF NOT EXISTS idx_predictions_active_deadline
  ON public.predictions (deadline) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_challenges_pred_status
  ON public.challenges (prediction_id, status);

CREATE INDEX IF NOT EXISTS idx_bets_user_id
  ON public.bets (user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id_created
  ON public.transactions (user_id, created_at DESC);
