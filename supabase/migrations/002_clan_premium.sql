-- PlotTwist: Premium Clan Features
-- Run this in Supabase SQL Editor

-- ==========================================
-- ADD XP & LEVEL COLUMNS TO CLANS
-- ==========================================
ALTER TABLE public.clans ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.clans ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;

-- ==========================================
-- RPC: Add XP to clan and auto-level
-- ==========================================
CREATE OR REPLACE FUNCTION public.add_clan_xp(clan_id_param UUID, xp_amount INTEGER)
RETURNS TABLE(new_xp INTEGER, new_level INTEGER) AS $$
DECLARE
  current_xp INTEGER;
  calculated_level INTEGER;
BEGIN
  -- Atomically add XP
  UPDATE public.clans
  SET xp = xp + xp_amount
  WHERE id = clan_id_param
  RETURNING xp INTO current_xp;

  -- Calculate level based on XP thresholds
  -- Lv1: 0, Lv2: 500, Lv3: 2000, Lv4: 5000, Lv5: 15000
  calculated_level := CASE
    WHEN current_xp >= 15000 THEN 5
    WHEN current_xp >= 5000 THEN 4
    WHEN current_xp >= 2000 THEN 3
    WHEN current_xp >= 500 THEN 2
    ELSE 1
  END;

  -- Update level if changed
  UPDATE public.clans
  SET level = calculated_level
  WHERE id = clan_id_param AND level != calculated_level;

  new_xp := current_xp;
  new_level := calculated_level;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- RPC: Get clan leaderboard with aggregated stats
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_clan_leaderboard()
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  xp INTEGER,
  level INTEGER,
  created_at TIMESTAMPTZ,
  member_count BIGINT,
  total_reputation BIGINT,
  total_coins BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.description,
    c.xp,
    c.level,
    c.created_at,
    COUNT(cm.id)::BIGINT as member_count,
    COALESCE(SUM(p.reputation), 0)::BIGINT as total_reputation,
    COALESCE(SUM(p.coins), 0)::BIGINT as total_coins
  FROM public.clans c
  LEFT JOIN public.clan_members cm ON cm.clan_id = c.id
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  GROUP BY c.id, c.name, c.description, c.xp, c.level, c.created_at
  ORDER BY total_reputation DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- POLICY: Allow authenticated users to call RPC
-- (RPC functions with SECURITY DEFINER bypass RLS)
-- ==========================================

-- Update policy to allow reading xp/level (already covered by "Clans are publicly readable")
-- No additional policies needed since we use SECURITY DEFINER functions
