-- =============================================================================
-- DEBUG FIX: Ultra-simple bracket function to identify the real issue
-- =============================================================================

-- Drop and recreate with minimal functionality to debug
DROP FUNCTION IF EXISTS public.get_bracket_data(UUID);

CREATE OR REPLACE FUNCTION public.get_bracket_data(tournament_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Just return basic tournament info to see if function works at all
    SELECT json_build_object(
        'tournament_id', tournament_uuid,
        'message', 'Function is working',
        'timestamp', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_bracket_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bracket_data(UUID) TO anon;

-- Test the function with a dummy UUID
SELECT get_bracket_data('123e4567-e89b-12d3-a456-426614174000'::UUID);