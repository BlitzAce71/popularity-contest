-- Fix reset function to work with current database schema
-- Removes references to non-existent tables and columns

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
    
    -- Reset tournament status to registration
    UPDATE public.tournaments
    SET status = 'registration'
    WHERE id = tournament_uuid;
    
    -- Reset contestant stats (only reset existing columns)
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