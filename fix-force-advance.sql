-- Fix force_advance_round function based on ACTUAL current database schema
-- Vote counts are in vote_results table, not matchups table

CREATE OR REPLACE FUNCTION public.force_advance_round(tournament_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    current_round_id UUID;
    current_round_number INTEGER;
    matchup_record RECORD;
    winners_declared INTEGER := 0;
    ties_found INTEGER := 0;
    result JSONB;
BEGIN
    -- Find current active round
    SELECT id, round_number INTO current_round_id, current_round_number
    FROM public.rounds
    WHERE tournament_id = tournament_uuid AND status = 'active'
    ORDER BY round_number DESC
    LIMIT 1;
    
    IF current_round_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No active round found for tournament'
        );
    END IF;
    
    -- Process all active matchups in current round
    -- Get vote counts from vote_results table, not matchups table
    FOR matchup_record IN 
        SELECT 
            m.id as matchup_id,
            m.contestant1_id,
            m.contestant2_id,
            COALESCE(vr.contestant1_votes, 0) as contestant1_votes,
            COALESCE(vr.contestant2_votes, 0) as contestant2_votes,
            COALESCE(vr.total_votes, 0) as total_votes
        FROM public.matchups m
        LEFT JOIN public.vote_results vr ON m.id = vr.matchup_id
        WHERE m.round_id = current_round_id 
        AND m.status IN ('active', 'upcoming')
        AND m.contestant1_id IS NOT NULL 
        AND m.contestant2_id IS NOT NULL
    LOOP
        -- Declare winner based on current vote count
        IF matchup_record.contestant1_votes > matchup_record.contestant2_votes THEN
            -- Contestant 1 wins
            UPDATE public.matchups
            SET 
                winner_id = matchup_record.contestant1_id,
                status = 'completed'
            WHERE id = matchup_record.matchup_id;
            
            winners_declared := winners_declared + 1;
            
        ELSIF matchup_record.contestant2_votes > matchup_record.contestant1_votes THEN
            -- Contestant 2 wins
            UPDATE public.matchups
            SET 
                winner_id = matchup_record.contestant2_id,
                status = 'completed'
            WHERE id = matchup_record.matchup_id;
            
            winners_declared := winners_declared + 1;
            
        ELSE
            -- It's a tie - default tie-breaking: favor contestant1
            ties_found := ties_found + 1;
            
            UPDATE public.matchups
            SET 
                winner_id = matchup_record.contestant1_id,
                status = 'completed'
            WHERE id = matchup_record.matchup_id;
            
            winners_declared := winners_declared + 1;
        END IF;
    END LOOP;
    
    -- Return results
    result := jsonb_build_object(
        'success', true,
        'winners_declared', winners_declared,
        'ties_resolved', ties_found,
        'round_advanced', true,
        'message', format('Force advanced round %s: %s winners declared, %s ties resolved', 
                         current_round_number, winners_declared, ties_found)
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'winners_declared', winners_declared,
        'ties_found', ties_found
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;