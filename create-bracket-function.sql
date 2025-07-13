CREATE OR REPLACE FUNCTION generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS VOID
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
    contestant_pairs UUID[][];
    i INTEGER;
    first_round_id UUID;
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
    
    -- Calculate rounds needed (log base 2)
    rounds_needed := CEIL(LOG(2, contestants_count));
    
    -- Clear existing bracket
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
            VALUES (round_id, tournament_uuid, i, i, 
                CASE WHEN current_round = 1 THEN 'active' ELSE 'upcoming' END);
        END LOOP;
        
        -- Next round has half the contestants
        contestants_in_round := match_count;
    END LOOP;
    
    -- Assign contestants to first round matchups
    -- Create pairs of contestants (adjacent in ordered list)
    WITH ordered_contestants AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY quadrant, seed) as row_num
        FROM contestants 
        WHERE tournament_id = tournament_uuid AND is_active = true
    )
    -- Update matchups with contestant pairs
    UPDATE matchups 
    SET 
        contestant1_id = oc1.id,
        contestant2_id = oc2.id
    FROM ordered_contestants oc1
    JOIN ordered_contestants oc2 ON oc2.row_num = oc1.row_num + 1
    WHERE matchups.round_id = first_round_id
    AND matchups.position = ((oc1.row_num + 1) / 2)
    AND oc1.row_num % 2 = 1;

    RAISE NOTICE 'Bracket generated successfully with % contestants in % rounds', contestants_count, rounds_needed;
    
END;
$$ LANGUAGE plpgsql;