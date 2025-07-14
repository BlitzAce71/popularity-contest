import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TournamentService } from '@/services/tournaments';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { 
  Trophy, 
  Users, 
  Target, 
  ArrowLeft,
  Crown,
  TrendingDown,
  CheckCircle,
  XCircle,
  Minus
} from 'lucide-react';

interface ParticipantPerformance {
  id: string;
  name: string;
  seed: number;
  total_wins: number;
  total_losses: number;
  total_votes_received: number;
  eliminated_round: number | null;
  is_active: boolean;
  rounds: Array<{
    round_number: number;
    round_name: string;
    round_status: string;
    matchup_id: string;
    opponent_name: string;
    opponent_id: string;
    my_votes: number;
    opponent_votes: number;
    total_votes: number;
    result: 'WON' | 'LOST' | 'TIED' | 'PENDING';
    is_tie: boolean;
    completed_at: string;
  }>;
}

interface BlowoutData {
  round_number: number;
  round_name: string;
  matchup_id: string;
  vote_margin: number;
  total_votes: number;
  winner_name: string;
  loser_name: string;
  winner_votes: number;
  loser_votes: number;
}

interface StatsData {
  participants: ParticipantPerformance[];
  biggest_blowouts: BlowoutData[];
}

const StatsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Load tournament details and stats in parallel
        const [tournamentData, performanceData] = await Promise.all([
          TournamentService.getTournament(id),
          TournamentService.getParticipantPerformance(id)
        ]);
        
        setTournament(tournamentData);
        setStatsData(performanceData);
      } catch (err) {
        console.error('Error loading stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tournament stats');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'WON':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'LOST':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'TIED':
        return <Minus className="w-4 h-4 text-gray-500" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-300" />;
    }
  };

  const getResultBadge = (result: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    
    switch (result) {
      case 'WON':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'LOST':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'TIED':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
    }
  };

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
        <div className="flex items-center gap-4">
          <Link to="/tournaments">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tournaments
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Tournament Stats</h1>
        </div>
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (!tournament || !statsData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No tournament data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/tournaments/${tournament?.slug}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tournament
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tournament Stats</h1>
            <p className="text-gray-600">{tournament.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary-600" />
          <span className="text-sm text-gray-500">
            {statsData.participants.length} participants
          </span>
        </div>
      </div>

      {/* Biggest Blowouts Section */}
      {statsData.biggest_blowouts.length > 0 && (
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-500" />
            Biggest Blowouts by Round
          </h2>
          <div className="space-y-3">
            {statsData.biggest_blowouts.map((blowout) => (
              <div key={`${blowout.round_number}-${blowout.matchup_id}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-500">Round {blowout.round_number}</div>
                    <div className="text-xs text-gray-400">{blowout.round_name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-yellow-500" />
                    <span className="font-medium text-gray-900">{blowout.winner_name}</span>
                    <span className="text-sm text-gray-500">defeated</span>
                    <span className="text-gray-700">{blowout.loser_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {blowout.winner_votes} - {blowout.loser_votes}
                    </div>
                    <div className="text-sm text-gray-500">
                      {blowout.vote_margin} vote margin
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {blowout.total_votes} total votes
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Participant Performance Section */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          Participant Performance
        </h2>
        
        <div className="space-y-6">
          {statsData.participants
            .sort((a, b) => {
              // Sort by quadrant first, then by seed (both ascending)
              if (a.quadrant !== b.quadrant) {
                return (a.quadrant || 1) - (b.quadrant || 1);
              }
              return (a.seed || 0) - (b.seed || 0);
            })
            .map((participant) => (
            <div key={participant.id} className="border rounded-lg p-6">
              {/* Participant Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-gray-400" />
                    <h3 className="text-lg font-semibold text-gray-900">{participant.name}</h3>
                  </div>
                  {participant.seed && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Seed #{participant.seed}
                    </span>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {participant.total_wins} wins
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="w-4 h-4 text-red-500" />
                      {participant.total_losses} losses
                    </span>
                    <span>{participant.total_votes_received} total votes</span>
                  </div>
                </div>
                <div className="text-right">
                  {participant.eliminated_round ? (
                    <span className="text-sm text-gray-500">
                      Eliminated in Round {participant.eliminated_round}
                    </span>
                  ) : participant.is_active ? (
                    <span className="text-sm text-green-600 font-medium">Active</span>
                  ) : (
                    <span className="text-sm text-gray-500">Inactive</span>
                  )}
                </div>
              </div>

              {/* Round Performance */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Round by Round Performance</h4>
                {participant.rounds.length > 0 ? (
                  <div className="space-y-2">
                    {participant.rounds.map((round, index) => (
                      <div key={`${participant.id}-${round.round_number}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[4rem]">
                            <div className="text-sm font-medium text-gray-900">Round {round.round_number}</div>
                            <div className="text-xs text-gray-500">{round.round_name}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getResultIcon(round.result)}
                            <span className="text-sm text-gray-700">vs</span>
                            <span className="font-medium text-gray-900">{round.opponent_name}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">
                              {round.my_votes} - {round.opponent_votes}
                            </div>
                            <div className="text-xs text-gray-500">
                              {round.total_votes} total votes
                            </div>
                          </div>
                          <span className={getResultBadge(round.result)}>
                            {round.result}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No rounds played yet</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatsPage;