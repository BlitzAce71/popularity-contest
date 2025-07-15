export interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  is_moderator?: boolean;
  tournaments_count?: number;
  total_votes?: number;
  last_activity?: string;
  created_at: string;
  updated_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  slug: string; // URL-friendly slug for SEO-friendly URLs
  image_url?: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  start_date: string;
  end_date?: string;
  max_contestants: number;
  current_contestants: number;
  bracket_type: 'single-elimination';
  is_public: boolean;
  quadrant_names?: [string, string, string, string]; // [Q1, Q2, Q3, Q4] custom names
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Contestant {
  id: string;
  tournament_id: string;
  name: string;
  description?: string;
  image_url?: string;
  seed: number;
  quadrant?: 1 | 2 | 3 | 4;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Round {
  id: string;
  tournament_id: string;
  round_number: number;
  name: string;
  description?: string;
  status: 'upcoming' | 'active' | 'completed' | 'paused';
  total_matchups: number;
  completed_matchups: number;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  round_id: string;
  tournament_id: string;
  position: number;
  contestant1_id?: string;
  contestant2_id?: string;
  winner_id?: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Vote {
  id: string;
  matchup_id: string;
  user_id: string;
  selected_contestant_id: string;
  is_admin_vote: boolean;
  created_at: string;
}

export interface BracketPosition {
  id: string;
  tournament_id: string;
  round_id: string;
  match_id?: string;
  contestant_id?: string;
  position: number;
  x: number;
  y: number;
  created_at: string;
  updated_at: string;
}

export interface TournamentStats {
  total_votes: number;
  total_matches: number;
  completed_matches: number;
  active_matches: number;
  total_participants: number;
  most_voted_match?: Match;
  top_contestant?: Contestant;
}

export interface UserVoteHistory {
  matchup_id: string;
  selected_contestant_id: string;
  tournament_title: string;
  voted_at: string;
}

export interface AdminDashboardData {
  total_tournaments: number;
  active_tournaments: number;
  total_users: number;
  total_votes: number;
  recent_activity: ActivityLog[];
  tournaments: Tournament[];
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: 'tournament_created' | 'vote_cast' | 'match_completed' | 'user_registered';
  details: string;
  timestamp: string;
}

export interface CreateTournamentData {
  name: string;
  description: string;
  image_url?: string;
  start_date: string;
  end_date?: string;
  max_contestants: number;
  bracket_type: 'single-elimination';
  is_public: boolean;
  quadrant_names?: [string, string, string, string]; // [Q1, Q2, Q3, Q4] custom names
}

export interface CreateContestantData {
  name: string;
  description?: string;
  image_url?: string;
  seed: number;
  quadrant?: 1 | 2 | 3 | 4;
}

export interface VotingFormData {
  selected_contestant_id: string;
}

export interface AuthData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignUpData extends AuthData {
  username: string;
  first_name: string;
  last_name: string;
}

export interface UpdateProfileData {
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FilterOptions {
  status?: Tournament['status'];
  bracket_type?: Tournament['bracket_type'];
  is_public?: boolean;
  created_by?: string;
  search?: string;
}

export interface SortOptions {
  field: 'name' | 'created_at' | 'start_date' | 'current_contestants';
  direction: 'asc' | 'desc';
}

export type DatabaseError = {
  message: string;
  code?: string;
  details?: string;
};

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export type Theme = 'light' | 'dark' | 'system';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary';
}

// Bracket and Tournament specific types
export interface BracketMatchup extends Match {
  contestant1?: Contestant;
  contestant2?: Contestant;
  winner?: Contestant;
  vote_counts?: {
    contestant1_votes: number;
    contestant2_votes: number;
    total_votes: number;
  };
}

export interface BracketRound extends Round {
  matchups: BracketMatchup[];
  is_active: boolean;
}

export interface BracketData {
  rounds: BracketRound[];
  tournament: Tournament;
}

export interface VoteCounts {
  [matchupId: string]: {
    contestant1_votes: number;
    contestant2_votes: number;
    total_votes: number;
  };
}

export interface VotingStatus {
  total_matchups: number;
  voted_matchups: number;
  available_matchups: number;
  completion_percentage: number;
}

export interface TournamentStatistics {
  total_participants: number;
  total_votes: number;
  completed_matchups: number;
  total_matchups: number;
  completion_percentage: number;
  most_popular_contestant?: Contestant;
  participation_rate: number;
}

// =============================================================================
// CONTESTANT SUGGESTIONS TYPES
// =============================================================================

export interface ContestantSuggestion {
  id: string;
  tournament_id: string;
  suggested_by: string;
  name: string;
  description?: string;
  image_url?: string;
  vote_count: number;
  status: 'pending' | 'approved' | 'rejected' | 'duplicate';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SuggestionVote {
  id: string;
  suggestion_id: string;
  user_id: string;
  created_at: string;
}

export interface SuggestionWithVoteStatus extends ContestantSuggestion {
  suggested_by_user: {
    id: string;
    username: string;
  };
  user_has_voted: boolean;
  duplicate_count?: number;
}

export interface SubmitSuggestionRequest {
  tournament_id: string;
  name: string;
  description?: string;
  image_url?: string;
}

export interface GetSuggestionsRequest {
  tournament_id: string;
  page?: number;
  page_size?: number;
  sort_by?: 'votes' | 'newest' | 'oldest' | 'alphabetical';
  status?: 'all' | 'pending' | 'approved' | 'rejected' | 'duplicate';
  search?: string;
}

export interface SuggestionAnalytics {
  total_suggestions: number;
  unique_contributors: number;
  total_votes: number;
  average_votes_per_suggestion: number;
  top_suggestions: Array<{
    id: string;
    name: string;
    vote_count: number;
    suggested_by_username: string;
  }>;
  top_contributors: Array<{
    user_id: string;
    username: string;
    suggestion_count: number;
    total_votes_received: number;
  }>;
  activity_timeline: Array<{
    date: string;
    suggestion_count: number;
    vote_count: number;
  }>;
  status_breakdown: {
    pending: number;
    approved: number;
    rejected: number;
    duplicate: number;
  };
}

export interface ModerateSuggestionRequest {
  suggestion_id: string;
  status: 'approved' | 'rejected' | 'duplicate';
  admin_notes?: string;
}

export interface BulkModerationRequest {
  suggestion_ids: string[];
  action: 'approve' | 'reject' | 'delete';
  admin_notes?: string;
}

export interface BulkModerationResponse {
  success: number;
  failed: number;
  errors: string[];
}

export interface ConvertToContestantRequest {
  suggestion_id: string;
  quadrant: 1 | 2 | 3 | 4;
  seed: number;
}