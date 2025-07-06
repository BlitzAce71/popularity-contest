export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tournament {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  status: 'draft' | 'active' | 'completed';
  startDate: string;
  endDate?: string;
  maxParticipants: number;
  currentParticipants: number;
  bracketType: 'single-elimination' | 'double-elimination' | 'round-robin';
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contestant {
  id: string;
  tournamentId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  seed: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Round {
  id: string;
  tournamentId: string;
  roundNumber: number;
  roundType: 'preliminary' | 'quarterfinal' | 'semifinal' | 'final';
  status: 'upcoming' | 'active' | 'completed';
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Match {
  id: string;
  roundId: string;
  tournamentId: string;
  matchNumber: number;
  contestant1Id: string;
  contestant2Id: string;
  winnerId?: string;
  contestant1Votes: number;
  contestant2Votes: number;
  status: 'upcoming' | 'active' | 'completed';
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vote {
  id: string;
  matchId: string;
  userId: string;
  contestantId: string;
  createdAt: string;
}

export interface BracketPosition {
  id: string;
  tournamentId: string;
  roundId: string;
  matchId?: string;
  contestantId?: string;
  position: number;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentStats {
  totalVotes: number;
  totalMatches: number;
  completedMatches: number;
  activeMatches: number;
  totalParticipants: number;
  mostVotedMatch?: Match;
  topContestant?: Contestant;
}

export interface UserVoteHistory {
  matchId: string;
  contestantId: string;
  tournamentTitle: string;
  votedAt: string;
}

export interface AdminDashboardData {
  totalTournaments: number;
  activeTournaments: number;
  totalUsers: number;
  totalVotes: number;
  recentActivity: ActivityLog[];
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: 'tournament_created' | 'vote_cast' | 'match_completed' | 'user_registered';
  details: string;
  timestamp: string;
}

export interface CreateTournamentData {
  title: string;
  description: string;
  imageUrl?: string;
  startDate: string;
  endDate?: string;
  maxParticipants: number;
  bracketType: 'single-elimination' | 'double-elimination' | 'round-robin';
  isPublic: boolean;
}

export interface CreateContestantData {
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface VotingFormData {
  contestantId: string;
}

export interface AuthData {
  email: string;
  password: string;
}

export interface SignUpData extends AuthData {
  username: string;
  firstName: string;
  lastName: string;
}

export interface UpdateProfileData {
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
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
  bracketType?: Tournament['bracketType'];
  isPublic?: boolean;
  createdBy?: string;
  search?: string;
}

export interface SortOptions {
  field: 'title' | 'createdAt' | 'startDate' | 'currentParticipants';
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
  voteCounts: {
    contestant1Votes: number;
    contestant2Votes: number;
    totalVotes: number;
  };
  is_tie?: boolean;
}

export interface BracketRound extends Round {
  matchups: BracketMatchup[];
  isActive: boolean;
  completed_matchups: number;
  total_matchups: number;
}

export interface BracketData {
  rounds: BracketRound[];
  tournament: Tournament;
}

export interface VoteCounts {
  [matchupId: string]: {
    contestant1Votes: number;
    contestant2Votes: number;
    totalVotes: number;
  };
}

export interface VotingStatus {
  totalMatchups: number;
  votedMatchups: number;
  availableMatchups: number;
  completionPercentage: number;
}

export interface TournamentStatistics {
  totalParticipants: number;
  totalVotes: number;
  completedMatchups: number;
  totalMatchups: number;
  completionPercentage: number;
  mostPopularContestant?: Contestant;
  participationRate: number;
}