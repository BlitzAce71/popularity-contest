-- Create rounds table for tournament progression
-- This table manages the rounds/stages of tournaments

CREATE TYPE round_status AS ENUM ('upcoming', 'active', 'completed', 'paused');

CREATE TABLE public.rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL CHECK (round_number >= 1),
    name TEXT NOT NULL CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 50),
    description TEXT CHECK (LENGTH(description) <= 500),
    status round_status DEFAULT 'upcoming' NOT NULL,
    total_matchups INTEGER NOT NULL CHECK (total_matchups >= 1),
    completed_matchups INTEGER DEFAULT 0 NOT NULL CHECK (completed_matchups >= 0),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    locked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Unique constraint to prevent duplicate round numbers per tournament
    UNIQUE(tournament_id, round_number),
    
    -- Constraint to ensure logical date ordering
    CONSTRAINT valid_round_dates CHECK (
        start_date IS NULL OR end_date IS NULL OR start_date <= end_date
    ),
    
    -- Constraint to ensure completed matchups don't exceed total
    CONSTRAINT valid_matchup_counts CHECK (completed_matchups <= total_matchups)
);

-- Create indexes for better performance
CREATE INDEX idx_rounds_tournament_id ON public.rounds(tournament_id);
CREATE INDEX idx_rounds_round_number ON public.rounds(tournament_id, round_number);
CREATE INDEX idx_rounds_status ON public.rounds(status);
CREATE INDEX idx_rounds_start_date ON public.rounds(start_date);
CREATE INDEX idx_rounds_end_date ON public.rounds(end_date);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_rounds_updated_at
    BEFORE UPDATE ON public.rounds
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to validate round progression
CREATE OR REPLACE FUNCTION public.validate_round_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow certain status transitions
    IF OLD.status != NEW.status THEN
        CASE OLD.status
            WHEN 'upcoming' THEN
                IF NEW.status NOT IN ('active', 'paused') THEN
                    RAISE EXCEPTION 'Invalid status transition from upcoming to %', NEW.status;
                END IF;
            WHEN 'active' THEN
                IF NEW.status NOT IN ('completed', 'paused') THEN
                    RAISE EXCEPTION 'Invalid status transition from active to %', NEW.status;
                END IF;
            WHEN 'paused' THEN
                IF NEW.status NOT IN ('active', 'completed') THEN
                    RAISE EXCEPTION 'Invalid status transition from paused to %', NEW.status;
                END IF;
            WHEN 'completed' THEN
                IF NEW.status != 'completed' THEN
                    RAISE EXCEPTION 'Cannot change status from completed';
                END IF;
        END CASE;
    END IF;
    
    -- Auto-complete round when all matchups are completed
    IF NEW.completed_matchups = NEW.total_matchups AND NEW.status = 'active' THEN
        NEW.status = 'completed';
        NEW.end_date = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_round_status_change_trigger
    BEFORE UPDATE ON public.rounds
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_round_status_change();

-- Create function to automatically generate round names
CREATE OR REPLACE FUNCTION public.generate_round_name(tournament_size INTEGER, round_num INTEGER)
RETURNS TEXT AS $$
DECLARE
    total_rounds INTEGER;
    round_name TEXT;
BEGIN
    -- Calculate total rounds for single elimination
    total_rounds := CEIL(LOG(2, tournament_size));
    
    -- Generate appropriate round name
    IF round_num = total_rounds THEN
        round_name := 'Final';
    ELSIF round_num = total_rounds - 1 THEN
        round_name := 'Semifinal';
    ELSIF round_num = total_rounds - 2 THEN
        round_name := 'Quarterfinal';
    ELSE
        round_name := 'Round ' || round_num;
    END IF;
    
    RETURN round_name;
END;
$$ LANGUAGE plpgsql;

-- Create function to update round completion status
CREATE OR REPLACE FUNCTION public.update_round_completion()
RETURNS TRIGGER AS $$
DECLARE
    round_id UUID;
    total_matchups INTEGER;
    completed_count INTEGER;
BEGIN
    -- Get the round ID from the updated matchup
    IF TG_OP = 'UPDATE' THEN
        round_id := NEW.round_id;
    ELSE
        round_id := OLD.round_id;
    END IF;
    
    -- Count completed matchups in this round
    SELECT COUNT(*) INTO completed_count
    FROM public.matchups
    WHERE round_id = round_id AND status = 'completed';
    
    -- Get total matchups for this round
    SELECT total_matchups INTO total_matchups
    FROM public.rounds
    WHERE id = round_id;
    
    -- Update the round's completed matchups count
    UPDATE public.rounds
    SET completed_matchups = completed_count
    WHERE id = round_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE public.rounds IS 'Tournament rounds/stages management';
COMMENT ON COLUMN public.rounds.round_number IS 'Sequential round number (1 = first round)';
COMMENT ON COLUMN public.rounds.name IS 'Display name for the round (e.g., "Quarterfinal")';
COMMENT ON COLUMN public.rounds.total_matchups IS 'Total number of matchups in this round';
COMMENT ON COLUMN public.rounds.completed_matchups IS 'Number of completed matchups in this round';
COMMENT ON COLUMN public.rounds.locked_at IS 'Timestamp when round was locked for results';
COMMENT ON TYPE round_status IS 'Round lifecycle states';