-- TOURNAMENT SEEDING FIX - Implement proper tournament matchup patterns
-- Fix the seeding logic to use correct tournament-style pairings

DROP FUNCTION IF EXISTS generate_single_elimination_bracket(uuid);

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
        
        -- Create matchups for this round - INCLUDING match_number
        FOR i IN 1..match_count LOOP
            INSERT INTO matchups (round_id, tournament_id, position, match_number, status)
            VALUES (round_id, tournament_uuid, i, i, 'upcoming');
        END LOOP;
        
        -- Next round has half the contestants
        contestants_in_round := match_count;
    END LOOP;
    
    -- ======================================================================
    -- PROPER TOURNAMENT SEEDING LOGIC
    -- ======================================================================
    
    -- Calculate contestants per region (assuming 4 regions)
    contestants_per_region := contestants_count / 4;
    
    -- Assign contestants to first round matchups with PROPER TOURNAMENT SEEDING
    WITH contestant_seeds AS (
        -- Get all contestants with their quadrant and seed info
        SELECT 
            id,
            quadrant,
            seed,
            -- Number contestants within each quadrant by seed order
            ROW_NUMBER() OVER (PARTITION BY quadrant ORDER BY seed ASC) as seed_position
        FROM contestants 
        WHERE tournament_id = tournament_uuid AND is_active = true
    ),
    matchup_pairs AS (
        -- Create proper tournament seed pairings based on tournament size
        SELECT 
            c1.id as contestant1_id,
            c2.id as contestant2_id,
            c1.quadrant,
            -- Calculate position within this region's bracket
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
            END as region_match_position,
            -- Calculate global matchup position: (quadrant-1) * matches_per_region + region_position
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
            -- Define the proper pairings based on tournament size
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
                ELSE FALSE -- Fallback for other sizes
            END
        )
        -- Only take the "first" contestant from each pair to avoid duplicates
        WHERE c1.seed_position < c2.seed_position OR 
              (c1.seed_position > c2.seed_position AND c1.seed_position IN (2,4,8,16))
    )
    -- Update matchups with the corrected seeded pairs
    UPDATE matchups 
    SET 
        contestant1_id = mp.contestant1_id,
        contestant2_id = mp.contestant2_id,
        status = 'active'
    FROM matchup_pairs mp
    WHERE matchups.round_id = first_round_id
    AND matchups.position = mp.matchup_position;

    RAISE NOTICE 'Bracket generated successfully with % contestants in % rounds using proper tournament seeding', contestants_count, rounds_needed;
    
END;
$$;

