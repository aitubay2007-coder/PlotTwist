-- Allow authenticated users to insert shows (for user-generated show names)
DO $$ BEGIN
  CREATE POLICY "Authenticated users can create shows"
    ON public.shows
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
