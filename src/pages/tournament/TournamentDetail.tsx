import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTournament } from '@/hooks/tournaments/useTournament';
import { useVotingStatus } from '@/hooks/voting/useVoting';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import BracketVisualization from '@/components/brackets/BracketVisualization';
import TournamentInfo from '@/components/tournaments/TournamentInfo';
import VotingProgress from '@/components/voting/VotingProgress';
import TieBreakerPanel from '@/components/admin/TieBreakerPanel';
import { 
  ArrowLeft, 
  Trophy, 
  Users, 
  Calendar, 
  Clock, 
  Settings,
} from 'lucide-react';

const TournamentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'bracket' | 'info'>('bracket');
  const [liveSelections, setLiveSelections] = useState<Record<string, string>>({});

  const { tournament, loading: tournamentLoading, error: tournamentError, refresh } = useTournament(id);
  const { status: votingStatus, loading: votingLoading } = useVotingStatus(id);

  const loading = tournamentLoading || votingLoading;
  const error = tournamentError;

  if (loading && !tournament) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">Error: {error}</div>
        <Button onClick={refresh} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tournament Not Found</h2>
        <p className="text-gray-600 mb-6">
          The tournament you're looking for doesn't exist or has been removed.
        </p>
        <Link to="/tournaments">
          <Button>Back to Tournaments</Button>
        </Link>
      </div>
    );
  }

  const canManage = user?.id === tournament?.created_by || user?.is_admin;
  const isActive = tournament.status === 'active';
  
  // Debug voting permissions
  console.log('TournamentDetail Voting Debug:', {
    isAuthenticated,
    isActive, 
    tournamentStatus: tournament.status,
    canVoteResult: isAuthenticated && isActive,
    user: user ? { id: user.id, email: user.email } : null
  });

  const getStatusColor = () => {
    switch (tournament.status) {
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


  return (
    <div className="space-y-6">
      {/* Tournament Banner Image */}
      {tournament.image_url && (
        <div className="relative w-full h-64 md:h-80 lg:h-96 overflow-hidden rounded-lg bg-gray-100">
          <img
            src={tournament.image_url}
            alt={tournament.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-20"></div>
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{tournament.name}</h1>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full border bg-white/90 text-gray-800 border-white/20`}>
                    {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                  </span>
                  <span className="text-white/90 text-sm">
                    {tournament.bracket_type?.replace('-', ' ') || 'Single elimination'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManage && (
                  <Link to={`/tournaments/${id}/manage`}>
                    <Button variant="outline" size="sm" className="bg-white/90 text-gray-800 border-white/20 hover:bg-white">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header (for tournaments without banner image) */}
      {!tournament.image_url && (
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Link to="/tournaments">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
            
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
                <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor()}`}>
                  {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                </span>
              </div>
              
              <p className="text-gray-600 max-w-2xl">{tournament.description}</p>
              
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {tournament.current_contestants || 0}/{tournament.max_contestants} contestants
                </div>
                <div className="flex items-center gap-1">
                  <Trophy className="w-4 h-4" />
                  {tournament.bracket_type?.replace('-', ' ') || 'Single elimination'}
                </div>
                {tournament.start_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Started {new Date(tournament.start_date).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            
            {canManage && (
              <Link to={`/tournaments/${id}/manage`}>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Tournament Info (for tournaments with banner image) */}
      {tournament.image_url && (
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Link to="/tournaments">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
            
            <div className="space-y-2">
              <p className="text-gray-600 max-w-2xl">{tournament.description}</p>
              
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {tournament.current_contestants || 0}/{tournament.max_contestants} contestants
                </div>
                <div className="flex items-center gap-1">
                  <Trophy className="w-4 h-4" />
                  {tournament.bracket_type?.replace('-', ' ') || 'Single elimination'}
                </div>
                {tournament.start_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Started {new Date(tournament.start_date).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voting Progress for authenticated users */}
      {isAuthenticated && isActive && (
        <VotingProgress 
          tournamentId={id}
          votingStatus={votingStatus}
          className="bg-blue-50 border border-blue-200 rounded-lg"
          liveSelections={liveSelections}
        />
      )}

      {/* Admin Tie-Breaking Panel */}
      {isAdmin && isActive && id && (
        <TieBreakerPanel 
          tournamentId={id}
          className="border-2 border-red-300"
        />
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('bracket')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'bracket'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {isActive ? 'Vote' : 'Bracket'}
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'info'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Info
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'bracket' && (
          <>
            {tournament.status === 'draft' ? (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Tournament Not Started
                </h3>
                <p className="text-gray-600 mb-6">
                  The tournament creator is still setting up contestants and bracket.
                </p>
              </div>
            ) : (
              <BracketVisualization 
                tournamentId={id!} 
                canVote={isAuthenticated && isActive}
                showVotingInterface={isActive}
                onSelectionsChange={setLiveSelections}
                tournament={tournament}
              />
            )}
          </>
        )}

        {activeTab === 'info' && (
          <TournamentInfo tournament={tournament} />
        )}

      </div>
    </div>
  );
};

export default TournamentDetail;