-- Drop existing functions to avoid return type conflicts
DROP FUNCTION IF EXISTS advance_to_next_round(uuid);
DROP FUNCTION IF EXISTS force_advance_round(uuid);
DROP FUNCTION IF EXISTS setup_final_four_matchups(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS reset_tournament_bracket(uuid);
DROP FUNCTION IF EXISTS finalize_matchup(uuid);

-- Create function to advance tournament to next round
CREATE OR REPLACE FUNCTION advance_to_next_round(tournament_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_round_record RECORD;
    next_round_record RECORD;
    matchup_record RECORD;
    winners_cursor CURSOR FOR 
        SELECT winner_id, position FROM matchups 
        WHERE round_id = current_round_record.id 
        AND winner_id IS NOT NULL 
        ORDER BY position;
    next_position INTEGER := 1;
BEGIN
    -- Get the current active round
    SELECT * INTO current_round_record
    FROM rounds 
    WHERE tournament_id = tournament_uuid 
    AND status = 'active'
    ORDER BY round_number ASC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active round found for tournament';
    END IF;
    
    -- Check if all matchups in current round are completed
    IF EXISTS (
        SELECT 1 FROM matchups 
        WHERE round_id = current_round_record.id 
        AND winner_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot advance round: not all matchups are completed';
    END IF;
    
    -- Get the next round
    SELECT * INTO next_round_record
    FROM rounds 
    WHERE tournament_id = tournament_uuid 
    AND round_number = current_round_record.round_number + 1
    LIMIT 1;
    
    IF NOT FOUND THEN
        -- Tournament is complete
        UPDATE tournaments 
        SET status = 'completed'
        WHERE id = tournament_uuid;
        
        UPDATE rounds 
        SET status = 'completed'
        WHERE id = current_round_record.id;
        
        RETURN TRUE;
    END IF;
    
    -- Special handling for Final Four (Semifinals)
    IF next_round_record.name = 'Semifinals' THEN
        -- Implement Region A vs C and Region B vs D logic
        PERFORM setup_final_four_matchups(tournament_uuid, current_round_record.id, next_round_record.id);
    ELSE
        -- Standard advancement: assign winners to next round matchups
        FOR matchup_record IN winners_cursor LOOP
            UPDATE matchups 
            SET 
                contestant1_id = CASE WHEN next_position % 2 = 1 THEN matchup_record.winner_id ELSE contestant1_id END,
                contestant2_id = CASE WHEN next_position % 2 = 0 THEN matchup_record.winner_id ELSE contestant2_id END,
                status = 'active'
            WHERE round_id = next_round_record.id 
            AND position = CEIL(next_position::FLOAT / 2);
            
            next_position := next_position + 1;
        END LOOP;
    END IF;
    
    -- Update round statuses
    UPDATE rounds SET status = 'completed' WHERE id = current_round_record.id;
    UPDATE rounds SET status = 'active' WHERE id = next_round_record.id;
    
    RETURN TRUE;
END;
$$;

-- Create function to force advance round by declaring winners
CREATE OR REPLACE FUNCTION force_advance_round(tournament_uuid UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_round_record RECORD;
    matchup_record RECORD;
    winners_declared INTEGER := 0;
    ties_resolved INTEGER := 0;
    result JSON;
BEGIN
    -- Get the current active round
    SELECT * INTO current_round_record
    FROM rounds 
    WHERE tournament_id = tournament_uuid 
    AND status = 'active'
    ORDER BY round_number ASC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No active round found'
        );
    END IF;
    
    -- Process each incomplete matchup
    FOR matchup_record IN 
        SELECT * FROM matchups 
        WHERE round_id = current_round_record.id 
        AND winner_id IS NULL
    LOOP
        -- Count votes for each contestant
        DECLARE
            contestant1_vote_count INTEGER := 0;
            contestant2_vote_count INTEGER := 0;
        BEGIN
            -- Count votes for contestant1
            SELECT COUNT(*) INTO contestant1_vote_count
            FROM votes 
            WHERE matchup_id = matchup_record.id 
            AND selected_contestant_id = matchup_record.contestant1_id;
            
            -- Count votes for contestant2
            SELECT COUNT(*) INTO contestant2_vote_count
            FROM votes 
            WHERE matchup_id = matchup_record.id 
            AND selected_contestant_id = matchup_record.contestant2_id;
            
            -- Determine winner based on vote counts
            IF contestant1_vote_count > contestant2_vote_count THEN
                UPDATE matchups 
                SET winner_id = matchup_record.contestant1_id, status = 'completed'
                WHERE id = matchup_record.id;
                winners_declared := winners_declared + 1;
            ELSIF contestant2_vote_count > contestant1_vote_count THEN
                UPDATE matchups 
                SET winner_id = matchup_record.contestant2_id, status = 'completed'
                WHERE id = matchup_record.id;
                winners_declared := winners_declared + 1;
            ELSE
                -- Handle ties by selecting contestant1 (or implement other tie-breaking logic)
                UPDATE matchups 
                SET winner_id = matchup_record.contestant1_id, status = 'completed'
                WHERE id = matchup_record.id;
                ties_resolved := ties_resolved + 1;
            END IF;
        END;
    END LOOP;
    
    -- Now advance to next round
    PERFORM advance_to_next_round(tournament_uuid);
    
    RETURN json_build_object(
        'success', true,
        'winners_declared', winners_declared,
        'ties_resolved', ties_resolved,
        'message', format('Round advanced: %s winners declared, %s ties resolved', winners_declared, ties_resolved)
    );
END;
$$;

-- Create function to setup Final Four matchups (Region A vs C, Region B vs D)
CREATE OR REPLACE FUNCTION setup_final_four_matchups(
    tournament_uuid UUID,
    quarterfinal_round_id UUID,
    semifinal_round_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    region_a_winner UUID;
    region_b_winner UUID;
    region_c_winner UUID;
    region_d_winner UUID;
    contestants_per_region INTEGER;
BEGIN
    -- Calculate contestants per region
    SELECT COUNT(*) / 4 INTO contestants_per_region
    FROM contestants 
    WHERE tournament_id = tournament_uuid AND is_active = true;
    
    -- Get regional winners from quarterfinals
    -- Region A winner (positions 1 to contestants_per_region/2)
    SELECT winner_id INTO region_a_winner
    FROM matchups m
    JOIN contestants c ON (c.id = m.winner_id)
    WHERE m.round_id = quarterfinal_round_id
    AND c.quadrant = 1
    AND m.winner_id IS NOT NULL
    LIMIT 1;
    
    -- Region B winner
    SELECT winner_id INTO region_b_winner
    FROM matchups m
    JOIN contestants c ON (c.id = m.winner_id)
    WHERE m.round_id = quarterfinal_round_id
    AND c.quadrant = 2
    AND m.winner_id IS NOT NULL
    LIMIT 1;
    
    -- Region C winner
    SELECT winner_id INTO region_c_winner
    FROM matchups m
    JOIN contestants c ON (c.id = m.winner_id)
    WHERE m.round_id = quarterfinal_round_id
    AND c.quadrant = 3
    AND m.winner_id IS NOT NULL
    LIMIT 1;
    
    -- Region D winner
    SELECT winner_id INTO region_d_winner
    FROM matchups m
    JOIN contestants c ON (c.id = m.winner_id)
    WHERE m.round_id = quarterfinal_round_id
    AND c.quadrant = 4
    AND m.winner_id IS NOT NULL
    LIMIT 1;
    
    -- Set up Semifinal 1: Region A vs Region C
    UPDATE matchups 
    SET 
        contestant1_id = region_a_winner,
        contestant2_id = region_c_winner,
        status = 'active'
    WHERE round_id = semifinal_round_id
    AND position = 1;
    
    -- Set up Semifinal 2: Region B vs Region D
    UPDATE matchups 
    SET 
        contestant1_id = region_b_winner,
        contestant2_id = region_d_winner,
        status = 'active'
    WHERE round_id = semifinal_round_id
    AND position = 2;
    
    RAISE NOTICE 'Final Four configured: Region A vs Region C, Region B vs Region D';
END;
$$;

-- Create function to reset tournament bracket
CREATE OR REPLACE FUNCTION reset_tournament_bracket(tournament_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Clear all votes
    DELETE FROM votes WHERE matchup_id IN (
        SELECT id FROM matchups WHERE tournament_id = tournament_uuid
    );
    
    -- Clear all matchups and rounds
    DELETE FROM matchups WHERE tournament_id = tournament_uuid;
    DELETE FROM rounds WHERE tournament_id = tournament_uuid;
    
    -- Reset tournament status
    UPDATE tournaments 
    SET status = 'draft'
    WHERE id = tournament_uuid;
    
    RAISE NOTICE 'Tournament bracket reset successfully';
END;
$$;

-- Create function to finalize matchup
CREATE OR REPLACE FUNCTION finalize_matchup(matchup_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE matchups 
    SET status = 'completed'
    WHERE id = matchup_uuid;
    
    RAISE NOTICE 'Matchup finalized successfully';
END;
$$;