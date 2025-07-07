-- Minimal reset function that only uses core functionality
-- Only resets what's absolutely necessary for tournament restart

DROP FUNCTION IF EXISTS public.reset_tournament_bracket(UUID);

CREATE OR REPLACE FUNCTION public.reset_tournament_bracket(tournament_uuid UUID)
RETURNS VOID AS $$
BEGIN
    -- Can reset tournaments in any status except draft (which has nothing to reset)
    IF EXISTS (
        SELECT 1 FROM public.tournaments
        WHERE id = tournament_uuid AND status = 'draft'
    ) THEN
        RAISE EXCEPTION 'Cannot reset draft tournament - no bracket exists yet';
    END IF;
    
    -- Delete all votes for this tournament
    DELETE FROM public.votes 
    WHERE matchup_id IN (
        SELECT m.id FROM public.matchups m 
        WHERE m.tournament_id = tournament_uuid
    );
    
    -- Delete all matchups
    DELETE FROM public.matchups
    WHERE tournament_id = tournament_uuid;
    
    -- Delete all rounds
    DELETE FROM public.rounds
    WHERE tournament_id = tournament_uuid;
    
    -- Reset tournament status to registration so it can be started again
    UPDATE public.tournaments
    SET status = 'registration'
    WHERE id = tournament_uuid;
    
    -- Reset only basic contestant status (minimal columns)
    UPDATE public.contestants
    SET is_active = TRUE
    WHERE tournament_id = tournament_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;