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
    next_round_id UUID;
    winner_record RECORD;
    next_matchup_position INTEGER := 1;
    contestant_position INTEGER := 1;
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
    
    -- Now advance to the next round
    -- 1. Mark current round as completed
    UPDATE public.rounds 
    SET status = 'completed'
    WHERE id = current_round_id;
    
    -- 2. Populate next round with winners and activate it
    -- Find next round
    SELECT id INTO next_round_id
    FROM public.rounds
    WHERE tournament_id = tournament_uuid 
    AND round_number = current_round_number + 1;
    
    IF next_round_id IS NOT NULL THEN
        -- Get winners from current round in order
        FOR winner_record IN
            SELECT winner_id, position
            FROM public.matchups
            WHERE round_id = current_round_id 
            AND status = 'completed'
            AND winner_id IS NOT NULL
            ORDER BY position
        LOOP
            -- Every 2 winners form a new matchup
            IF contestant_position % 2 = 1 THEN
                -- First contestant in new matchup
                UPDATE public.matchups
                SET contestant1_id = winner_record.winner_id
                WHERE round_id = next_round_id 
                AND position = next_matchup_position;
            ELSE
                -- Second contestant in matchup, advance to next matchup
                UPDATE public.matchups
                SET contestant2_id = winner_record.winner_id
                WHERE round_id = next_round_id 
                AND position = next_matchup_position;
                
                next_matchup_position := next_matchup_position + 1;
            END IF;
            
            contestant_position := contestant_position + 1;
        END LOOP;
        
        -- Activate the next round
        UPDATE public.rounds 
        SET status = 'active'
        WHERE id = next_round_id;
    END IF;
    
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