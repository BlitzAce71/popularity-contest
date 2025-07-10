-- SAFE fix to preserve vote history display without breaking voting
-- This only affects how historical data is displayed, not active voting

-- Check if get_bracket_data function exists and what it returns
-- This is READ-ONLY and won't affect voting mechanics

-- First, let's create a helper function to get vote counts safely
CREATE OR REPLACE FUNCTION public.get_matchup_vote_display(matchup_id_param UUID)
RETURNS JSONB AS $$
DECLARE
    vote_result RECORD;
BEGIN
    -- Get vote counts from vote_results table
    SELECT 
        COALESCE(contestant1_votes, 0) as contestant1_votes,
        COALESCE(contestant2_votes, 0) as contestant2_votes,
        COALESCE(total_votes, 0) as total_votes
    INTO vote_result
    FROM public.vote_results 
    WHERE matchup_id = matchup_id_param;
    
    -- Return vote counts in the expected format
    RETURN jsonb_build_object(
        'contestant1Votes', COALESCE(vote_result.contestant1_votes, 0),
        'contestant2Votes', COALESCE(vote_result.contestant2_votes, 0),
        'totalVotes', COALESCE(vote_result.total_votes, 0),
        'contestant1_votes', COALESCE(vote_result.contestant1_votes, 0),
        'contestant2_votes', COALESCE(vote_result.contestant2_votes, 0),
        'total_votes', COALESCE(vote_result.total_votes, 0)
    );
    
EXCEPTION WHEN OTHERS THEN
    -- If anything fails, return zeros (safe fallback)
    RETURN jsonb_build_object(
        'contestant1Votes', 0,
        'contestant2Votes', 0,
        'totalVotes', 0,
        'contestant1_votes', 0,
        'contestant2_votes', 0,
        'total_votes', 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_matchup_vote_display(UUID) IS 'Helper function to safely get vote counts for display - does not affect voting mechanics';