-- Enable Row Level Security (RLS) on all tables and create security policies
-- This ensures proper access control and data protection

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contestants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_results ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- Admins can update any user
CREATE POLICY "Admins can update users" ON public.users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- Public can view basic user info (username, avatar) for tournament displays
CREATE POLICY "Public can view basic user info" ON public.users
    FOR SELECT USING (TRUE)
    WITH CHECK (FALSE);

-- ============================================================================
-- TOURNAMENTS TABLE POLICIES
-- ============================================================================

-- Anyone can view public tournaments
CREATE POLICY "Anyone can view public tournaments" ON public.tournaments
    FOR SELECT USING (is_public = TRUE);

-- Users can view their own tournaments (including private ones)
CREATE POLICY "Users can view own tournaments" ON public.tournaments
    FOR SELECT USING (auth.uid() = created_by);

-- Authenticated users can create tournaments
CREATE POLICY "Authenticated users can create tournaments" ON public.tournaments
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Tournament creators can update their tournaments
CREATE POLICY "Creators can update own tournaments" ON public.tournaments
    FOR UPDATE USING (auth.uid() = created_by);

-- Tournament creators can delete their tournaments (if not active)
CREATE POLICY "Creators can delete own tournaments" ON public.tournaments
    FOR DELETE USING (
        auth.uid() = created_by AND status IN ('draft', 'registration')
    );

-- Admins can view/modify all tournaments
CREATE POLICY "Admins can manage all tournaments" ON public.tournaments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- ============================================================================
-- CONTESTANTS TABLE POLICIES
-- ============================================================================

-- Anyone can view contestants for public tournaments
CREATE POLICY "Anyone can view contestants in public tournaments" ON public.contestants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tournaments
            WHERE id = tournament_id AND is_public = TRUE
        )
    );

-- Tournament creators can manage contestants in their tournaments
CREATE POLICY "Creators can manage contestants" ON public.contestants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tournaments
            WHERE id = tournament_id AND created_by = auth.uid()
        )
    );

-- Admins can manage all contestants
CREATE POLICY "Admins can manage all contestants" ON public.contestants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- ============================================================================
-- ROUNDS TABLE POLICIES
-- ============================================================================

-- Anyone can view rounds for public tournaments
CREATE POLICY "Anyone can view rounds in public tournaments" ON public.rounds
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tournaments
            WHERE id = tournament_id AND is_public = TRUE
        )
    );

-- Tournament creators can manage rounds in their tournaments
CREATE POLICY "Creators can manage rounds" ON public.rounds
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tournaments
            WHERE id = tournament_id AND created_by = auth.uid()
        )
    );

-- Admins can manage all rounds
CREATE POLICY "Admins can manage all rounds" ON public.rounds
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- ============================================================================
-- MATCHUPS TABLE POLICIES
-- ============================================================================

-- Anyone can view matchups for public tournaments
CREATE POLICY "Anyone can view matchups in public tournaments" ON public.matchups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tournaments
            WHERE id = tournament_id AND is_public = TRUE
        )
    );

-- Tournament creators can manage matchups in their tournaments
CREATE POLICY "Creators can manage matchups" ON public.matchups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tournaments
            WHERE id = tournament_id AND created_by = auth.uid()
        )
    );

-- Admins can manage all matchups
CREATE POLICY "Admins can manage all matchups" ON public.matchups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- ============================================================================
-- VOTES TABLE POLICIES
-- ============================================================================

-- Users can only view their own votes
CREATE POLICY "Users can view own votes" ON public.votes
    FOR SELECT USING (auth.uid() = user_id);

-- Authenticated users can vote (insert their own votes)
CREATE POLICY "Users can cast votes" ON public.votes
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.matchups m
            JOIN public.tournaments t ON m.tournament_id = t.id
            WHERE m.id = matchup_id AND t.is_public = TRUE AND m.status = 'active'
        )
    );

-- Users can update their own votes (before matchup ends)
CREATE POLICY "Users can update own votes" ON public.votes
    FOR UPDATE USING (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.matchups
            WHERE id = matchup_id AND status = 'active'
        )
    );

-- Users can delete their own votes (before matchup ends)
CREATE POLICY "Users can delete own votes" ON public.votes
    FOR DELETE USING (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.matchups
            WHERE id = matchup_id AND status = 'active'
        )
    );

-- Tournament creators can view all votes for their tournaments
CREATE POLICY "Creators can view tournament votes" ON public.votes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.matchups m
            JOIN public.tournaments t ON m.tournament_id = t.id
            WHERE m.id = matchup_id AND t.created_by = auth.uid()
        )
    );

-- Admins can view all votes
CREATE POLICY "Admins can view all votes" ON public.votes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- Admins can cast admin votes with higher weight
CREATE POLICY "Admins can cast admin votes" ON public.votes
    FOR INSERT WITH CHECK (
        is_admin_vote = TRUE AND
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- ============================================================================
-- VOTE_RESULTS TABLE POLICIES
-- ============================================================================

-- Anyone can view vote results for public tournaments
CREATE POLICY "Anyone can view public tournament results" ON public.vote_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.matchups m
            JOIN public.tournaments t ON m.tournament_id = t.id
            WHERE m.id = matchup_id AND t.is_public = TRUE
        )
    );

-- Tournament creators can manage vote results for their tournaments
CREATE POLICY "Creators can manage tournament results" ON public.vote_results
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.matchups m
            JOIN public.tournaments t ON m.tournament_id = t.id
            WHERE m.id = matchup_id AND t.created_by = auth.uid()
        )
    );

-- Admins can manage all vote results
CREATE POLICY "Admins can manage all vote results" ON public.vote_results
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS FOR POLICIES
-- ============================================================================

-- Function to check if user is tournament creator
CREATE OR REPLACE FUNCTION public.is_tournament_creator(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.tournaments
        WHERE id = tournament_uuid AND created_by = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND is_admin = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if tournament is public
CREATE OR REPLACE FUNCTION public.is_tournament_public(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.tournaments
        WHERE id = tournament_uuid AND is_public = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON FUNCTION public.is_tournament_creator(UUID) IS 'Check if current user created the tournament';
COMMENT ON FUNCTION public.is_admin() IS 'Check if current user has admin privileges';
COMMENT ON FUNCTION public.is_tournament_public(UUID) IS 'Check if tournament is public';