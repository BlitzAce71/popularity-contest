-- Create matchups table for tournament bracket structure
-- This table represents individual matches between contestants

CREATE TYPE matchup_status AS ENUM ('upcoming', 'active', 'completed', 'cancelled');

CREATE TABLE public.matchups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 1),
    contestant1_id UUID REFERENCES public.contestants(id) ON DELETE SET NULL,
    contestant2_id UUID REFERENCES public.contestants(id) ON DELETE SET NULL,
    winner_id UUID REFERENCES public.contestants(id) ON DELETE SET NULL,
    status matchup_status DEFAULT 'upcoming' NOT NULL,
    contestant1_votes INTEGER DEFAULT 0 NOT NULL CHECK (contestant1_votes >= 0),
    contestant2_votes INTEGER DEFAULT 0 NOT NULL CHECK (contestant2_votes >= 0),
    total_votes INTEGER DEFAULT 0 NOT NULL CHECK (total_votes >= 0),
    is_tie BOOLEAN DEFAULT FALSE NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Unique constraint to prevent duplicate positions per round
    UNIQUE(round_id, position),
    
    -- Constraint to ensure different contestants
    CONSTRAINT different_contestants CHECK (
        contestant1_id IS NULL OR contestant2_id IS NULL OR contestant1_id != contestant2_id
    ),
    
    -- Constraint to ensure winner is one of the contestants
    CONSTRAINT valid_winner CHECK (
        winner_id IS NULL OR winner_id = contestant1_id OR winner_id = contestant2_id
    ),
    
    -- Constraint to ensure logical date ordering
    CONSTRAINT valid_matchup_dates CHECK (
        start_date IS NULL OR end_date IS NULL OR start_date <= end_date
    ),
    
    -- Constraint to ensure total votes matches individual votes
    CONSTRAINT valid_vote_totals CHECK (total_votes = contestant1_votes + contestant2_votes)
);

-- Create indexes for better performance
CREATE INDEX idx_matchups_round_id ON public.matchups(round_id);
CREATE INDEX idx_matchups_tournament_id ON public.matchups(tournament_id);
CREATE INDEX idx_matchups_position ON public.matchups(round_id, position);
CREATE INDEX idx_matchups_status ON public.matchups(status);
CREATE INDEX idx_matchups_contestant1_id ON public.matchups(contestant1_id);
CREATE INDEX idx_matchups_contestant2_id ON public.matchups(contestant2_id);
CREATE INDEX idx_matchups_winner_id ON public.matchups(winner_id);
CREATE INDEX idx_matchups_start_date ON public.matchups(start_date);
CREATE INDEX idx_matchups_end_date ON public.matchups(end_date);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_matchups_updated_at
    BEFORE UPDATE ON public.matchups
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to update round completion
CREATE TRIGGER update_round_completion_on_matchup_change
    AFTER UPDATE ON public.matchups
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.update_round_completion();

-- Create function to validate matchup status changes
CREATE OR REPLACE FUNCTION public.validate_matchup_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow certain status transitions
    IF OLD.status != NEW.status THEN
        CASE OLD.status
            WHEN 'upcoming' THEN
                IF NEW.status NOT IN ('active', 'cancelled') THEN
                    RAISE EXCEPTION 'Invalid status transition from upcoming to %', NEW.status;
                END IF;
            WHEN 'active' THEN
                IF NEW.status NOT IN ('completed', 'cancelled') THEN
                    RAISE EXCEPTION 'Invalid status transition from active to %', NEW.status;
                END IF;
            WHEN 'completed' THEN
                IF NEW.status != 'completed' THEN
                    RAISE EXCEPTION 'Cannot change status from completed';
                END IF;
            WHEN 'cancelled' THEN
                IF NEW.status != 'cancelled' THEN
                    RAISE EXCEPTION 'Cannot change status from cancelled';
                END IF;
        END CASE;
    END IF;
    
    -- Auto-set completion timestamp
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
    END IF;
    
    -- Validate completion requirements
    IF NEW.status = 'completed' THEN
        -- Must have both contestants to complete
        IF NEW.contestant1_id IS NULL OR NEW.contestant2_id IS NULL THEN
            RAISE EXCEPTION 'Cannot complete matchup without both contestants';
        END IF;
        
        -- Must have votes unless it's a forfeit
        IF NEW.total_votes = 0 AND NEW.winner_id IS NULL THEN
            RAISE EXCEPTION 'Cannot complete matchup without votes or declared winner';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_matchup_status_change_trigger
    BEFORE UPDATE ON public.matchups
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_matchup_status_change();

