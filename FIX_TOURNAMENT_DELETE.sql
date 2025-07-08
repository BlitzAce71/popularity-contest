-- QUICK FIX: Update database functions to remove references to deleted columns
-- This fixes the tournament deletion error

-- =============================================================================
-- 1. Fix force_advance_round function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.force_advance_round(
    p_tournament_id UUID,
    p_round_id UUID DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    winners_declared INTEGER,
    next_round_created BOOLEAN,
    next_round_id UUID
) AS $$
DECLARE
    current_round_id UUID;
    current_round_number INTEGER;
    next_round_number INTEGER;
    next_round_id UUID;
    winners_count INTEGER := 0;
    matchup_rec RECORD;
    leading_contestant_id UUID;
    vote_count INTEGER;
BEGIN
    -- Get current round info
    IF p_round_id IS NULL THEN
        SELECT r.id, r.round_number 
        INTO current_round_id, current_round_number
        FROM rounds r
        WHERE r.tournament_id = p_tournament_id 
        AND r.status = 'active'
        ORDER BY r.round_number DESC
        LIMIT 1;
    ELSE
        SELECT r.id, r.round_number 
        INTO current_round_id, current_round_number
        FROM rounds r
        WHERE r.id = p_round_id;
    END IF;

    IF current_round_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'No active round found', 0, FALSE, NULL::UUID;
        RETURN;
    END IF;

    -- Force advance by declaring winners for leading contestants
    FOR matchup_rec IN 
        SELECT m.id, m.contestant1_id, m.contestant2_id
        FROM matchups m
        WHERE m.round_id = current_round_id
        AND m.winner_id IS NULL
    LOOP
        -- Get vote counts from vote_results table
        SELECT 
            CASE 
                WHEN vr.contestant1_votes > vr.contestant2_votes THEN m.contestant1_id
                WHEN vr.contestant2_votes > vr.contestant1_votes THEN m.contestant2_id
                ELSE m.contestant1_id -- Default to contestant1 in case of tie
            END
        INTO leading_contestant_id
        FROM matchups m
        LEFT JOIN vote_results vr ON m.id = vr.matchup_id
        WHERE m.id = matchup_rec.id;

        -- If no vote results exist, default to contestant1
        IF leading_contestant_id IS NULL THEN
            leading_contestant_id := matchup_rec.contestant1_id;
        END IF;

        -- Update matchup with winner
        UPDATE matchups 
        SET winner_id = leading_contestant_id,
            status = 'completed'
        WHERE id = matchup_rec.id;

        winners_count := winners_count + 1;
    END LOOP;

    -- Check if we can advance to next round
    IF NOT EXISTS (
        SELECT 1 FROM matchups 
        WHERE round_id = current_round_id AND winner_id IS NULL
    ) THEN
        -- Update round status
        UPDATE rounds SET status = 'completed' WHERE id = current_round_id;
        
        -- Create next round
        next_round_number := current_round_number + 1;
        
        INSERT INTO rounds (tournament_id, round_number, name, status)
        VALUES (p_tournament_id, next_round_number, 'Round ' || next_round_number, 'active')
        RETURNING id INTO next_round_id;
        
        -- Populate next round matchups
        PERFORM populate_next_round_matchups(p_tournament_id, next_round_id);
        
        RETURN QUERY SELECT TRUE, 'Round advanced successfully', winners_count, TRUE, next_round_id;
    ELSE
        RETURN QUERY SELECT TRUE, 'Winners declared, round not yet complete', winners_count, FALSE, NULL::UUID;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 2. Fix get_bracket_data function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_bracket_data(tournament_id_param UUID)
RETURNS TABLE (
    round_number INTEGER,
    round_name TEXT,
    round_status TEXT,
    matchups JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.round_number,
        r.name as round_name,
        r.status as round_status,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', m.id,
                    'match_number', m.match_number,
                    'contestant1', CASE 
                        WHEN m.contestant1_id IS NOT NULL THEN 
                            jsonb_build_object(
                                'id', c1.id,
                                'name', c1.name,
                                'image_url', c1.image_url,
                                'seed', c1.seed,
                                'quadrant', c1.quadrant
                            )
                        ELSE NULL 
                    END,
                    'contestant2', CASE 
                        WHEN m.contestant2_id IS NOT NULL THEN 
                            jsonb_build_object(
                                'id', c2.id,
                                'name', c2.name,
                                'image_url', c2.image_url,
                                'seed', c2.seed,
                                'quadrant', c2.quadrant
                            )
                        ELSE NULL 
                    END,
                    'winner_id', m.winner_id,
                    'status', m.status,
                    'position', m.position,
                    'vote_counts', CASE 
                        WHEN vr.matchup_id IS NOT NULL THEN 
                            jsonb_build_object(
                                'contestant1_votes', vr.contestant1_votes,
                                'contestant2_votes', vr.contestant2_votes,
                                'total_votes', vr.total_votes
                            )
                        ELSE 
                            jsonb_build_object(
                                'contestant1_votes', 0,
                                'contestant2_votes', 0,
                                'total_votes', 0
                            )
                    END
                )
                ORDER BY m.match_number
            ),
            '[]'::jsonb
        ) as matchups
    FROM rounds r
    LEFT JOIN matchups m ON r.id = m.round_id
    LEFT JOIN contestants c1 ON m.contestant1_id = c1.id
    LEFT JOIN contestants c2 ON m.contestant2_id = c2.id
    LEFT JOIN vote_results vr ON m.id = vr.matchup_id
    WHERE r.tournament_id = tournament_id_param
    GROUP BY r.round_number, r.name, r.status
    ORDER BY r.round_number;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMPLETION
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Tournament deletion fix applied successfully';
    RAISE NOTICE 'Updated functions to use vote_results table instead of removed columns';
END $$;