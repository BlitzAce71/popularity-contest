-- Fix bracket generation function to use max_contestants instead of size
-- This ensures that new tournaments can generate brackets properly

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
    contestant_record RECORD;
    contestants_array UUID[];
    i INTEGER;
BEGIN
    -- Get tournament info (use max_contestants, not size)
    SELECT max_contestants INTO tournament_size
    FROM public.tournaments
    WHERE id = tournament_uuid;
    
    -- Get actual contestant count
    SELECT COUNT(*) INTO contestant_count
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE;
    
    -- Validate we have enough contestants
    IF contestant_count < 2 THEN
        RAISE EXCEPTION 'Need at least 2 contestants to generate bracket';
    END IF;
    
    -- Calculate number of rounds needed
    round_count := CEIL(LOG(2, tournament_size));
    
    -- Get contestants ordered by seed (or position if no seed)
    SELECT ARRAY_AGG(id ORDER BY COALESCE(seed, position)) INTO contestants_array
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE;
    
    -- Generate rounds
    FOR current_round IN 1..round_count LOOP
        current_matchups := tournament_size / POWER(2, current_round);
        
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
            CASE WHEN current_round = 1 THEN 'upcoming' ELSE 'upcoming' END
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;