-- Create function to update vote totals
CREATE OR REPLACE FUNCTION public.update_matchup_vote_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the total votes and individual contestant vote counts
    NEW.total_votes = NEW.contestant1_votes + NEW.contestant2_votes;
    
    -- Determine winner based on votes (if not manually set)
    IF NEW.winner_id IS NULL AND NEW.total_votes > 0 THEN
        IF NEW.contestant1_votes > NEW.contestant2_votes THEN
            NEW.winner_id = NEW.contestant1_id;
            NEW.is_tie = FALSE;
        ELSIF NEW.contestant2_votes > NEW.contestant1_votes THEN
            NEW.winner_id = NEW.contestant2_id;
            NEW.is_tie = FALSE;
        ELSE
            -- Handle tie based on tournament settings
            NEW.is_tie = TRUE;
            -- Winner will be determined by tie-breaking rules
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_matchup_vote_totals_trigger
    BEFORE UPDATE ON public.matchups
    FOR EACH ROW
    WHEN (OLD.contestant1_votes IS DISTINCT FROM NEW.contestant1_votes OR 
          OLD.contestant2_votes IS DISTINCT FROM NEW.contestant2_votes)
    EXECUTE FUNCTION public.update_matchup_vote_totals();

-- Create function to advance winners to next round
CREATE OR REPLACE FUNCTION public.advance_matchup_winner()
RETURNS TRIGGER AS $$
DECLARE
    next_round_id UUID;
    next_position INTEGER;
    tournament_bracket_type TEXT;
BEGIN
    -- Only process when matchup is completed and has a winner
    IF NEW.status = 'completed' AND NEW.winner_id IS NOT NULL AND OLD.status != 'completed' THEN
        -- Get tournament bracket type
        SELECT bracket_type INTO tournament_bracket_type
        FROM public.tournaments
        WHERE id = NEW.tournament_id;
        
        -- For single elimination, advance winner to next round
        IF tournament_bracket_type = 'single-elimination' THEN
            -- Find next round
            SELECT id INTO next_round_id
            FROM public.rounds
            WHERE tournament_id = NEW.tournament_id
            AND round_number = (
                SELECT round_number + 1
                FROM public.rounds
                WHERE id = NEW.round_id
            );
            
            -- If next round exists, calculate position and advance winner
            IF next_round_id IS NOT NULL THEN
                next_position := CEIL(NEW.position::FLOAT / 2);
                
                -- Update the appropriate contestant slot in next round
                IF NEW.position % 2 = 1 THEN
                    -- Odd position -> contestant1 in next round
                    UPDATE public.matchups
                    SET contestant1_id = NEW.winner_id
                    WHERE round_id = next_round_id AND position = next_position;
                ELSE
                    -- Even position -> contestant2 in next round
                    UPDATE public.matchups
                    SET contestant2_id = NEW.winner_id
                    WHERE round_id = next_round_id AND position = next_position;
                END IF;
            END IF;
        END IF;
        
        -- Update contestant statistics
        UPDATE public.contestants
        SET wins = wins + 1
        WHERE id = NEW.winner_id;
        
        -- Mark loser as eliminated
        IF NEW.contestant1_id != NEW.winner_id THEN
            UPDATE public.contestants
            SET losses = losses + 1,
                eliminated_round = (SELECT round_number FROM public.rounds WHERE id = NEW.round_id)
            WHERE id = NEW.contestant1_id;
        END IF;
        
        IF NEW.contestant2_id != NEW.winner_id THEN
            UPDATE public.contestants
            SET losses = losses + 1,
                eliminated_round = (SELECT round_number FROM public.rounds WHERE id = NEW.round_id)
            WHERE id = NEW.contestant2_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER advance_matchup_winner_trigger
    AFTER UPDATE ON public.matchups
    FOR EACH ROW
    EXECUTE FUNCTION public.advance_matchup_winner();

-- Comments for documentation
COMMENT ON TABLE public.matchups IS 'Individual matches between contestants in tournament brackets';
COMMENT ON COLUMN public.matchups.position IS 'Position within the round (determines bracket layout)';
COMMENT ON COLUMN public.matchups.contestant1_votes IS 'Vote count for first contestant';
COMMENT ON COLUMN public.matchups.contestant2_votes IS 'Vote count for second contestant';
COMMENT ON COLUMN public.matchups.total_votes IS 'Total votes cast in this matchup';
COMMENT ON COLUMN public.matchups.is_tie IS 'Whether the matchup resulted in a tie';
COMMENT ON COLUMN public.matchups.completed_at IS 'Timestamp when matchup was completed';
COMMENT ON TYPE matchup_status IS 'Matchup lifecycle states';