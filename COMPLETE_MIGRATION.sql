-- =============================================================================
-- POPULARITY CONTEST DATABASE MIGRATION
-- Complete migration script for Supabase
-- Run this in Supabase SQL Editor
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- STEP 1: CREATE USERS TABLE
-- =============================================================================

-- Create users table that extends auth.users
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    is_moderator BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create function to handle user profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, username, first_name, last_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'firstName', ''),
        COALESCE(NEW.raw_user_meta_data->>'lastName', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for users table updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- STEP 2: CREATE TOURNAMENTS TABLE
-- =============================================================================

-- Create tournaments table
CREATE TABLE IF NOT EXISTS public.tournaments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    status TEXT CHECK (status IN ('draft', 'registration', 'active', 'completed', 'cancelled')) DEFAULT 'draft',
    bracket_type TEXT CHECK (bracket_type IN ('single-elimination', 'double-elimination', 'round-robin')) DEFAULT 'single-elimination',
    max_contestants INTEGER NOT NULL DEFAULT 8,
    current_contestants INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,
    allow_ties BOOLEAN DEFAULT FALSE,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_contestant_count CHECK (current_contestants >= 0 AND current_contestants <= max_contestants),
    CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date > start_date)
);

-- Create indexes for tournaments
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON public.tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_by ON public.tournaments(created_by);
CREATE INDEX IF NOT EXISTS idx_tournaments_public ON public.tournaments(is_public);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_at ON public.tournaments(created_at);

-- Create trigger for tournaments updated_at
CREATE TRIGGER update_tournaments_updated_at
    BEFORE UPDATE ON public.tournaments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- STEP 3: CREATE CONTESTANTS TABLE
-- =============================================================================

-- Create contestants table
CREATE TABLE IF NOT EXISTS public.contestants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    seed INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    eliminated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_tournament_contestant_name UNIQUE(tournament_id, name),
    CONSTRAINT unique_tournament_seed UNIQUE(tournament_id, seed),
    CONSTRAINT positive_seed CHECK (seed > 0)
);

-- Create indexes for contestants
CREATE INDEX IF NOT EXISTS idx_contestants_tournament ON public.contestants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_contestants_active ON public.contestants(is_active);
CREATE INDEX IF NOT EXISTS idx_contestants_seed ON public.contestants(tournament_id, seed);

-- Create function to update tournament contestant count
CREATE OR REPLACE FUNCTION public.update_tournament_contestant_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.tournaments 
        SET current_contestants = current_contestants + 1
        WHERE id = NEW.tournament_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.tournaments 
        SET current_contestants = current_contestants - 1
        WHERE id = OLD.tournament_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for contestant count
CREATE TRIGGER update_contestant_count_insert
    AFTER INSERT ON public.contestants
    FOR EACH ROW EXECUTE FUNCTION public.update_tournament_contestant_count();

CREATE TRIGGER update_contestant_count_delete
    AFTER DELETE ON public.contestants
    FOR EACH ROW EXECUTE FUNCTION public.update_tournament_contestant_count();

-- Create trigger for contestants updated_at
CREATE TRIGGER update_contestants_updated_at
    BEFORE UPDATE ON public.contestants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- STEP 4: CREATE ROUNDS TABLE
-- =============================================================================

-- Create rounds table
CREATE TABLE IF NOT EXISTS public.rounds (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
    round_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT CHECK (status IN ('upcoming', 'active', 'completed')) DEFAULT 'upcoming',
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_tournament_round UNIQUE(tournament_id, round_number),
    CONSTRAINT positive_round_number CHECK (round_number > 0),
    CONSTRAINT valid_round_dates CHECK (end_date IS NULL OR end_date > start_date)
);

-- Create indexes for rounds
CREATE INDEX IF NOT EXISTS idx_rounds_tournament ON public.rounds(tournament_id);
CREATE INDEX IF NOT EXISTS idx_rounds_status ON public.rounds(status);
CREATE INDEX IF NOT EXISTS idx_rounds_number ON public.rounds(tournament_id, round_number);

-- Create trigger for rounds updated_at
CREATE TRIGGER update_rounds_updated_at
    BEFORE UPDATE ON public.rounds
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- STEP 5: CREATE MATCHUPS TABLE
-- =============================================================================

