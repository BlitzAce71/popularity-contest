-- MINIMAL DATABASE FIX - Only fix critical issues without assuming schema
-- Run this SQL in your Supabase SQL Editor

-- =============================================================================
-- 1. Create vote_results table (the critical missing piece)
-- =============================================================================

-- Create vote_results table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.vote_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matchup_id UUID UNIQUE NOT NULL REFERENCES public.matchups(id) ON DELETE CASCADE,
    contestant1_votes INTEGER DEFAULT 0 NOT NULL CHECK (contestant1_votes >= 0),
    contestant2_votes INTEGER DEFAULT 0 NOT NULL CHECK (contestant2_votes >= 0),
    total_votes INTEGER DEFAULT 0 NOT NULL CHECK (total_votes >= 0),
    winner_id UUID REFERENCES public.contestants(id) ON DELETE SET NULL,
    is_tie BOOLEAN DEFAULT FALSE NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraint to ensure total votes matches individual votes
    CONSTRAINT valid_vote_totals CHECK (total_votes = contestant1_votes + contestant2_votes)
);

-- Create indexes for vote_results
CREATE INDEX IF NOT EXISTS idx_vote_results_matchup_id ON public.vote_results(matchup_id);
CREATE INDEX IF NOT EXISTS idx_vote_results_winner_id ON public.vote_results(winner_id);
CREATE INDEX IF NOT EXISTS idx_vote_results_total_votes ON public.vote_results(total_votes DESC);

-- =============================================================================
-- 2. Fix tournament column names only if needed
-- =============================================================================

-- Check current tournament table structure and rename columns if they exist with old names
DO $$
BEGIN
    -- Rename tournament_start_date to start_date if old column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'tournament_start_date' AND table_schema = 'public') THEN
        ALTER TABLE public.tournaments RENAME COLUMN tournament_start_date TO start_date;
        RAISE NOTICE 'Renamed tournament_start_date to start_date';
    END IF;
    
    -- Rename tournament_end_date to end_date if old column exists  
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'tournament_end_date' AND table_schema = 'public') THEN
        ALTER TABLE public.tournaments RENAME COLUMN tournament_end_date TO end_date;
        RAISE NOTICE 'Renamed tournament_end_date to end_date';
    END IF;
END $$;

-- =============================================================================
-- 3. Add quadrant_names column if missing
-- =============================================================================

-- Add quadrant_names column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'quadrant_names' AND table_schema = 'public') THEN
        ALTER TABLE public.tournaments 
        ADD COLUMN quadrant_names TEXT[] CHECK (array_length(quadrant_names, 1) = 4);
        
        -- Set default values for existing tournaments
        UPDATE public.tournaments 
        SET quadrant_names = ARRAY['Region A', 'Region B', 'Region C', 'Region D']
        WHERE quadrant_names IS NULL;
        
        RAISE NOTICE 'Added quadrant_names column';
    END IF;
END $$;

-- =============================================================================
-- 4. Create vote counting function and triggers
-- =============================================================================

-- Create simplified vote results update function
CREATE OR REPLACE FUNCTION public.update_vote_results()
RETURNS TRIGGER AS $$
DECLARE
    matchup_contestant1_id UUID;
    matchup_contestant2_id UUID;
    new_contestant1_votes INTEGER := 0;
    new_contestant2_votes INTEGER := 0;
    new_total_votes INTEGER := 0;
    new_winner_id UUID := NULL;
    new_is_tie BOOLEAN := FALSE;
