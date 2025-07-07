-- Fix reset function to allow resetting completed tournaments
-- This allows admins to reset and restart any tournament

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
    
    -- Delete all votes
    DELETE FROM public.votes v
    USING public.matchups m
    WHERE v.matchup_id = m.id AND m.tournament_id = tournament_uuid;
    
    -- Delete all vote results (if table exists)
    DELETE FROM public.vote_results vr
    USING public.matchups m
    WHERE vr.matchup_id = m.id AND m.tournament_id = tournament_uuid;
    
    -- Delete all matchups
    DELETE FROM public.matchups
    WHERE tournament_id = tournament_uuid;
    
    -- Delete all rounds
    DELETE FROM public.rounds
    WHERE tournament_id = tournament_uuid;
    
    -- Reset tournament status to registration
    UPDATE public.tournaments
    SET status = 'registration'
    WHERE id = tournament_uuid;
    
    -- Reset contestant stats
    UPDATE public.contestants
    SET 
        votes_received = 0,
        wins = 0,
        losses = 0,
        eliminated_round = NULL,
        is_active = TRUE
    WHERE tournament_id = tournament_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;