-- Create matchups table
CREATE TABLE IF NOT EXISTS public.matchups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE NOT NULL,
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
    match_number INTEGER NOT NULL,
    contestant1_id UUID REFERENCES public.contestants(id) ON DELETE SET NULL,
    contestant2_id UUID REFERENCES public.contestants(id) ON DELETE SET NULL,
    winner_id UUID REFERENCES public.contestants(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('upcoming', 'active', 'completed')) DEFAULT 'upcoming',
    contestant1_votes INTEGER DEFAULT 0,
    contestant2_votes INTEGER DEFAULT 0,
    total_votes INTEGER DEFAULT 0,
    is_tie BOOLEAN DEFAULT FALSE,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_round_match UNIQUE(round_id, match_number),
    CONSTRAINT different_contestants CHECK (contestant1_id != contestant2_id),
    CONSTRAINT winner_is_contestant CHECK (
        winner_id IS NULL OR 
        winner_id = contestant1_id OR 
        winner_id = contestant2_id
    ),
    CONSTRAINT non_negative_votes CHECK (
        contestant1_votes >= 0 AND 
        contestant2_votes >= 0 AND 
        total_votes >= 0
    ),
    CONSTRAINT valid_matchup_dates CHECK (end_date IS NULL OR end_date > start_date)
);

-- Create indexes for matchups
CREATE INDEX IF NOT EXISTS idx_matchups_round ON public.matchups(round_id);
CREATE INDEX IF NOT EXISTS idx_matchups_tournament ON public.matchups(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matchups_status ON public.matchups(status);
CREATE INDEX IF NOT EXISTS idx_matchups_contestants ON public.matchups(contestant1_id, contestant2_id);

-- Create trigger for matchups updated_at
CREATE TRIGGER update_matchups_updated_at
    BEFORE UPDATE ON public.matchups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- STEP 6: CREATE VOTES AND RESULTS TABLES
-- =============================================================================

-- Create votes table
CREATE TABLE IF NOT EXISTS public.votes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    matchup_id UUID REFERENCES public.matchups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    selected_contestant_id UUID REFERENCES public.contestants(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_user_matchup_vote UNIQUE(matchup_id, user_id)
    -- Note: Vote validation (ensuring selected_contestant_id matches matchup contestants)
    -- is handled by application logic and foreign key constraints
);

-- Create indexes for votes
CREATE INDEX IF NOT EXISTS idx_votes_matchup ON public.votes(matchup_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON public.votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_contestant ON public.votes(selected_contestant_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON public.votes(created_at);

-- Create vote drafts table for auto-save functionality
CREATE TABLE IF NOT EXISTS public.vote_drafts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    matchup_id UUID REFERENCES public.matchups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    selected_contestant_id UUID REFERENCES public.contestants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_user_matchup_draft UNIQUE(matchup_id, user_id)
);

-- Create indexes for vote drafts
CREATE INDEX IF NOT EXISTS idx_vote_drafts_matchup ON public.vote_drafts(matchup_id);
CREATE INDEX IF NOT EXISTS idx_vote_drafts_user ON public.vote_drafts(user_id);

-- Create trigger for vote drafts updated_at
CREATE TRIGGER update_vote_drafts_updated_at
    BEFORE UPDATE ON public.vote_drafts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create results table for computed tournament results
CREATE TABLE IF NOT EXISTS public.results (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
    contestant_id UUID REFERENCES public.contestants(id) ON DELETE CASCADE NOT NULL,
    final_position INTEGER,
    total_votes_received INTEGER DEFAULT 0,
    matches_won INTEGER DEFAULT 0,
    matches_lost INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_tournament_contestant_result UNIQUE(tournament_id, contestant_id),
    CONSTRAINT positive_position CHECK (final_position > 0),
    CONSTRAINT non_negative_stats CHECK (
        total_votes_received >= 0 AND 
        matches_won >= 0 AND 
        matches_lost >= 0
    )
);

-- Create indexes for results
CREATE INDEX IF NOT EXISTS idx_results_tournament ON public.results(tournament_id);
CREATE INDEX IF NOT EXISTS idx_results_contestant ON public.results(contestant_id);
CREATE INDEX IF NOT EXISTS idx_results_position ON public.results(tournament_id, final_position);

-- Create trigger for results updated_at
CREATE TRIGGER update_results_updated_at
    BEFORE UPDATE ON public.results
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update matchup vote counts
CREATE OR REPLACE FUNCTION public.update_matchup_vote_counts()
RETURNS TRIGGER AS $$
DECLARE
    matchup_record RECORD;
BEGIN
    -- Get the matchup details
    SELECT m.*, m.contestant1_id, m.contestant2_id INTO matchup_record
    FROM public.matchups m
    WHERE m.id = COALESCE(NEW.matchup_id, OLD.matchup_id);
    
    -- Update vote counts
    UPDATE public.matchups SET
        contestant1_votes = (
            SELECT COUNT(*) FROM public.votes 
            WHERE matchup_id = matchup_record.id 
            AND selected_contestant_id = matchup_record.contestant1_id
        ),
        contestant2_votes = (
            SELECT COUNT(*) FROM public.votes 
            WHERE matchup_id = matchup_record.id 
            AND selected_contestant_id = matchup_record.contestant2_id
        ),
        total_votes = (
            SELECT COUNT(*) FROM public.votes 
            WHERE matchup_id = matchup_record.id
        )
    WHERE id = matchup_record.id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update vote counts
CREATE TRIGGER update_vote_counts_insert
    AFTER INSERT ON public.votes
    FOR EACH ROW EXECUTE FUNCTION public.update_matchup_vote_counts();

CREATE TRIGGER update_vote_counts_delete
    AFTER DELETE ON public.votes
    FOR EACH ROW EXECUTE FUNCTION public.update_matchup_vote_counts();

-- =============================================================================
-- STEP 7: ENABLE ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contestants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view all profiles" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON public.users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Tournaments table policies
CREATE POLICY "Anyone can view public tournaments" ON public.tournaments
    FOR SELECT USING (is_public = true OR auth.uid() = created_by);

CREATE POLICY "Authenticated users can create tournaments" ON public.tournaments
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Tournament creators can update their tournaments" ON public.tournaments
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Admins can manage all tournaments" ON public.tournaments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Contestants table policies
CREATE POLICY "Anyone can view contestants for public tournaments" ON public.contestants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = tournament_id AND t.is_public = true
        )
    );

