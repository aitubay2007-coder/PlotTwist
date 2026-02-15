-- PlotTwist: Clan Chat
-- Run this in Supabase SQL Editor

-- ==========================================
-- CLAN MESSAGES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.clan_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id UUID NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast fetching by clan, ordered by time
CREATE INDEX IF NOT EXISTS idx_clan_messages_clan_time ON public.clan_messages(clan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clan_messages_user ON public.clan_messages(user_id);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE public.clan_messages ENABLE ROW LEVEL SECURITY;

-- Members of the clan can read messages
CREATE POLICY "Clan members can read messages"
  ON public.clan_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clan_members
      WHERE clan_members.clan_id = clan_messages.clan_id
        AND clan_members.user_id = auth.uid()
    )
  );

-- Members of the clan can send messages
CREATE POLICY "Clan members can send messages"
  ON public.clan_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.clan_members
      WHERE clan_members.clan_id = clan_messages.clan_id
        AND clan_members.user_id = auth.uid()
    )
  );

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages"
  ON public.clan_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Clan admins can delete any message in their clan
CREATE POLICY "Clan admins can delete any message"
  ON public.clan_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.clan_members
      WHERE clan_members.clan_id = clan_messages.clan_id
        AND clan_members.user_id = auth.uid()
        AND clan_members.role = 'admin'
    )
  );

-- ==========================================
-- ENABLE REALTIME for clan_messages
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.clan_messages;
