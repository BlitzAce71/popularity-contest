-- Fix bracket generation function to work with RLS policies
-- Add SECURITY DEFINER to allow system operations during tournament reset

CREATE OR REPLACE FUNCTION public.generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- This allows the function to bypass RLS policies
AS $$
DECLARE
    contestant_record RECORD;
    round_record RECORD;
    current_round_id UUID;
    current_position INTEGER;
    contestants_count INTEGER;
    total_rounds INTEGER;
    round_name TEXT;
BEGIN
    -- First, ensure contestants have proper unique seeding
    WITH numbered_contestants AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (ORDER BY seed, name) as new_seed
        FROM public.contestants 
        WHERE tournament_id = tournament_uuid
    )
    UPDATE public.contestants 
    SET seed = nc.new_seed
    FROM numbered_contestants nc
    WHERE contestants.id = nc.id;

    -- Get the number of contestants
    SELECT COUNT(*) INTO contestants_count
    FROM public.contestants
    WHERE tournament_id = tournament_uuid;

    -- Calculate number of rounds needed (log2 of contestants, rounded up)
    total_rounds := CEIL(LOG(2, contestants_count));

    -- Create rounds
    FOR i IN 1..total_rounds LOOP
        current_round_id := gen_random_uuid();
        
        -- Determine round name
        CASE total_rounds - i + 1
            WHEN 1 THEN round_name := 'Final';
            WHEN 2 THEN round_name := 'Semifinals';
            WHEN 3 THEN round_name := 'Quarterfinals';
            WHEN 4 THEN round_name := 'Round of 16';
            WHEN 5 THEN round_name := 'Round of 32';
            ELSE round_name := 'Round ' || i::TEXT;
        END CASE;

        INSERT INTO public.rounds (id, tournament_id, round_number, name, status)
        VALUES (
            current_round_id,
            tournament_uuid,
            i,
            round_name,
            CASE WHEN i = 1 THEN 'active' ELSE 'upcoming' END
        );

        -- Create matchups for this round
        current_position := 1;
        
        IF i = 1 THEN
            -- First round: pair contestants by seed
            FOR contestant_record IN
                SELECT id, seed
                FROM public.contestants
                WHERE tournament_id = tournament_uuid
                ORDER BY seed
            LOOP
                -- Create matchup every two contestants
                IF (contestant_record.seed % 2) = 1 THEN
                    -- First contestant in matchup
                    INSERT INTO public.matchups (
                        id, tournament_id, round_id, position, contestant1_id, status
                    ) VALUES (
                        gen_random_uuid(), tournament_uuid, current_round_id, 
                        current_position, contestant_record.id, 'active'
                    );
                ELSE
                    -- Second contestant in matchup
                    UPDATE public.matchups
                    SET contestant2_id = contestant_record.id
                    WHERE round_id = current_round_id AND position = current_position;
                    
                    current_position := current_position + 1;
                END IF;
            END LOOP;
        ELSE
            -- Subsequent rounds: create empty matchups to be filled by winners
            FOR j IN 1..(contestants_count / (2^i)) LOOP
                INSERT INTO public.matchups (
                    id, tournament_id, round_id, position, status
                ) VALUES (
                    gen_random_uuid(), tournament_uuid, current_round_id, j, 'upcoming'
                );
            END LOOP;
        END IF;
    END LOOP;

    -- Update tournament status to active
    UPDATE public.tournaments
    SET status = 'active'
    WHERE id = tournament_uuid;

END;
$$;

COMMENT ON FUNCTION public.generate_single_elimination_bracket(UUID) IS 'Generate single elimination bracket with proper seeding and RLS support';