-- Complete bracket generation fix with all required functions
-- This ensures all dependencies exist for bracket generation

-- First, create the missing generate_round_name function
DROP FUNCTION IF EXISTS public.generate_round_name(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.generate_round_name(tournament_size INTEGER, round_number INTEGER)
RETURNS TEXT AS $$
DECLARE
    total_rounds INTEGER;
    round_name TEXT;
BEGIN
    -- Calculate total rounds needed
    total_rounds := CEIL(LOG(2, tournament_size));
    
    -- Generate appropriate round name
    CASE 
        WHEN round_number = total_rounds THEN
            round_name := 'Final';
        WHEN round_number = total_rounds - 1 THEN
            round_name := 'Semifinals';
        WHEN round_number = total_rounds - 2 THEN
            round_name := 'Quarterfinals';
        ELSE
            round_name := 'Round ' || round_number::TEXT;
    END CASE;
    
    RETURN round_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now fix the bracket generation function
DROP FUNCTION IF EXISTS public.generate_single_elimination_bracket(UUID);

CREATE OR REPLACE FUNCTION public.generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS VOID AS $$
DECLARE
    tournament_size INTEGER;
    contestant_count INTEGER;
    round_count INTEGER;
    current_round INTEGER;
    current_matchups INTEGER;
    round_id UUID;
    matchup_position INTEGER;
    contestants_array UUID[];
BEGIN
    -- Get tournament info (use max_contestants, not size)
    SELECT max_contestants INTO tournament_size
    FROM public.tournaments
    WHERE id = tournament_uuid;
    
    -- Validate tournament exists and has max_contestants
    IF tournament_size IS NULL THEN
        RAISE EXCEPTION 'Tournament not found or missing max_contestants: %', tournament_uuid;
    END IF;
    
    -- Get actual contestant count
    SELECT COUNT(*) INTO contestant_count
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE;
    
    -- Validate we have enough contestants
    IF contestant_count < 2 THEN
        RAISE EXCEPTION 'Need at least 2 contestants to generate bracket, found: %', contestant_count;
    END IF;
    
    -- Calculate number of rounds needed (ensure we have at least 1 round)
    round_count := GREATEST(1, CEIL(LOG(2, tournament_size)));
    
    -- Get contestants ordered by seed (or position if no seed)
    SELECT ARRAY_AGG(id ORDER BY COALESCE(seed, position)) INTO contestants_array
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE;
    
    -- Validate we got contestants
    IF contestants_array IS NULL OR array_length(contestants_array, 1) IS NULL THEN
        RAISE EXCEPTION 'No contestants found for tournament: %', tournament_uuid;
    END IF;
    
    -- Generate rounds
    FOR current_round IN 1..round_count LOOP
        current_matchups := GREATEST(1, tournament_size / POWER(2, current_round)::INTEGER);
        
        -- Create round
        INSERT INTO public.rounds (
            tournament_id,
            round_number,
            name,
            total_matchups,
            status
        ) VALUES (
            tournament_uuid,
            current_round,
            public.generate_round_name(tournament_size, current_round),
            current_matchups,
            'upcoming'
        ) RETURNING id INTO round_id;
        
        -- Create matchups for this round
        FOR matchup_position IN 1..current_matchups LOOP
            IF current_round = 1 THEN
                -- First round: assign contestants based on bracket seeding
                INSERT INTO public.matchups (
                    round_id,
                    tournament_id,
                    position,
                    contestant1_id,
                    contestant2_id,
                    status
                ) VALUES (
                    round_id,
                    tournament_uuid,
                    matchup_position,
                    CASE 
                        WHEN (matchup_position * 2 - 1) <= contestant_count 
                        THEN contestants_array[matchup_position * 2 - 1]
                        ELSE NULL
                    END,
                    CASE 
                        WHEN (matchup_position * 2) <= contestant_count 
                        THEN contestants_array[matchup_position * 2]
                        ELSE NULL
                    END,
                    'upcoming'
                );
            ELSE
                -- Later rounds: create empty matchups to be filled by winners
                INSERT INTO public.matchups (
                    round_id,
                    tournament_id,
                    position,
                    status
                ) VALUES (
                    round_id,
                    tournament_uuid,
                    matchup_position,
                    'upcoming'
                );
            END IF;
        END LOOP;
    END LOOP;
    
    -- Update tournament status
    UPDATE public.tournaments
    SET status = 'active'
    WHERE id = tournament_uuid;
    
    -- Activate first round
    UPDATE public.rounds
    SET status = 'active'
    WHERE tournament_id = tournament_uuid AND round_number = 1;
    
    -- Activate first round matchups that have both contestants
    UPDATE public.matchups
    SET status = 'active'
    WHERE round_id = (
        SELECT id FROM public.rounds
        WHERE tournament_id = tournament_uuid AND round_number = 1
    )
    AND contestant1_id IS NOT NULL AND contestant2_id IS NOT NULL;
    
    -- Log success
    RAISE NOTICE 'Successfully generated bracket for tournament % with % contestants in % rounds', 
        tournament_uuid, contestant_count, round_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;