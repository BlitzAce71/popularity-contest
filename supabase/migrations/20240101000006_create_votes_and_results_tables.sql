-- Create votes and vote_results tables for tracking voting activity
-- These tables manage individual votes and aggregated voting results

-- Votes table: Individual user votes
CREATE TABLE public.votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    matchup_id UUID NOT NULL REFERENCES public.matchups(id) ON DELETE CASCADE,
    selected_contestant_id UUID NOT NULL REFERENCES public.contestants(id) ON DELETE CASCADE,
    is_admin_vote BOOLEAN DEFAULT FALSE NOT NULL,
    weight INTEGER DEFAULT 1 NOT NULL CHECK (weight >= 1 AND weight <= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Unique constraint to prevent multiple votes per user per matchup
    UNIQUE(user_id, matchup_id),
    
    -- Constraint to ensure selected contestant is in the matchup
    CONSTRAINT valid_contestant_selection CHECK (
        selected_contestant_id IN (
            SELECT contestant1_id FROM public.matchups WHERE id = matchup_id
            UNION
            SELECT contestant2_id FROM public.matchups WHERE id = matchup_id
        )
    )
);

-- Vote results table: Aggregated voting results per matchup
CREATE TABLE public.vote_results (
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

-- Create indexes for better performance
CREATE INDEX idx_votes_user_id ON public.votes(user_id);
CREATE INDEX idx_votes_matchup_id ON public.votes(matchup_id);
CREATE INDEX idx_votes_selected_contestant_id ON public.votes(selected_contestant_id);
CREATE INDEX idx_votes_is_admin_vote ON public.votes(is_admin_vote);
CREATE INDEX idx_votes_created_at ON public.votes(created_at);

CREATE INDEX idx_vote_results_matchup_id ON public.vote_results(matchup_id);
CREATE INDEX idx_vote_results_winner_id ON public.vote_results(winner_id);
CREATE INDEX idx_vote_results_total_votes ON public.vote_results(total_votes DESC);
CREATE INDEX idx_vote_results_last_updated ON public.vote_results(last_updated);

-- Create function to update vote results when votes are cast
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
    
    -- Update contestant vote totals
    UPDATE public.contestants
    SET votes_received = (
        SELECT COALESCE(SUM(
            CASE 
                WHEN selected_contestant_id = public.contestants.id 
                THEN public.votes.weight 
                ELSE 0 
            END
        ), 0)
        FROM public.votes
        JOIN public.matchups ON public.votes.matchup_id = public.matchups.id
        WHERE public.matchups.contestant1_id = public.contestants.id 
           OR public.matchups.contestant2_id = public.contestants.id
    )
    WHERE id IN (matchup_contestant1_id, matchup_contestant2_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update vote results
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

-- Create function to validate vote timing
CREATE OR REPLACE FUNCTION public.validate_vote_timing()
RETURNS TRIGGER AS $$
DECLARE
    matchup_status matchup_status;
    matchup_start_date TIMESTAMP WITH TIME ZONE;
    matchup_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get matchup details
    SELECT status, start_date, end_date
    INTO matchup_status, matchup_start_date, matchup_end_date
    FROM public.matchups
    WHERE id = NEW.matchup_id;
    
    -- Check if matchup is in voting state
    IF matchup_status != 'active' THEN
        RAISE EXCEPTION 'Cannot vote on matchup with status: %', matchup_status;
    END IF;
    
    -- Check if voting is within allowed time window
    IF matchup_start_date IS NOT NULL AND NOW() < matchup_start_date THEN
        RAISE EXCEPTION 'Voting has not started yet for this matchup';
    END IF;
    
    IF matchup_end_date IS NOT NULL AND NOW() > matchup_end_date THEN
        RAISE EXCEPTION 'Voting has ended for this matchup';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_vote_timing_trigger
    BEFORE INSERT OR UPDATE ON public.votes
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_vote_timing();

-- Create function to prevent vote manipulation
CREATE OR REPLACE FUNCTION public.validate_vote_integrity()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent users from voting for contestants not in the matchup
    IF NOT EXISTS (
        SELECT 1 FROM public.matchups
        WHERE id = NEW.matchup_id
        AND (contestant1_id = NEW.selected_contestant_id OR contestant2_id = NEW.selected_contestant_id)
    ) THEN
        RAISE EXCEPTION 'Selected contestant is not in this matchup';
    END IF;
    
    -- Admin votes can have higher weight
    IF NEW.is_admin_vote THEN
        -- Verify user is actually an admin
        IF NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = NEW.user_id AND is_admin = TRUE
        ) THEN
            RAISE EXCEPTION 'User is not authorized for admin votes';
        END IF;
    ELSE
        -- Regular votes must have weight of 1
        NEW.weight := 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_vote_integrity_trigger
    BEFORE INSERT OR UPDATE ON public.votes
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_vote_integrity();

-- Comments for documentation
COMMENT ON TABLE public.votes IS 'Individual user votes for matchups';
COMMENT ON COLUMN public.votes.weight IS 'Vote weight (1 for regular users, up to 10 for admin votes)';
COMMENT ON COLUMN public.votes.is_admin_vote IS 'Whether this is an admin vote with special weight';
COMMENT ON COLUMN public.votes.selected_contestant_id IS 'The contestant this vote is for';

COMMENT ON TABLE public.vote_results IS 'Aggregated voting results per matchup';
COMMENT ON COLUMN public.vote_results.contestant1_votes IS 'Total weighted votes for contestant 1';
COMMENT ON COLUMN public.vote_results.contestant2_votes IS 'Total weighted votes for contestant 2';
COMMENT ON COLUMN public.vote_results.total_votes IS 'Total weighted votes cast';
COMMENT ON COLUMN public.vote_results.last_updated IS 'When results were last recalculated';