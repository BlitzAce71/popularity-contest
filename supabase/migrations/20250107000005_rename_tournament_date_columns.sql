-- Rename tournament date columns to match frontend expectations
-- This fixes the mismatch between database column names and frontend code

-- Rename tournament_start_date to start_date
ALTER TABLE public.tournaments 
RENAME COLUMN tournament_start_date TO start_date;

-- Rename tournament_end_date to end_date
ALTER TABLE public.tournaments 
RENAME COLUMN tournament_end_date TO end_date;

-- Update the existing index
DROP INDEX IF EXISTS idx_tournaments_tournament_start_date;
CREATE INDEX idx_tournaments_start_date ON public.tournaments(start_date);

-- Update constraints (need to drop and recreate)
ALTER TABLE public.tournaments 
DROP CONSTRAINT IF EXISTS valid_tournament_dates;

ALTER TABLE public.tournaments 
ADD CONSTRAINT valid_tournament_dates CHECK (
    (registration_deadline IS NULL OR start_date IS NULL OR registration_deadline <= start_date) AND
    (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

-- Update comments
COMMENT ON COLUMN public.tournaments.start_date IS 'Tournament start date and time';
COMMENT ON COLUMN public.tournaments.end_date IS 'Tournament end date and time';