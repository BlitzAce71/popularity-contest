-- Add comprehensive error handling and logging to prevent silent bracket generation failures

-- Create a logging table for debugging bracket generation issues
CREATE TABLE IF NOT EXISTS public.bracket_generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    function_name TEXT NOT NULL,
    status TEXT NOT NULL, -- 'started', 'completed', 'failed'
    error_message TEXT,
    additional_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_bracket_generation_logs_tournament_id ON public.bracket_generation_logs(tournament_id);
CREATE INDEX IF NOT EXISTS idx_bracket_generation_logs_created_at ON public.bracket_generation_logs(created_at DESC);

-- Update bracket generation function to include comprehensive error handling
CREATE OR REPLACE FUNCTION public.generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    tournament_size INTEGER;
    contestant_count INTEGER;
    round_count INTEGER;
    current_round INTEGER;
    current_matchups INTEGER;
    round_id UUID;
    matchup_position INTEGER;
    
    -- Quadrant variables
    quadrant_size INTEGER;
    q1_contestants UUID[];
    q2_contestants UUID[];
    q3_contestants UUID[];
    q4_contestants UUID[];
    
    current_quadrant INTEGER;
    contestants_in_quadrant INTEGER;
    seeding_pairs INTEGER[][];
    pair_index INTEGER;
    seed1_pos INTEGER;
    seed2_pos INTEGER;
    contestant1_id UUID;
    contestant2_id UUID;
    
    log_data JSONB;
