-- Debug tournament start issue
-- Let's check what's happening step by step

-- First, let's see what data we have for the tournament
-- Run this in SQL editor to see the tournament data:
-- SELECT id, name, status, max_contestants, current_contestants FROM tournaments WHERE id = 'e2bb8771-122c-40d5-9da8-c5358bcb27f5';

-- Check contestants for this tournament:
-- SELECT id, name, tournament_id, is_active FROM contestants WHERE tournament_id = 'e2bb8771-122c-40d5-9da8-c5358bcb27f5';

-- Let's create a simple debug function to test bracket generation
CREATE OR REPLACE FUNCTION public.debug_start_tournament(tournament_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    tournament_data JSONB;
    contestant_data JSONB;
    result JSONB;
BEGIN
    -- Get tournament info
    SELECT jsonb_build_object(
        'id', id,
        'name', name,
        'status', status,
        'max_contestants', max_contestants,
        'current_contestants', current_contestants
    ) INTO tournament_data
    FROM public.tournaments
    WHERE id = tournament_uuid;
    
    -- Get contestant info
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'is_active', is_active,
        'position', position,
        'seed', seed
    )) INTO contestant_data
    FROM public.contestants
    WHERE tournament_id = tournament_uuid;
    
    -- Check if we can start
    result := jsonb_build_object(
        'tournament', tournament_data,
        'contestants', contestant_data,
        'contestant_count', (SELECT COUNT(*) FROM public.contestants WHERE tournament_id = tournament_uuid AND is_active = TRUE),
        'can_start', (SELECT public.can_start_tournament(tournament_uuid))
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also let's fix the can_start_tournament function to be more permissive
DROP FUNCTION IF EXISTS public.can_start_tournament(UUID);

CREATE OR REPLACE FUNCTION public.can_start_tournament(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    contestant_count INTEGER;
    tournament_status tournament_status;
BEGIN
    -- Get tournament status
    SELECT status INTO tournament_status
    FROM public.tournaments
    WHERE id = tournament_uuid;
    
    -- Allow starting from draft or registration status
    IF tournament_status NOT IN ('draft', 'registration') THEN
        RETURN FALSE;
    END IF;
    
    -- Count active contestants
    SELECT COUNT(*) INTO contestant_count
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE;
    
    -- Need at least 2 contestants
    RETURN contestant_count >= 2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;