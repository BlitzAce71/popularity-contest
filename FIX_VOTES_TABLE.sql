-- Fix missing weight column in votes table
-- This will allow tournament deletion to work properly

-- Add weight column to votes table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'votes' AND column_name = 'weight' AND table_schema = 'public') THEN
        -- Add weight column with default value
        ALTER TABLE public.votes 
        ADD COLUMN weight INTEGER DEFAULT 1 NOT NULL CHECK (weight >= 1 AND weight <= 10);
        
        -- Update existing votes to have weight = 1
        UPDATE public.votes SET weight = 1 WHERE weight IS NULL;
        
        RAISE NOTICE 'Added weight column to votes table';
    ELSE
        RAISE NOTICE 'Weight column already exists in votes table';
    END IF;
END $$;

-- Also add is_admin_vote column if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'votes' AND column_name = 'is_admin_vote' AND table_schema = 'public') THEN
        ALTER TABLE public.votes 
        ADD COLUMN is_admin_vote BOOLEAN DEFAULT FALSE NOT NULL;
        
        RAISE NOTICE 'Added is_admin_vote column to votes table';
    ELSE
        RAISE NOTICE 'is_admin_vote column already exists in votes table';
    END IF;
END $$;

-- Fix the vote counting function to handle the weight column properly
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
    
    -- Calculate vote totals using weight column
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
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

RAISE NOTICE 'Fixed votes table - tournament deletion should now work';