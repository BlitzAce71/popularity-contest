-- Add slug support to tournaments for user-friendly URLs
-- This maintains backward compatibility with existing UUID-based URLs

-- Add slug column to tournaments table
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Create function to generate URL-friendly slugs from tournament names
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Convert to lowercase, replace spaces and special chars with hyphens, remove consecutive hyphens
    RETURN regexp_replace(
        regexp_replace(
            regexp_replace(
                lower(trim(input_text)),
                '[^a-z0-9\s\-]', '', 'g'  -- Remove special chars except spaces and hyphens
            ),
            '\s+', '-', 'g'  -- Replace spaces with hyphens
        ),
        '\-+', '-', 'g'  -- Replace multiple consecutive hyphens with single hyphen
    );
END;
$$;

-- Create function to ensure unique slugs by adding numbers if needed
CREATE OR REPLACE FUNCTION generate_unique_slug(input_text TEXT, tournament_id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 1;
BEGIN
    -- Generate base slug
    base_slug := generate_slug(input_text);
    final_slug := base_slug;
    
    -- Check for uniqueness and add counter if needed
    WHILE EXISTS (
        SELECT 1 FROM tournaments 
        WHERE slug = final_slug 
        AND (tournament_id IS NULL OR id != tournament_id)
    ) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$;

-- Generate slugs for existing tournaments that don't have them
UPDATE tournaments 
SET slug = generate_unique_slug(name, id)
WHERE slug IS NULL;

-- Create trigger to automatically generate slugs for new tournaments
CREATE OR REPLACE FUNCTION set_tournament_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only set slug if it's not provided or if name changed
    IF NEW.slug IS NULL OR (TG_OP = 'UPDATE' AND OLD.name != NEW.name AND NEW.slug = OLD.slug) THEN
        NEW.slug := generate_unique_slug(NEW.name, NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger for INSERT and UPDATE
DROP TRIGGER IF EXISTS tournament_slug_trigger ON tournaments;
CREATE TRIGGER tournament_slug_trigger
    BEFORE INSERT OR UPDATE ON tournaments
    FOR EACH ROW
    EXECUTE FUNCTION set_tournament_slug();

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_tournaments_slug ON tournaments(slug);

-- Add a function to get tournament by slug or ID (for backward compatibility)
CREATE OR REPLACE FUNCTION get_tournament_by_slug_or_id(identifier TEXT)
RETURNS tournaments
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tournament_record tournaments;
BEGIN
    -- First try to find by slug
    SELECT * INTO tournament_record
    FROM tournaments
    WHERE slug = identifier;
    
    -- If not found and identifier looks like UUID, try by ID
    IF NOT FOUND AND identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT * INTO tournament_record
        FROM tournaments
        WHERE id = identifier::UUID;
    END IF;
    
    RETURN tournament_record;
END;
$$;