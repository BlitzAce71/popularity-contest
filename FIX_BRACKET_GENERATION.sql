-- FIX BRACKET GENERATION FUNCTION
-- This creates a proper bracket generation function that handles both intra-quadrant 
-- and inter-quadrant matchups to allow tournaments to complete properly

-- =============================================================================
-- 1. CREATE IMPROVED generate_single_elimination_bracket FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    contestant_count INTEGER;
    total_rounds INTEGER;
    current_contestants UUID[];
    round_num INTEGER;
    round_id UUID;
    matchup_counter INTEGER;
    i INTEGER;
    matchup_count INTEGER;
BEGIN
    -- Get active contestants ordered by quadrant and seed
    SELECT array_agg(id ORDER BY quadrant, COALESCE(seed, 999), created_at)
    INTO current_contestants
    FROM contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE;
    
    contestant_count := array_length(current_contestants, 1);
    
    -- Validate contestant count
    IF contestant_count IS NULL OR contestant_count < 2 THEN
        RAISE EXCEPTION 'Need at least 2 contestants to generate bracket';
    END IF;
    
    -- Check if it's a power of 2
    IF (contestant_count & (contestant_count - 1)) != 0 THEN
        RAISE EXCEPTION 'Contestant count must be a power of 2 (2, 4, 8, 16, 32, etc.)';
    END IF;
    
    -- Calculate total rounds needed
    total_rounds := floor(log(2, contestant_count))::INTEGER;
    
    -- Clean up existing bracket data
    DELETE FROM matchups WHERE tournament_id = tournament_uuid;
    DELETE FROM rounds WHERE tournament_id = tournament_uuid;
    
    -- Generate all rounds
    FOR round_num IN 1..total_rounds LOOP
        -- Create round
        INSERT INTO rounds (tournament_id, round_number, name, status)
        VALUES (
            tournament_uuid,
            round_num,
            CASE 
                WHEN total_rounds = 1 THEN 'Final'
                WHEN round_num = total_rounds THEN 'Final'
                WHEN round_num = total_rounds - 1 THEN 'Semi-Finals'
                WHEN round_num = total_rounds - 2 THEN 'Quarter-Finals'
                WHEN round_num = total_rounds - 3 THEN 'Round of 16'
                WHEN round_num = total_rounds - 4 THEN 'Round of 32'
                ELSE 'Round ' || round_num::TEXT
            END,
            CASE WHEN round_num = 1 THEN 'active' ELSE 'upcoming' END
        )
        RETURNING id INTO round_id;
        
        -- Calculate number of matchups for this round
        matchup_count := array_length(current_contestants, 1) / 2;
        matchup_counter := 1;
        
        -- Create matchups for this round
        FOR i IN 1..matchup_count LOOP
            IF round_num = 1 THEN
                -- First round: pair contestants properly
                INSERT INTO matchups (
                    round_id,
                    tournament_id,
                    match_number,
                    contestant1_id,
                    contestant2_id,
                    status,
                    position
                ) VALUES (
                    round_id,
                    tournament_uuid,
                    matchup_counter,
                    current_contestants[i * 2 - 1],  -- odd positions: 1, 3, 5, 7...
                    current_contestants[i * 2],      -- even positions: 2, 4, 6, 8...
                    'active',
                    matchup_counter
                );
            ELSE
                -- Later rounds: create empty matchups that will be filled by winners
                INSERT INTO matchups (
                    round_id,
                    tournament_id,
                    match_number,
                    contestant1_id,
                    contestant2_id,
                    status,
                    position
                ) VALUES (
                    round_id,
                    tournament_uuid,
                    matchup_counter,
                    NULL,
                    NULL,
                    'upcoming',
                    matchup_counter
                );
            END IF;
            
            matchup_counter := matchup_counter + 1;
        END LOOP;
        
        -- For next round, we'll have half as many contestants (winners)
        -- We'll create a new array with the right size, but it will be populated later by winners
        current_contestants := current_contestants[1:matchup_count];
    END LOOP;
    
    -- Create vote_results entries for all matchups
    INSERT INTO vote_results (
        matchup_id,
        contestant1_votes,
        contestant2_votes,
        total_votes,
        winner_id,
        is_tie,
        last_updated
    )
    SELECT 
        m.id,
        0,
        0,
        0,
        NULL,
        FALSE,
        NOW()
    FROM matchups m
    WHERE m.tournament_id = tournament_uuid
    ON CONFLICT (matchup_id) DO NOTHING;
    
    -- Update tournament status to active
    UPDATE tournaments 
    SET status = 'active'
    WHERE id = tournament_uuid;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 2. CREATE IMPROVED populate_next_round_matchups FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.populate_next_round_matchups(
    p_tournament_id UUID,
    p_round_id UUID
)
RETURNS VOID AS $$
DECLARE
    prev_round_id UUID;
    prev_round_number INTEGER;
    current_round_number INTEGER;
    winner_rec RECORD;
    winners UUID[];
    matchup_counter INTEGER := 1;
    i INTEGER;
    matchup_count INTEGER;
