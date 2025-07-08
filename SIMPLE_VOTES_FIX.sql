-- SIMPLIFIED VOTES TABLE FIX - Remove weight complexity
-- Every vote counts as 1, including admin tie-breakers

-- Create votes table if it doesn't exist (simplified version without weight)
CREATE TABLE IF NOT EXISTS public.votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    matchup_id UUID NOT NULL REFERENCES public.matchups(id) ON DELETE CASCADE,
    selected_contestant_id UUID NOT NULL REFERENCES public.contestants(id) ON DELETE CASCADE,
    is_admin_vote BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Unique constraint to prevent multiple votes per user per matchup
    UNIQUE(user_id, matchup_id)
);

-- If weight column exists, we can drop it (but safely check first)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'votes' AND column_name = 'weight' AND table_schema = 'public') THEN
        -- Remove any constraints that reference weight
        ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_weight_check;
        
        -- Drop the weight column
        ALTER TABLE public.votes DROP COLUMN weight;
        
        RAISE NOTICE 'Removed weight column from votes table';
    END IF;
END $$;

-- Add is_admin_vote column if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'votes' AND column_name = 'is_admin_vote' AND table_schema = 'public') THEN
        ALTER TABLE public.votes 
        ADD COLUMN is_admin_vote BOOLEAN DEFAULT FALSE NOT NULL;
        
        RAISE NOTICE 'Added is_admin_vote column to votes table';
    END IF;
END $$;

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON public.votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_matchup_id ON public.votes(matchup_id);
CREATE INDEX IF NOT EXISTS idx_votes_selected_contestant_id ON public.votes(selected_contestant_id);
CREATE INDEX IF NOT EXISTS idx_votes_is_admin_vote ON public.votes(is_admin_vote);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON public.votes(created_at);

CREATE INDEX IF NOT EXISTS idx_vote_results_matchup_id ON public.vote_results(matchup_id);
CREATE INDEX IF NOT EXISTS idx_vote_results_winner_id ON public.vote_results(winner_id);
CREATE INDEX IF NOT EXISTS idx_vote_results_total_votes ON public.vote_results(total_votes DESC);

-- Simplified vote counting function (no weight - every vote = 1)
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
    
    -- Count votes (every vote = 1, no weight)
    SELECT 
        COALESCE(COUNT(*) FILTER (WHERE selected_contestant_id = matchup_contestant1_id), 0),
        COALESCE(COUNT(*) FILTER (WHERE selected_contestant_id = matchup_contestant2_id), 0),
        COALESCE(COUNT(*), 0)
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

-- Initialize vote_results for existing matchups
INSERT INTO public.vote_results (matchup_id, contestant1_votes, contestant2_votes, total_votes, winner_id, is_tie)
SELECT 
    m.id,
    0, -- Will be updated by triggers
    0,
    0,
    NULL,
    false
FROM public.matchups m
LEFT JOIN public.vote_results vr ON m.id = vr.matchup_id
WHERE vr.matchup_id IS NULL
ON CONFLICT (matchup_id) DO NOTHING;

-- Trigger update for all existing votes to recalculate results
UPDATE public.vote_results 
SET last_updated = NOW()
WHERE matchup_id IN (SELECT id FROM public.matchups);

RAISE NOTICE '=============================================================================';
RAISE NOTICE 'SIMPLIFIED VOTES SYSTEM READY';
RAISE NOTICE 'Removed weight complexity - every vote now counts as 1';
RAISE NOTICE 'Admin tie-breakers are just regular votes marked with is_admin_vote=true';
RAISE NOTICE '=============================================================================';