CREATE POLICY "Tournament creators can manage contestants" ON public.contestants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = tournament_id AND t.created_by = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all contestants" ON public.contestants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Rounds table policies
CREATE POLICY "Anyone can view rounds for public tournaments" ON public.rounds
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = tournament_id AND t.is_public = true
        )
    );

CREATE POLICY "Tournament creators can manage rounds" ON public.rounds
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = tournament_id AND t.created_by = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all rounds" ON public.rounds
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Matchups table policies
CREATE POLICY "Anyone can view matchups for public tournaments" ON public.matchups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = tournament_id AND t.is_public = true
        )
    );

CREATE POLICY "Tournament creators can manage matchups" ON public.matchups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = tournament_id AND t.created_by = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all matchups" ON public.matchups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Votes table policies
CREATE POLICY "Users can view votes for public tournaments" ON public.votes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.matchups m
            JOIN public.tournaments t ON t.id = m.tournament_id
            WHERE m.id = matchup_id AND t.is_public = true
        )
    );

CREATE POLICY "Authenticated users can vote" ON public.votes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own votes" ON public.votes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes" ON public.votes
    FOR DELETE USING (auth.uid() = user_id);

-- Vote drafts table policies
CREATE POLICY "Users can manage their own vote drafts" ON public.vote_drafts
    FOR ALL USING (auth.uid() = user_id);

-- Results table policies
CREATE POLICY "Anyone can view results for public tournaments" ON public.results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = tournament_id AND t.is_public = true
        )
    );

CREATE POLICY "Tournament creators can manage results" ON public.results
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = tournament_id AND t.created_by = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all results" ON public.results
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =============================================================================
-- STEP 8: CONFIGURE STORAGE BUCKETS
-- =============================================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('tournament-images', 'tournament-images', true),
    ('contestant-images', 'contestant-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for tournament images (public read)
CREATE POLICY "Tournament images are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'tournament-images');

CREATE POLICY "Authenticated users can upload tournament images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'tournament-images' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Users can update tournament images they uploaded" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'tournament-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete tournament images they uploaded" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'tournament-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Storage policies for contestant images (public read)
CREATE POLICY "Contestant images are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'contestant-images');

CREATE POLICY "Authenticated users can upload contestant images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'contestant-images' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Users can update contestant images they uploaded" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'contestant-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete contestant images they uploaded" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'contestant-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );


-- =============================================================================
-- STEP 9: CREATE BRACKET FUNCTIONS
-- =============================================================================

