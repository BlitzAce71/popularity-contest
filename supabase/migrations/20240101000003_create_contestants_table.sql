-- Create contestants table for tournament participants
-- This table stores information about each contestant in tournaments

CREATE TABLE public.contestants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 100),
    description TEXT CHECK (LENGTH(description) <= 500),
    image_url TEXT,
    position INTEGER NOT NULL CHECK (position >= 1),
    seed INTEGER CHECK (seed >= 1),
    eliminated_round INTEGER DEFAULT NULL CHECK (eliminated_round >= 0),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    votes_received INTEGER DEFAULT 0 NOT NULL CHECK (votes_received >= 0),
    wins INTEGER DEFAULT 0 NOT NULL CHECK (wins >= 0),
    losses INTEGER DEFAULT 0 NOT NULL CHECK (losses >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Unique constraint to prevent duplicate positions per tournament
    UNIQUE(tournament_id, position),
    
    -- Unique constraint to prevent duplicate names per tournament
    UNIQUE(tournament_id, name),
    
    -- Unique constraint for seeds within tournament (when seed is not null)
    UNIQUE(tournament_id, seed)
);

-- Create indexes for better performance
CREATE INDEX idx_contestants_tournament_id ON public.contestants(tournament_id);
CREATE INDEX idx_contestants_position ON public.contestants(tournament_id, position);
CREATE INDEX idx_contestants_seed ON public.contestants(tournament_id, seed);
CREATE INDEX idx_contestants_is_active ON public.contestants(is_active);
CREATE INDEX idx_contestants_eliminated_round ON public.contestants(eliminated_round);
CREATE INDEX idx_contestants_votes_received ON public.contestants(votes_received DESC);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_contestants_updated_at
    BEFORE UPDATE ON public.contestants
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to update tournament contestant count
CREATE TRIGGER update_tournament_contestant_count_on_insert
    AFTER INSERT ON public.contestants
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tournament_contestant_count();

CREATE TRIGGER update_tournament_contestant_count_on_delete
    AFTER DELETE ON public.contestants
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tournament_contestant_count();

-- Create function to validate contestant limits
CREATE OR REPLACE FUNCTION public.validate_contestant_limits()
RETURNS TRIGGER AS $$
DECLARE
    tournament_max_contestants INTEGER;
    current_count INTEGER;
BEGIN
    -- Get tournament max contestants
    SELECT max_contestants INTO tournament_max_contestants
    FROM public.tournaments
    WHERE id = NEW.tournament_id;
    
    -- Get current contestant count
    SELECT COUNT(*) INTO current_count
    FROM public.contestants
    WHERE tournament_id = NEW.tournament_id;
    
    -- Check if adding this contestant would exceed the limit
    IF current_count >= tournament_max_contestants THEN
        RAISE EXCEPTION 'Tournament already has maximum number of contestants (%)', tournament_max_contestants;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_contestant_limits_trigger
    BEFORE INSERT ON public.contestants
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_contestant_limits();

-- Create function to auto-assign position if not provided
CREATE OR REPLACE FUNCTION public.auto_assign_contestant_position()
RETURNS TRIGGER AS $$
BEGIN
    -- If position is not provided, auto-assign the next available position
    IF NEW.position IS NULL THEN
        SELECT COALESCE(MAX(position), 0) + 1 INTO NEW.position
        FROM public.contestants
        WHERE tournament_id = NEW.tournament_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_assign_contestant_position_trigger
    BEFORE INSERT ON public.contestants
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_assign_contestant_position();

-- Create function to update contestant stats
CREATE OR REPLACE FUNCTION public.update_contestant_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- This function will be called by triggers on the votes table
    -- to update contestant statistics
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE public.contestants IS 'Tournament participants and their information';
COMMENT ON COLUMN public.contestants.position IS 'Starting position in tournament bracket';
COMMENT ON COLUMN public.contestants.seed IS 'Tournament seeding (1 = highest seed)';
COMMENT ON COLUMN public.contestants.eliminated_round IS 'Round number when eliminated (NULL if still active)';
COMMENT ON COLUMN public.contestants.votes_received IS 'Total votes received across all matchups';
COMMENT ON COLUMN public.contestants.wins IS 'Number of matchups won';
COMMENT ON COLUMN public.contestants.losses IS 'Number of matchups lost';