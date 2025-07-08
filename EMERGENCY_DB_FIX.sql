-- EMERGENCY DATABASE FIX
-- Run this SQL in your Supabase SQL Editor to fix all current issues
-- This combines all necessary migrations and fixes

-- =============================================================================
-- 1. Fix tournament table columns (rename to match frontend expectations)
-- =============================================================================

-- First check if we need to rename columns
DO $$
BEGIN
    -- Check if old columns exist and rename them
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'tournament_start_date') THEN
        ALTER TABLE public.tournaments RENAME COLUMN tournament_start_date TO start_date;
        RAISE NOTICE 'Renamed tournament_start_date to start_date';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'tournament_end_date') THEN
        ALTER TABLE public.tournaments RENAME COLUMN tournament_end_date TO end_date;
        RAISE NOTICE 'Renamed tournament_end_date to end_date';
    END IF;
END $$;

-- Update constraints and indexes
DROP INDEX IF EXISTS idx_tournaments_tournament_start_date;
CREATE INDEX IF NOT EXISTS idx_tournaments_start_date ON public.tournaments(start_date);

-- Update constraints
ALTER TABLE public.tournaments 
DROP CONSTRAINT IF EXISTS valid_tournament_dates;

ALTER TABLE public.tournaments 
ADD CONSTRAINT valid_tournament_dates CHECK (
    (registration_deadline IS NULL OR start_date IS NULL OR registration_deadline <= start_date) AND
    (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

-- =============================================================================
-- 2. Ensure vote_results table exists with proper structure
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
    CONSTRAINT valid_vote_totals CHECK (total_votes = contestant1_votes + contestant2_votes),
    
    -- Constraint to ensure winner is one of the contestants
    CONSTRAINT valid_winner CHECK (
        winner_id IS NULL OR winner_id IN (
            SELECT contestant1_id FROM public.matchups WHERE id = matchup_id
            UNION
            SELECT contestant2_id FROM public.matchups WHERE id = matchup_id
        )
    )
);

-- Create indexes for vote_results
CREATE INDEX IF NOT EXISTS idx_vote_results_matchup_id ON public.vote_results(matchup_id);
CREATE INDEX IF NOT EXISTS idx_vote_results_winner_id ON public.vote_results(winner_id);
CREATE INDEX IF NOT EXISTS idx_vote_results_total_votes ON public.vote_results(total_votes DESC);
CREATE INDEX IF NOT EXISTS idx_vote_results_last_updated ON public.vote_results(last_updated);

-- =============================================================================
-- 3. Ensure quadrant_names column exists in tournaments
-- =============================================================================

-- Add quadrant_names column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'quadrant_names') THEN
        ALTER TABLE public.tournaments 
        ADD COLUMN quadrant_names TEXT[] CHECK (array_length(quadrant_names, 1) = 4);
        
        -- Update existing tournaments to have default quadrant names
        UPDATE public.tournaments 
        SET quadrant_names = ARRAY['Region A', 'Region B', 'Region C', 'Region D']
        WHERE quadrant_names IS NULL;
        
        RAISE NOTICE 'Added quadrant_names column to tournaments';
    END IF;
END $$;

-- =============================================================================
-- 4. Fix any tournaments with missing brackets
-- =============================================================================

-- For any active tournaments without rounds, try to regenerate brackets
DO $$
DECLARE
    tournament_record RECORD;
BEGIN
    FOR tournament_record IN 
        SELECT t.id, t.name
        FROM public.tournaments t
        LEFT JOIN public.rounds r ON t.id = r.tournament_id
        WHERE t.status = 'active' 
        AND r.id IS NULL
        AND (SELECT COUNT(*) FROM public.contestants WHERE tournament_id = t.id AND is_active = TRUE) >= 2
    LOOP
        RAISE NOTICE 'Regenerating bracket for tournament: %', tournament_record.name;
        
        -- Try to generate bracket for this tournament
        BEGIN
            PERFORM public.generate_single_elimination_bracket(tournament_record.id);
            RAISE NOTICE 'Successfully generated bracket for tournament: %', tournament_record.name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to generate bracket for tournament %: %', tournament_record.name, SQLERRM;
        END;
    END LOOP;
END $$;

-- =============================================================================
-- 5. Ensure vote counting triggers are working
-- =============================================================================

-- Recreate the vote results update function (simplified version)
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
    
    -- Calculate vote totals for this matchup
    SELECT 
        COALESCE(SUM(CASE WHEN selected_contestant_id = matchup_contestant1_id THEN weight ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN selected_contestant_id = matchup_contestant2_id THEN weight ELSE 0 END), 0),
        COALESCE(SUM(weight), 0)
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
    
    -- Update matchup vote counts
    UPDATE public.matchups
    SET 
        contestant1_votes = new_contestant1_votes,
        contestant2_votes = new_contestant2_votes,
        total_votes = new_total_votes,
        winner_id = new_winner_id,
        is_tie = new_is_tie
    WHERE id = COALESCE(NEW.matchup_id, OLD.matchup_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
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
-- 6. Initialize vote_results for existing matchups
-- =============================================================================

-- Create vote_results entries for any existing matchups that don't have them
INSERT INTO public.vote_results (matchup_id, contestant1_votes, contestant2_votes, total_votes, winner_id, is_tie)
SELECT 
    m.id,
    COALESCE(m.contestant1_votes, 0),
    COALESCE(m.contestant2_votes, 0),
    COALESCE(m.total_votes, 0),
    m.winner_id,
    COALESCE(m.is_tie, false)
FROM public.matchups m
LEFT JOIN public.vote_results vr ON m.id = vr.matchup_id
WHERE vr.matchup_id IS NULL;

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'EMERGENCY DATABASE FIX COMPLETED';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'Fixed:';
    RAISE NOTICE '- Tournament table column names (start_date, end_date)';
    RAISE NOTICE '- Created vote_results table and indexes';
    RAISE NOTICE '- Added quadrant_names column';
    RAISE NOTICE '- Regenerated missing tournament brackets';
    RAISE NOTICE '- Fixed vote counting triggers';
    RAISE NOTICE '- Initialized vote_results for existing matchups';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'Your tournaments should now work correctly!';
    RAISE NOTICE '=============================================================================';
END $$;