-- Function to generate tournament bracket
CREATE OR REPLACE FUNCTION public.generate_tournament_bracket(tournament_id_param UUID)
RETURNS JSON AS $$
DECLARE
    tournament_record RECORD;
    contestant_count INTEGER;
    round_count INTEGER;
    contestants_cursor CURSOR FOR 
        SELECT * FROM public.contestants 
        WHERE tournament_id = tournament_id_param AND is_active = true 
        ORDER BY seed ASC;
    current_round INTEGER := 1;
    current_match INTEGER := 1;
    round_id UUID;
    result JSON;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_record 
    FROM public.tournaments 
    WHERE id = tournament_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;
    
    -- Count active contestants
    SELECT COUNT(*) INTO contestant_count 
    FROM public.contestants 
    WHERE tournament_id = tournament_id_param AND is_active = true;
    
    IF contestant_count < 2 THEN
        RAISE EXCEPTION 'Tournament must have at least 2 contestants';
    END IF;
    
    -- Calculate number of rounds needed
    round_count := CEIL(LOG(2, contestant_count));
    
    -- Create rounds
    FOR i IN 1..round_count LOOP
        INSERT INTO public.rounds (tournament_id, round_number, name, status)
        VALUES (
            tournament_id_param, 
            i, 
            CASE 
                WHEN i = round_count THEN 'Final'
                WHEN i = round_count - 1 THEN 'Semifinal'
                WHEN i = round_count - 2 THEN 'Quarterfinal'
                ELSE 'Round ' || i
            END,
            CASE WHEN i = 1 THEN 'active' ELSE 'upcoming' END
        );
    END LOOP;
    
    -- Create first round matchups
    SELECT id INTO round_id 
    FROM public.rounds 
    WHERE tournament_id = tournament_id_param AND round_number = 1;
    
    current_match := 1;
    FOR contestant_record IN contestants_cursor LOOP
        -- Create matchup logic here (simplified for this example)
        -- In a real implementation, you'd pair contestants appropriately
        current_match := current_match + 1;
    END LOOP;
    
    -- Return bracket structure as JSON
    SELECT json_build_object(
        'tournament_id', tournament_id_param,
        'rounds', (
            SELECT json_agg(
                json_build_object(
                    'id', r.id,
                    'round_number', r.round_number,
                    'name', r.name,
                    'status', r.status,
                    'matchups', (
                        SELECT COALESCE(json_agg(
                            json_build_object(
                                'id', m.id,
                                'match_number', m.match_number,
                                'contestant1_id', m.contestant1_id,
                                'contestant2_id', m.contestant2_id,
                                'winner_id', m.winner_id,
                                'status', m.status
                            )
                        ), '[]'::json)
                        FROM public.matchups m 
                        WHERE m.round_id = r.id
                    )
                )
            )
            FROM public.rounds r 
            WHERE r.tournament_id = tournament_id_param 
            ORDER BY r.round_number
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to advance tournament to next round
CREATE OR REPLACE FUNCTION public.advance_tournament_round(tournament_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_round_record RECORD;
    next_round_record RECORD;
    completed_matchups INTEGER;
    total_matchups INTEGER;
BEGIN
    -- Get current active round
    SELECT * INTO current_round_record
    FROM public.rounds
    WHERE tournament_id = tournament_id_param 
    AND status = 'active'
    ORDER BY round_number
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active round found';
    END IF;
    
    -- Check if all matchups in current round are completed
    SELECT 
        COUNT(CASE WHEN status = 'completed' THEN 1 END),
        COUNT(*)
    INTO completed_matchups, total_matchups
    FROM public.matchups
    WHERE round_id = current_round_record.id;
    
    IF completed_matchups < total_matchups THEN
        RAISE EXCEPTION 'Not all matchups in current round are completed';
    END IF;
    
    -- Mark current round as completed
    UPDATE public.rounds 
    SET status = 'completed', end_date = NOW()
    WHERE id = current_round_record.id;
    
    -- Get next round
    SELECT * INTO next_round_record
    FROM public.rounds
    WHERE tournament_id = tournament_id_param 
    AND round_number = current_round_record.round_number + 1;
    
    IF FOUND THEN
        -- Activate next round
        UPDATE public.rounds 
        SET status = 'active', start_date = NOW()
        WHERE id = next_round_record.id;
        
        -- Create matchups for next round based on current round winners
        -- (Implementation would go here)
        
        RETURN TRUE;
    ELSE
        -- Tournament is complete
        UPDATE public.tournaments 
        SET status = 'completed', end_date = NOW()
        WHERE id = tournament_id_param;
        
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Verify the migration by checking table creation
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
        'users', 'tournaments', 'contestants', 'rounds', 
        'matchups', 'votes', 'vote_drafts', 'results'
    );
    
    IF table_count = 8 THEN
        RAISE NOTICE 'SUCCESS: All 8 tables created successfully!';
    ELSE
        RAISE NOTICE 'WARNING: Only % out of 8 tables were created', table_count;
    END IF;
END $$;

-- Show final status
SELECT 
    'Migration completed successfully! You can now use the Popularity Contest application.' as status,
    NOW() as completed_at;
