-- ==========================================
-- PlotTwist: Simplify to core — add visibility, make show_id optional
-- Run this in Supabase SQL Editor
-- ==========================================

-- 1. Add visibility column to predictions (public = shown in feed, private = link-only)
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

-- Add CHECK constraint safely
DO $$ BEGIN
  ALTER TABLE public.predictions ADD CONSTRAINT predictions_visibility_check
    CHECK (visibility IN ('public', 'private'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Make show_id optional (categories removed from create flow)
ALTER TABLE public.predictions ALTER COLUMN show_id DROP NOT NULL;