BEGIN
    -- Get current round number
    SELECT round_number INTO current_round_number
    FROM rounds
    WHERE id = p_round_id;
    
    -- Get previous round
    SELECT id, round_number INTO prev_round_id, prev_round_number
    FROM rounds
    WHERE tournament_id = p_tournament_id
    AND round_number = current_round_number - 1;
    
    IF prev_round_id IS NULL THEN
        RAISE EXCEPTION 'Previous round not found';
    END IF;
    
    -- Get all winners from previous round in order
    FOR winner_rec IN 
        SELECT winner_id, match_number
        FROM matchups
        WHERE round_id = prev_round_id
        AND winner_id IS NOT NULL
        ORDER BY match_number
    LOOP
        winners := array_append(winners, winner_rec.winner_id);
    END LOOP;
    
    -- Check if we have the right number of winners
    SELECT COUNT(*) INTO matchup_count
    FROM matchups
    WHERE round_id = p_round_id;
    
    IF array_length(winners, 1) != matchup_count * 2 THEN
        RAISE EXCEPTION 'Not enough winners from previous round. Expected %, got %', 
                       matchup_count * 2, array_length(winners, 1);
    END IF;
    
    -- Update matchups with winners
    FOR i IN 1..matchup_count LOOP
        UPDATE matchups
        SET 
            contestant1_id = winners[i * 2 - 1],
            contestant2_id = winners[i * 2],
            status = 'active'
        WHERE round_id = p_round_id
        AND match_number = i;
        
        -- Create vote_results entry for this matchup
        INSERT INTO vote_results (
            matchup_id,
            contestant1_votes,
            contestant2_votes,
            total_votes,
            winner_id,
            is_tie,
            last_updated
        )
        SELECT 
            m.id,
            0,
            0,
            0,
            NULL,
            FALSE,
            NOW()
        FROM matchups m
        WHERE m.round_id = p_round_id
        AND m.match_number = i
        ON CONFLICT (matchup_id) DO NOTHING;
    END LOOP;
    
    -- Update round status to active
    UPDATE rounds
    SET status = 'active'
    WHERE id = p_round_id;
    
    -- Update previous round status to completed
    UPDATE rounds
    SET status = 'completed'
    WHERE id = prev_round_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. CREATE FUNCTION TO PROPERLY SEED CONTESTANTS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.seed_contestants_properly(tournament_uuid UUID)
RETURNS VOID AS $$
DECLARE
    contestant_count INTEGER;
    contestant_rec RECORD;
    counter INTEGER := 1;
    quadrant INTEGER;
    seed_in_quadrant INTEGER;
BEGIN
    -- Get total contestant count
    SELECT COUNT(*) INTO contestant_count
    FROM contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE;
    
    -- For proper bracket seeding, we need to distribute contestants across quadrants
    -- and assign proper seeds within each quadrant
    
    FOR contestant_rec IN 
        SELECT id, name
        FROM contestants
        WHERE tournament_id = tournament_uuid AND is_active = TRUE
        ORDER BY created_at
    LOOP
        -- Calculate quadrant (1-4) and seed within quadrant
        quadrant := ((counter - 1) % 4) + 1;
        seed_in_quadrant := ((counter - 1) / 4) + 1;
        
        -- Update contestant with proper quadrant and seed
        UPDATE contestants
        SET 
            quadrant = quadrant,
            seed = seed_in_quadrant
        WHERE id = contestant_rec.id;
        
        counter := counter + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'BRACKET GENERATION FUNCTIONS FIXED';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Updated functions:';
    RAISE NOTICE '✓ generate_single_elimination_bracket - Now handles proper bracket progression';
    RAISE NOTICE '✓ populate_next_round_matchups - Improved winner advancement logic';
    RAISE NOTICE '✓ seed_contestants_properly - Helper function for proper seeding';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'The bracket generation now:';
    RAISE NOTICE '• Works for any power-of-2 contestant count (2, 4, 8, 16, 32, etc.)';
    RAISE NOTICE '• Creates proper matchups in first round';
    RAISE NOTICE '• Handles tournament progression through all rounds';
    RAISE NOTICE '• Automatically creates vote_results entries';
    RAISE NOTICE '• Uses simple linear pairing instead of complex quadrant logic';
    RAISE NOTICE '============================================================================';
END $$;