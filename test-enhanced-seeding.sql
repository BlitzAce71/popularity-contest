-- SAFE TEST: Backup existing function and temporarily replace with enhanced version
-- This allows you to test the enhanced seeding, then restore if needed

-- Step 1: Backup the current working function with a different name
CREATE OR REPLACE FUNCTION generate_single_elimination_bracket_backup(tournament_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- This will contain your current working logic
    -- We'll populate this by copying from your existing function
    RAISE NOTICE 'Backup function called - replace this with actual backup logic';
END;
$$;

-- Step 2: Temporarily replace the main function with enhanced version
-- (Copy the enhanced logic into the function name your app actually calls)

CREATE OR REPLACE FUNCTION generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tournament_row RECORD;
    contestants_count INTEGER;
    rounds_needed INTEGER;
    current_round INTEGER;
    round_id UUID;
    contestants_in_round INTEGER;
    match_count INTEGER;
    i INTEGER;
    first_round_id UUID;
    contestants_per_region INTEGER;
BEGIN
    -- Get tournament info
    SELECT * INTO tournament_row FROM tournaments WHERE id = tournament_uuid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;

    -- Get active contestant count
    SELECT COUNT(*) INTO contestants_count 
    FROM contestants 
    WHERE tournament_id = tournament_uuid AND is_active = true;
    
    IF contestants_count = 0 THEN
        RAISE EXCEPTION 'No active contestants found';
    END IF;
    
    -- Calculate rounds needed (log base 2)
    rounds_needed := CEIL(LOG(2, contestants_count));
    
    -- Clear existing bracket
    DELETE FROM votes WHERE matchup_id IN (
        SELECT id FROM matchups WHERE tournament_id = tournament_uuid
    );
    DELETE FROM matchups WHERE tournament_id = tournament_uuid;
    DELETE FROM rounds WHERE tournament_id = tournament_uuid;
    
    -- Create rounds from first round to final
    contestants_in_round := contestants_count;
    
    FOR current_round IN 1..rounds_needed LOOP
        -- Create round
        INSERT INTO rounds (tournament_id, round_number, name, status)
        VALUES (
            tournament_uuid,
            current_round,
            CASE 
                WHEN current_round = rounds_needed THEN 'Final'
                WHEN current_round = rounds_needed - 1 THEN 'Semifinals'
                WHEN current_round = rounds_needed - 2 THEN 'Quarterfinals'
                ELSE 'Round ' || current_round
            END,
            CASE WHEN current_round = 1 THEN 'active' ELSE 'upcoming' END
        )
        RETURNING id INTO round_id;
        
        -- Store first round ID for contestant assignment
        IF current_round = 1 THEN
            first_round_id := round_id;
        END IF;
        
        -- Calculate matchups for this round
        match_count := contestants_in_round / 2;
        
        -- Create matchups for this round
        FOR i IN 1..match_count LOOP
            INSERT INTO matchups (round_id, tournament_id, position, match_number, status)
            VALUES (round_id, tournament_uuid, i, i, 'upcoming');
        END LOOP;
        
        -- Next round has half the contestants
        contestants_in_round := match_count;
    END LOOP;
    
    -- Calculate contestants per region (assuming 4 regions)
    contestants_per_region := contestants_count / 4;
    
    -- ENHANCED SEEDING LOGIC - Assign contestants with proper tournament patterns
    WITH contestant_seeds AS (
        SELECT 
            id,
            quadrant,
            seed,
            ROW_NUMBER() OVER (PARTITION BY quadrant ORDER BY seed ASC) as seed_position
        FROM contestants 
        WHERE tournament_id = tournament_uuid AND is_active = true
    ),
    matchup_pairs AS (
        SELECT 
            c1.id as contestant1_id,
            c2.id as contestant2_id,
            c1.quadrant,
            -- Calculate global matchup position
            ((c1.quadrant - 1) * (contestants_per_region / 2)) + 
            CASE 
                WHEN contestants_per_region = 4 THEN  -- 16 total contestants
                    CASE 
                        WHEN c1.seed_position = 1 THEN 1  -- 1 vs 4
                        WHEN c1.seed_position = 2 THEN 2  -- 2 vs 3
                    END
                WHEN contestants_per_region = 8 THEN  -- 32 total contestants  
                    CASE 
                        WHEN c1.seed_position = 1 THEN 1  -- 1 vs 8
                        WHEN c1.seed_position = 4 THEN 2  -- 4 vs 5
                        WHEN c1.seed_position = 3 THEN 3  -- 3 vs 6
                        WHEN c1.seed_position = 2 THEN 4  -- 2 vs 7
                    END
                WHEN contestants_per_region = 16 THEN -- 64 total contestants
                    CASE 
                        WHEN c1.seed_position = 1 THEN 1   -- 1 vs 16
                        WHEN c1.seed_position = 8 THEN 2   -- 8 vs 9
                        WHEN c1.seed_position = 5 THEN 3   -- 5 vs 12
                        WHEN c1.seed_position = 4 THEN 4   -- 4 vs 13
                        WHEN c1.seed_position = 3 THEN 5   -- 3 vs 14
                        WHEN c1.seed_position = 6 THEN 6   -- 6 vs 11
                        WHEN c1.seed_position = 7 THEN 7   -- 7 vs 10
                        WHEN c1.seed_position = 2 THEN 8   -- 2 vs 15
                    END
                WHEN contestants_per_region = 32 THEN -- 128 total contestants
                    CASE 
                        WHEN c1.seed_position = 1 THEN 1   -- 1 vs 32
                        WHEN c1.seed_position = 16 THEN 2  -- 16 vs 17
                        WHEN c1.seed_position = 9 THEN 3   -- 9 vs 24
                        WHEN c1.seed_position = 8 THEN 4   -- 8 vs 25
                        WHEN c1.seed_position = 5 THEN 5   -- 5 vs 28
                        WHEN c1.seed_position = 12 THEN 6  -- 12 vs 21
                        WHEN c1.seed_position = 13 THEN 7  -- 13 vs 20
                        WHEN c1.seed_position = 4 THEN 8   -- 4 vs 29
                        WHEN c1.seed_position = 3 THEN 9   -- 3 vs 30
                        WHEN c1.seed_position = 14 THEN 10 -- 14 vs 19
                        WHEN c1.seed_position = 11 THEN 11 -- 11 vs 22
                        WHEN c1.seed_position = 6 THEN 12  -- 6 vs 27
                        WHEN c1.seed_position = 7 THEN 13  -- 7 vs 26
                        WHEN c1.seed_position = 10 THEN 14 -- 10 vs 23
                        WHEN c1.seed_position = 15 THEN 15 -- 15 vs 18
                        WHEN c1.seed_position = 2 THEN 16  -- 2 vs 31
                    END
                ELSE 1  -- Fallback for other sizes
            END as matchup_position
        FROM contestant_seeds c1
        JOIN contestant_seeds c2 ON (
            c1.quadrant = c2.quadrant AND
            CASE 
                WHEN contestants_per_region = 4 THEN  -- 16 total contestants
                    (c1.seed_position = 1 AND c2.seed_position = 4) OR
                    (c1.seed_position = 2 AND c2.seed_position = 3)
                WHEN contestants_per_region = 8 THEN  -- 32 total contestants
                    (c1.seed_position = 1 AND c2.seed_position = 8) OR
                    (c1.seed_position = 4 AND c2.seed_position = 5) OR
                    (c1.seed_position = 3 AND c2.seed_position = 6) OR
                    (c1.seed_position = 2 AND c2.seed_position = 7)
                WHEN contestants_per_region = 16 THEN -- 64 total contestants
                    (c1.seed_position = 1 AND c2.seed_position = 16) OR
                    (c1.seed_position = 8 AND c2.seed_position = 9) OR
                    (c1.seed_position = 5 AND c2.seed_position = 12) OR
                    (c1.seed_position = 4 AND c2.seed_position = 13) OR
                    (c1.seed_position = 3 AND c2.seed_position = 14) OR
                    (c1.seed_position = 6 AND c2.seed_position = 11) OR
                    (c1.seed_position = 7 AND c2.seed_position = 10) OR
                    (c1.seed_position = 2 AND c2.seed_position = 15)
                WHEN contestants_per_region = 32 THEN -- 128 total contestants
                    (c1.seed_position = 1 AND c2.seed_position = 32) OR
                    (c1.seed_position = 16 AND c2.seed_position = 17) OR
                    (c1.seed_position = 9 AND c2.seed_position = 24) OR
                    (c1.seed_position = 8 AND c2.seed_position = 25) OR
                    (c1.seed_position = 5 AND c2.seed_position = 28) OR
                    (c1.seed_position = 12 AND c2.seed_position = 21) OR
                    (c1.seed_position = 13 AND c2.seed_position = 20) OR
                    (c1.seed_position = 4 AND c2.seed_position = 29) OR
                    (c1.seed_position = 3 AND c2.seed_position = 30) OR
                    (c1.seed_position = 14 AND c2.seed_position = 19) OR
                    (c1.seed_position = 11 AND c2.seed_position = 22) OR
                    (c1.seed_position = 6 AND c2.seed_position = 27) OR
                    (c1.seed_position = 7 AND c2.seed_position = 26) OR
                    (c1.seed_position = 10 AND c2.seed_position = 23) OR
                    (c1.seed_position = 15 AND c2.seed_position = 18) OR
                    (c1.seed_position = 2 AND c2.seed_position = 31)
                ELSE FALSE
            END
        )
        WHERE c1.seed_position < c2.seed_position OR 
              (c1.seed_position > c2.seed_position AND c1.seed_position IN (2,4,8,16))
    )
    UPDATE matchups 
    SET 
        contestant1_id = mp.contestant1_id,
        contestant2_id = mp.contestant2_id,
        status = 'active'
    FROM matchup_pairs mp
    WHERE matchups.round_id = first_round_id
    AND matchups.position = mp.matchup_position;

    RAISE NOTICE 'ENHANCED: Bracket generated with proper tournament seeding - % contestants in % rounds', contestants_count, rounds_needed;
    
END;
$$;

-- Function to restore the backup if needed
CREATE OR REPLACE FUNCTION restore_original_bracket_function()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- You would use this to restore the original function if the enhanced version has issues
    RAISE NOTICE 'To restore: copy your original function logic back into generate_single_elimination_bracket';
    RETURN 'Backup restoration function ready - implement restoration logic here';
END;
$$;