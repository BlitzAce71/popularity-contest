-- Fix the slug trigger to properly handle INSERT operations
-- The original trigger had a logical issue with INSERT operations

-- Drop and recreate the trigger function with better logic
DROP TRIGGER IF EXISTS tournament_slug_trigger ON tournaments;

CREATE OR REPLACE FUNCTION set_tournament_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- For INSERT operations, always generate slug if not provided
    IF TG_OP = 'INSERT' THEN
        IF NEW.slug IS NULL OR NEW.slug = '' THEN
            NEW.slug := generate_unique_slug(NEW.name, NEW.id);
        END IF;
        RETURN NEW;
    END IF;
    
    -- For UPDATE operations, regenerate slug if name changed
    IF TG_OP = 'UPDATE' THEN
        IF OLD.name != NEW.name THEN
            NEW.slug := generate_unique_slug(NEW.name, NEW.id);
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER tournament_slug_trigger
    BEFORE INSERT OR UPDATE ON tournaments
    FOR EACH ROW
    EXECUTE FUNCTION set_tournament_slug();

-- Test the fix by updating an existing tournament to regenerate its slug
-- (This will help verify the trigger is working)
UPDATE tournaments 
SET name = name  -- This should trigger slug regeneration
WHERE slug IS NULL OR slug = ''
LIMIT 1;