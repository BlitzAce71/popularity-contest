-- Create tournaments table for managing popularity contests
-- This table stores all tournament information and settings

CREATE TYPE tournament_status AS ENUM ('draft', 'registration', 'active', 'completed', 'cancelled');
CREATE TYPE bracket_type AS ENUM ('single-elimination', 'double-elimination', 'round-robin');

CREATE TABLE public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (LENGTH(name) >= 3 AND LENGTH(name) <= 100),
    description TEXT CHECK (LENGTH(description) <= 1000),
    image_url TEXT,
    status tournament_status DEFAULT 'draft' NOT NULL,
    bracket_type bracket_type DEFAULT 'single-elimination' NOT NULL,
    size INTEGER NOT NULL CHECK (size >= 4 AND size <= 256 AND (size & (size - 1)) = 0), -- Must be power of 2
    max_contestants INTEGER NOT NULL CHECK (max_contestants >= 4 AND max_contestants <= 256),
    current_contestants INTEGER DEFAULT 0 NOT NULL CHECK (current_contestants >= 0),
    registration_deadline TIMESTAMP WITH TIME ZONE,
    tournament_start_date TIMESTAMP WITH TIME ZONE,
    tournament_end_date TIMESTAMP WITH TIME ZONE,
    voting_duration_hours INTEGER DEFAULT 24 NOT NULL CHECK (voting_duration_hours >= 1 AND voting_duration_hours <= 168),
    is_public BOOLEAN DEFAULT TRUE NOT NULL,
    allow_ties BOOLEAN DEFAULT FALSE NOT NULL,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraint to ensure logical date ordering
    CONSTRAINT valid_tournament_dates CHECK (
        (registration_deadline IS NULL OR tournament_start_date IS NULL OR registration_deadline <= tournament_start_date) AND
        (tournament_start_date IS NULL OR tournament_end_date IS NULL OR tournament_start_date <= tournament_end_date)
    ),
    
    -- Constraint to ensure size matches max_contestants for single elimination
    CONSTRAINT size_constraint CHECK (
        (bracket_type = 'single-elimination' AND size = max_contestants) OR
        (bracket_type != 'single-elimination')
    )
);

-- Create indexes for better performance
CREATE INDEX idx_tournaments_status ON public.tournaments(status);
CREATE INDEX idx_tournaments_created_by ON public.tournaments(created_by);
CREATE INDEX idx_tournaments_is_public ON public.tournaments(is_public);
CREATE INDEX idx_tournaments_bracket_type ON public.tournaments(bracket_type);
CREATE INDEX idx_tournaments_created_at ON public.tournaments(created_at DESC);
CREATE INDEX idx_tournaments_registration_deadline ON public.tournaments(registration_deadline);
CREATE INDEX idx_tournaments_tournament_start_date ON public.tournaments(tournament_start_date);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_tournaments_updated_at
    BEFORE UPDATE ON public.tournaments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to validate tournament progression
CREATE OR REPLACE FUNCTION public.validate_tournament_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow certain status transitions
    IF OLD.status != NEW.status THEN
        CASE OLD.status
            WHEN 'draft' THEN
                IF NEW.status NOT IN ('registration', 'cancelled') THEN
                    RAISE EXCEPTION 'Invalid status transition from draft to %', NEW.status;
                END IF;
            WHEN 'registration' THEN
                IF NEW.status NOT IN ('active', 'cancelled') THEN
                    RAISE EXCEPTION 'Invalid status transition from registration to %', NEW.status;
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
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_tournament_status_change_trigger
    BEFORE UPDATE ON public.tournaments
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_tournament_status_change();

-- Create function to update current_contestants count
CREATE OR REPLACE FUNCTION public.update_tournament_contestant_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.tournaments 
        SET current_contestants = current_contestants + 1
        WHERE id = NEW.tournament_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.tournaments 
        SET current_contestants = current_contestants - 1
        WHERE id = OLD.tournament_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE public.tournaments IS 'Tournament definitions and settings';
COMMENT ON COLUMN public.tournaments.size IS 'Tournament bracket size (must be power of 2)';
COMMENT ON COLUMN public.tournaments.max_contestants IS 'Maximum number of contestants allowed';
COMMENT ON COLUMN public.tournaments.current_contestants IS 'Current number of registered contestants';
COMMENT ON COLUMN public.tournaments.voting_duration_hours IS 'How long each voting round lasts';
COMMENT ON COLUMN public.tournaments.allow_ties IS 'Whether to allow tie votes or require tiebreakers';
COMMENT ON TYPE tournament_status IS 'Tournament lifecycle states';
COMMENT ON TYPE bracket_type IS 'Tournament bracket format types';