BEGIN
    -- Log start of bracket generation
    INSERT INTO public.bracket_generation_logs (tournament_id, function_name, status, additional_data)
    VALUES (tournament_uuid, 'generate_single_elimination_bracket', 'started', 
            jsonb_build_object('timestamp', NOW()));

    -- Get tournament size and validate
    SELECT max_contestants INTO tournament_size
    FROM public.tournaments
    WHERE id = tournament_uuid;
    
    IF tournament_size IS NULL THEN
        INSERT INTO public.bracket_generation_logs (tournament_id, function_name, status, error_message)
        VALUES (tournament_uuid, 'generate_single_elimination_bracket', 'failed', 'Tournament not found');
        RAISE EXCEPTION 'Tournament not found: %', tournament_uuid;
    END IF;
    
    -- Count active contestants
    SELECT COUNT(*) INTO contestant_count
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE;
    
    IF contestant_count = 0 THEN
        INSERT INTO public.bracket_generation_logs (tournament_id, function_name, status, error_message)
        VALUES (tournament_uuid, 'generate_single_elimination_bracket', 'failed', 'No active contestants found');
        RAISE EXCEPTION 'No active contestants found for tournament';
    END IF;
    
    -- Validate tournament size is power of 2
    IF (tournament_size & (tournament_size - 1)) != 0 THEN
        INSERT INTO public.bracket_generation_logs (tournament_id, function_name, status, error_message)
        VALUES (tournament_uuid, 'generate_single_elimination_bracket', 'failed', 
                'Tournament size must be power of 2, got: ' || tournament_size);
        RAISE EXCEPTION 'Tournament size must be power of 2, got: %', tournament_size;
    END IF;
    
    -- Calculate quadrant size (assuming 4 quadrants)
    quadrant_size := tournament_size / 4;
    
    -- Get contestants by quadrant, ordered by seed
    SELECT ARRAY_AGG(id ORDER BY COALESCE(seed, 999), created_at)
    INTO q1_contestants
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE AND quadrant = 1;
    
    SELECT ARRAY_AGG(id ORDER BY COALESCE(seed, 999), created_at)
    INTO q2_contestants
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE AND quadrant = 2;
    
    SELECT ARRAY_AGG(id ORDER BY COALESCE(seed, 999), created_at)
    INTO q3_contestants
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE AND quadrant = 3;
    
    SELECT ARRAY_AGG(id ORDER BY COALESCE(seed, 999), created_at)
    INTO q4_contestants
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE AND quadrant = 4;
    
    -- Log quadrant distribution
    log_data := jsonb_build_object(
        'tournament_size', tournament_size,
        'contestant_count', contestant_count,
        'quadrant_sizes', jsonb_build_object(
            'q1', COALESCE(array_length(q1_contestants, 1), 0),
            'q2', COALESCE(array_length(q2_contestants, 1), 0),
            'q3', COALESCE(array_length(q3_contestants, 1), 0),
            'q4', COALESCE(array_length(q4_contestants, 1), 0)
        )
    );
    
    INSERT INTO public.bracket_generation_logs (tournament_id, function_name, status, additional_data)
    VALUES (tournament_uuid, 'generate_single_elimination_bracket', 'processing', log_data);
    
    -- Calculate number of rounds (log2 of tournament size)
    round_count := CEIL(LOG(2, tournament_size));
    
    -- Get proper seeding pairs for each quadrant
    seeding_pairs := public.get_seeding_pairs(quadrant_size);
    
    -- Clear any existing rounds/matchups for this tournament
    DELETE FROM public.matchups WHERE tournament_id = tournament_uuid;
    DELETE FROM public.rounds WHERE tournament_id = tournament_uuid;
    
    -- Generate rounds
    FOR current_round IN 1..round_count LOOP
        current_matchups := tournament_size / POWER(2, current_round);
        
        -- Create round
        INSERT INTO public.rounds (
            tournament_id,
            round_number,
            name,
            status
        ) VALUES (
            tournament_uuid,
            current_round,
            public.generate_round_name(tournament_size, current_round),
            CASE WHEN current_round = 1 THEN 'active' ELSE 'upcoming' END
        ) RETURNING id INTO round_id;
        
        matchup_position := 1;
        
        IF current_round = 1 THEN
            -- First round: create proper seeded matchups within each quadrant
            FOR current_quadrant IN 1..4 LOOP
                contestants_in_quadrant := CASE current_quadrant
                    WHEN 1 THEN COALESCE(array_length(q1_contestants, 1), 0)
                    WHEN 2 THEN COALESCE(array_length(q2_contestants, 1), 0)
                    WHEN 3 THEN COALESCE(array_length(q3_contestants, 1), 0)
                    WHEN 4 THEN COALESCE(array_length(q4_contestants, 1), 0)
                END;
                
                -- Create matchups for this quadrant using proper seeding
                FOR pair_index IN 1..(contestants_in_quadrant/2) LOOP
                    -- Get seed positions from seeding pairs
                    seed1_pos := seeding_pairs[pair_index][1];
                    seed2_pos := seeding_pairs[pair_index][2];
                    
                    -- Get actual contestant IDs
                    contestant1_id := CASE current_quadrant
                        WHEN 1 THEN q1_contestants[seed1_pos]
                        WHEN 2 THEN q2_contestants[seed1_pos]
                        WHEN 3 THEN q3_contestants[seed1_pos]
                        WHEN 4 THEN q4_contestants[seed1_pos]
                    END;
                    
                    contestant2_id := CASE current_quadrant
                        WHEN 1 THEN q1_contestants[LEAST(seed2_pos, contestants_in_quadrant)]
                        WHEN 2 THEN q2_contestants[LEAST(seed2_pos, contestants_in_quadrant)]
                        WHEN 3 THEN q3_contestants[LEAST(seed2_pos, contestants_in_quadrant)]
                        WHEN 4 THEN q4_contestants[LEAST(seed2_pos, contestants_in_quadrant)]
                    END;
                    
                    INSERT INTO public.matchups (
                        round_id,
                        tournament_id,
                        match_number,
                        position,
                        contestant1_id,
                        contestant2_id,
                        status
                    ) VALUES (
                        round_id,
                        tournament_uuid,
                        matchup_position,
                        matchup_position,
                        contestant1_id,
                        contestant2_id,
                        'active'
                    );
                    
                    matchup_position := matchup_position + 1;
                END LOOP;
            END LOOP;
        ELSE
            -- Later rounds: create empty matchups to be filled by winners
            FOR matchup_position IN 1..current_matchups LOOP
                INSERT INTO public.matchups (
                    round_id,
                    tournament_id,
                    match_number,
                    position,
                    status
                ) VALUES (
                    round_id,
                    tournament_uuid,
                    matchup_position,
                    matchup_position,
                    'upcoming'
                );
            END LOOP;
        END IF;
    END LOOP;
    
    -- Update tournament status to active
    UPDATE public.tournaments
    SET status = 'active'
    WHERE id = tournament_uuid;
    
    -- Log successful completion
    INSERT INTO public.bracket_generation_logs (tournament_id, function_name, status, additional_data)
    VALUES (tournament_uuid, 'generate_single_elimination_bracket', 'completed', 
            jsonb_build_object(
                'rounds_created', round_count,
                'total_matchups_created', (SELECT COUNT(*) FROM public.matchups WHERE tournament_id = tournament_uuid)
            ));
    
    RETURN TRUE;
    
EXCEPTION WHEN OTHERS THEN
    -- Log the error
    INSERT INTO public.bracket_generation_logs (tournament_id, function_name, status, error_message, additional_data)
    VALUES (tournament_uuid, 'generate_single_elimination_bracket', 'failed', SQLERRM, 
            jsonb_build_object('sqlstate', SQLSTATE, 'error_detail', SQLERRM));
    
    -- Re-raise the exception
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get bracket generation logs for debugging
CREATE OR REPLACE FUNCTION public.get_bracket_generation_logs(tournament_uuid UUID)
RETURNS TABLE (
    id UUID,
    function_name TEXT,
    status TEXT,
    error_message TEXT,
    additional_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.function_name,
        l.status,
        l.error_message,
        l.additional_data,
        l.created_at
    FROM public.bracket_generation_logs l
    WHERE l.tournament_id = tournament_uuid
    ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE public.bracket_generation_logs IS 'Logs for debugging bracket generation issues';
COMMENT ON FUNCTION public.get_bracket_generation_logs(UUID) IS 'Get bracket generation logs for debugging';