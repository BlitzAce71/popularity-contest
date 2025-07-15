-- Contestant Suggestions System Database Migration
-- Creates tables, indexes, functions, and RLS policies for the suggestion system

-- =============================================================================
-- CREATE TABLES
-- =============================================================================

-- Contestant suggestions table
CREATE TABLE IF NOT EXISTS contestant_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  suggested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  vote_count INTEGER DEFAULT 0 NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL 
    CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT unique_suggestion_per_tournament UNIQUE (tournament_id, name),
  CONSTRAINT valid_vote_count CHECK (vote_count >= 0)
);

-- Suggestion votes table
CREATE TABLE IF NOT EXISTS suggestion_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES contestant_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Each user can only vote once per suggestion
  CONSTRAINT unique_vote_per_suggestion UNIQUE (suggestion_id, user_id)
);

-- =============================================================================
-- CREATE INDEXES
-- =============================================================================

-- Indexes for contestant_suggestions table
CREATE INDEX IF NOT EXISTS idx_suggestions_tournament_id ON contestant_suggestions(tournament_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_suggested_by ON contestant_suggestions(suggested_by);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON contestant_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_vote_count ON contestant_suggestions(vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON contestant_suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_name_search ON contestant_suggestions USING gin(to_tsvector('english', name));

-- Indexes for suggestion_votes table
CREATE INDEX IF NOT EXISTS idx_suggestion_votes_suggestion_id ON suggestion_votes(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_votes_user_id ON suggestion_votes(user_id);

-- =============================================================================
-- CREATE FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update vote count when votes are added/removed
CREATE OR REPLACE FUNCTION update_suggestion_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE contestant_suggestions 
    SET vote_count = vote_count + 1,
        updated_at = NOW()
    WHERE id = NEW.suggestion_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE contestant_suggestions 
    SET vote_count = vote_count - 1,
        updated_at = NOW()
    WHERE id = OLD.suggestion_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to maintain vote count
CREATE OR REPLACE TRIGGER trigger_update_suggestion_vote_count_insert
  AFTER INSERT ON suggestion_votes
  FOR EACH ROW EXECUTE FUNCTION update_suggestion_vote_count();

CREATE OR REPLACE TRIGGER trigger_update_suggestion_vote_count_delete
  AFTER DELETE ON suggestion_votes
  FOR EACH ROW EXECUTE FUNCTION update_suggestion_vote_count();

-- Trigger to auto-update timestamps
CREATE OR REPLACE TRIGGER trigger_contestant_suggestions_updated_at
  BEFORE UPDATE ON contestant_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY SETUP
-- =============================================================================

-- Enable RLS on both tables
ALTER TABLE contestant_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_votes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES FOR CONTESTANT_SUGGESTIONS
-- =============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view suggestions for public tournaments" ON contestant_suggestions;
DROP POLICY IF EXISTS "Users can view suggestions for accessible tournaments" ON contestant_suggestions;
DROP POLICY IF EXISTS "Users can create suggestions for draft tournaments" ON contestant_suggestions;
DROP POLICY IF EXISTS "Users can update their own suggestions" ON contestant_suggestions;
DROP POLICY IF EXISTS "Admins can update any suggestion" ON contestant_suggestions;
DROP POLICY IF EXISTS "Users can delete their own suggestions" ON contestant_suggestions;
DROP POLICY IF EXISTS "Admins can delete any suggestion" ON contestant_suggestions;

-- Policy: Anyone can view suggestions for public tournaments
CREATE POLICY "Public can view suggestions for public tournaments" ON contestant_suggestions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = contestant_suggestions.tournament_id 
      AND tournaments.visibility = 'public'
    )
  );

-- Policy: Authenticated users can view suggestions for tournaments they have access to
CREATE POLICY "Users can view suggestions for accessible tournaments" ON contestant_suggestions
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM tournaments 
        WHERE tournaments.id = contestant_suggestions.tournament_id 
        AND (tournaments.visibility = 'public' OR tournaments.created_by = auth.uid())
      )
    )
  );