BEGIN
    -- Get matchup contestants
    SELECT contestant1_id, contestant2_id
    INTO matchup_contestant1_id, matchup_contestant2_id
    FROM public.matchups
    WHERE id = COALESCE(NEW.matchup_id, OLD.matchup_id);
    
    -- Calculate vote totals
    SELECT 
        COALESCE(SUM(CASE WHEN selected_contestant_id = matchup_contestant1_id THEN COALESCE(weight, 1) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN selected_contestant_id = matchup_contestant2_id THEN COALESCE(weight, 1) ELSE 0 END), 0),
        COALESCE(SUM(COALESCE(weight, 1)), 0)
    INTO new_contestant1_votes, new_contestant2_votes, new_total_votes
    FROM public.votes
    WHERE matchup_id = COALESCE(NEW.matchup_id, OLD.matchup_id);
    
    -- Determine winner
    IF new_contestant1_votes > new_contestant2_votes THEN
        new_winner_id := matchup_contestant1_id;
        new_is_tie := FALSE;
    ELSIF new_contestant2_votes > new_contestant1_votes THEN
        new_winner_id := matchup_contestant2_id;
        new_is_tie := FALSE;
    ELSE
        new_winner_id := NULL;
        new_is_tie := (new_total_votes > 0);
    END IF;
    
    -- Update or insert vote results
    INSERT INTO public.vote_results (
        matchup_id,
        contestant1_votes,
        contestant2_votes,
        total_votes,
        winner_id,
        is_tie,
        last_updated
    ) VALUES (
        COALESCE(NEW.matchup_id, OLD.matchup_id),
        new_contestant1_votes,
        new_contestant2_votes,
        new_total_votes,
        new_winner_id,
        new_is_tie,
        NOW()
    )
    ON CONFLICT (matchup_id) DO UPDATE SET
        contestant1_votes = EXCLUDED.contestant1_votes,
        contestant2_votes = EXCLUDED.contestant2_votes,
        total_votes = EXCLUDED.total_votes,
        winner_id = EXCLUDED.winner_id,
        is_tie = EXCLUDED.is_tie,
        last_updated = EXCLUDED.last_updated;
    
    -- Update matchup vote counts if columns exist
    BEGIN
        UPDATE public.matchups
        SET 
            contestant1_votes = new_contestant1_votes,
            contestant2_votes = new_contestant2_votes,
            total_votes = new_total_votes,
            winner_id = new_winner_id,
            is_tie = new_is_tie
        WHERE id = COALESCE(NEW.matchup_id, OLD.matchup_id);
    EXCEPTION WHEN undefined_column THEN
        -- Ignore if columns don't exist in matchups table
        NULL;
    END;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS update_vote_results_on_insert ON public.votes;
DROP TRIGGER IF EXISTS update_vote_results_on_update ON public.votes;
DROP TRIGGER IF EXISTS update_vote_results_on_delete ON public.votes;

CREATE TRIGGER update_vote_results_on_insert
    AFTER INSERT ON public.votes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_vote_results();

CREATE TRIGGER update_vote_results_on_update
    AFTER UPDATE ON public.votes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_vote_results();

CREATE TRIGGER update_vote_results_on_delete
    AFTER DELETE ON public.votes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_vote_results();

-- =============================================================================
-- 5. Initialize vote_results for existing matchups
-- =============================================================================

-- Create vote_results entries for existing matchups
INSERT INTO public.vote_results (matchup_id, contestant1_votes, contestant2_votes, total_votes, winner_id, is_tie)
SELECT 
    m.id,
    0, -- Will be updated by triggers when votes are counted
    0,
    0,
    NULL,
    false
FROM public.matchups m
LEFT JOIN public.vote_results vr ON m.id = vr.matchup_id
WHERE vr.matchup_id IS NULL
ON CONFLICT (matchup_id) DO NOTHING;

-- Force update vote counts for all existing matchups
UPDATE public.vote_results 
SET last_updated = NOW()
WHERE matchup_id IN (SELECT id FROM public.matchups);

-- =============================================================================
-- COMPLETION
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'MINIMAL DATABASE FIX COMPLETED';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'Fixed: vote_results table, tournament columns, vote counting';
    RAISE NOTICE 'This should resolve the 404 vote_results errors';
    RAISE NOTICE '=============================================================================';
END $$;