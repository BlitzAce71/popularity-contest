-- Add quadrant_names column to tournaments table
-- This allows storing custom names for tournament quadrants during creation

ALTER TABLE public.tournaments 
ADD COLUMN quadrant_names TEXT[] CHECK (array_length(quadrant_names, 1) = 4);

-- Update existing tournaments to have default quadrant names
UPDATE public.tournaments 
SET quadrant_names = ARRAY['Region A', 'Region B', 'Region C', 'Region D']
WHERE quadrant_names IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.tournaments.quadrant_names IS 'Array of 4 custom quadrant names for tournament brackets';