-- Policy: Authenticated users can create suggestions for draft tournaments
CREATE POLICY "Users can create suggestions for draft tournaments" ON contestant_suggestions
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    suggested_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = tournament_id 
      AND tournaments.status = 'draft'
      AND (tournaments.visibility = 'public' OR tournaments.created_by = auth.uid())
    )
  );

-- Policy: Users can update their own suggestions (if tournament is still draft)
CREATE POLICY "Users can update their own suggestions" ON contestant_suggestions
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    suggested_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = tournament_id 
      AND tournaments.status = 'draft'
    )
  );

-- Policy: Admins and tournament creators can update any suggestion
CREATE POLICY "Admins can update any suggestion" ON contestant_suggestions
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true) OR
      EXISTS (
        SELECT 1 FROM tournaments 
        WHERE tournaments.id = tournament_id 
        AND tournaments.created_by = auth.uid()
      )
    )
  );

-- Policy: Users can delete their own suggestions (if tournament is draft)
CREATE POLICY "Users can delete their own suggestions" ON contestant_suggestions
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    suggested_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = tournament_id 
      AND tournaments.status = 'draft'
    )
  );

-- Policy: Admins and tournament creators can delete any suggestion
CREATE POLICY "Admins can delete any suggestion" ON contestant_suggestions
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true) OR
      EXISTS (
        SELECT 1 FROM tournaments 
        WHERE tournaments.id = tournament_id 
        AND tournaments.created_by = auth.uid()
      )
    )
  );

-- =============================================================================
-- RLS POLICIES FOR SUGGESTION_VOTES
-- =============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view suggestion votes" ON suggestion_votes;
DROP POLICY IF EXISTS "Users can vote on accessible suggestions" ON suggestion_votes;
DROP POLICY IF EXISTS "Users can remove their own votes" ON suggestion_votes;

-- Policy: Users can view all votes (for transparency)
CREATE POLICY "Users can view suggestion votes" ON suggestion_votes
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM contestant_suggestions cs
      JOIN tournaments t ON cs.tournament_id = t.id
      WHERE cs.id = suggestion_id
      AND (t.visibility = 'public' OR t.created_by = auth.uid())
    )
  );

-- Policy: Users can vote on suggestions for accessible tournaments
CREATE POLICY "Users can vote on accessible suggestions" ON suggestion_votes
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM contestant_suggestions cs
      JOIN tournaments t ON cs.tournament_id = t.id
      WHERE cs.id = suggestion_id
      AND t.status = 'draft'
      AND (t.visibility = 'public' OR t.created_by = auth.uid())
    )
  );

-- Policy: Users can remove their own votes
CREATE POLICY "Users can remove their own votes" ON suggestion_votes
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM contestant_suggestions cs
      JOIN tournaments t ON cs.tournament_id = t.id
      WHERE cs.id = suggestion_id
      AND t.status = 'draft'
    )
  );

-- =============================================================================
-- HELPFUL VIEWS
-- =============================================================================

-- View: Suggestions with user info and tournament details
CREATE OR REPLACE VIEW suggestion_details AS
SELECT 
  cs.*,
  u.username as suggested_by_username,
  u.email as suggested_by_email,
  t.name as tournament_name,
  t.status as tournament_status,
  t.created_by as tournament_creator_id,
  t.visibility as tournament_visibility
FROM contestant_suggestions cs
JOIN users u ON cs.suggested_by = u.id
JOIN tournaments t ON cs.tournament_id = t.id;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE contestant_suggestions IS 'User-submitted contestant suggestions for tournaments in draft status';
COMMENT ON TABLE suggestion_votes IS 'User votes on contestant suggestions (+1 system)';
COMMENT ON COLUMN contestant_suggestions.status IS 'Moderation status: pending, approved, rejected, duplicate';
COMMENT ON COLUMN contestant_suggestions.vote_count IS 'Automatically maintained count of votes for this suggestion';
COMMENT ON FUNCTION update_suggestion_vote_count() IS 'Maintains vote_count field when votes are added/removed';