import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { VotingService } from '@/services/voting';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { 
  Vote, 
  Users, 
  Trophy, 
  CheckCircle, 
  XCircle, 
  Clock,
  ArrowRight,
  Calendar,
  Target
} from 'lucide-react';

interface VoteHistoryItem {
  id: string;
  matchup_id: string;
  round_number: number;
  round_name: string;
  my_contestant: {
    id: string;
    name: string;
  };
  opponent: {
    id: string;
    name: string;
  };
  my_votes: number;
  opponent_votes: number;
  result: 'WON' | 'LOST' | 'PENDING';
  matchup_status: string;
  voted_at: string;
}

interface TournamentVoteHistory {
  tournament: {
    id: string;
    name: string;
    status: string;
  };
  votes: VoteHistoryItem[];
}

const MyVotesPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [voteHistory, setVoteHistory] = useState<TournamentVoteHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVoteHistory = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const history = await VotingService.getUserVoteHistoryByTournament();
        setVoteHistory(history);
      } catch (err) {
        console.error('Error loading vote history:', err);
        setError(err instanceof Error ? err.message : 'Failed to load vote history');
      } finally {
        setLoading(false);
      }
    };

    loadVoteHistory();
  }, [isAuthenticated]);

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'WON':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'LOST':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getResultBadge = (result: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    
    switch (result) {
      case 'WON':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'LOST':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getTournamentStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <Vote className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h2>
        <p className="text-gray-600 mb-6">
          You need to sign in to view your voting history.
        </p>
        <Link to="/auth/login">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">My Votes</h1>
        </div>
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Vote className="w-8 h-8 text-primary-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Votes</h1>
            <p className="text-gray-600">Your voting history across all tournaments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-600">
            {voteHistory.length} tournament{voteHistory.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Vote History */}
      {voteHistory.length === 0 ? (
        <div className="text-center py-12">
          <Vote className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No votes yet</h2>
          <p className="text-gray-600 mb-6">
            Start participating in tournaments to see your voting history here.
          </p>
          <Link to="/tournaments">
            <Button>
              Browse Tournaments
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {voteHistory.map((tournamentHistory) => (
            <div key={tournamentHistory.tournament.id} className="card p-6">
              {/* Tournament Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <Trophy className="w-6 h-6 text-primary-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {tournamentHistory.tournament.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-1 text-xs font-medium rounded border ${getTournamentStatusColor(tournamentHistory.tournament.status)}`}>
                        {tournamentHistory.tournament.status.charAt(0).toUpperCase() + tournamentHistory.tournament.status.slice(1)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {tournamentHistory.votes.length} vote{tournamentHistory.votes.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <Link to={`/tournaments/${tournamentHistory.tournament.id}`}>
                  <Button variant="outline" size="sm">
                    View Tournament
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>

              {/* Votes List */}
              <div className="space-y-3">
                {tournamentHistory.votes.map((vote) => (
                  <div key={vote.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[4rem]">
                        <div className="text-sm font-medium text-gray-900">Round {vote.round_number}</div>
                        <div className="text-xs text-gray-500">{vote.round_name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {vote.my_contestant.name}
                        </span>
                        <span className="text-sm text-gray-500">vs</span>
                        <span className="text-gray-700">
                          {vote.opponent.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {vote.my_votes} - {vote.opponent_votes}
                        </div>
                        <div className="text-xs text-gray-500">
                          {vote.matchup_status === 'completed' ? 'Final' : 'Current'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getResultIcon(vote.result)}
                        <span className={getResultBadge(vote.result)}>
                          {vote.result === 'PENDING' ? 'Pending' : vote.result}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 min-w-[5rem] text-right">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(vote.voted_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyVotesPage;