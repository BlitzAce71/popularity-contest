import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTournament, useTournamentStats } from '@/hooks/tournaments/useTournament';
import { useVotingStatus } from '@/hooks/voting/useVoting';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import BracketVisualization from '@/components/brackets/BracketVisualization';
import TournamentInfo from '@/components/tournaments/TournamentInfo';
import VotingProgress from '@/components/voting/VotingProgress';
import { 
  ArrowLeft, 
  Trophy, 
  Users, 
  Calendar, 
  Clock, 
  Share2, 
  Settings,
  BarChart3 
} from 'lucide-react';

const TournamentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'bracket' | 'info' | 'stats'>('bracket');

  const { tournament, loading: tournamentLoading, error: tournamentError, refresh } = useTournament(id);
  const { stats, loading: statsLoading } = useTournamentStats(id);
  const { status: votingStatus, loading: votingLoading } = useVotingStatus(id);

  const loading = tournamentLoading || statsLoading || votingLoading;
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

  const canManage = user?.id === tournament.createdBy || user?.isAdmin;
  const isActive = tournament.status === 'active';
  const isRegistration = tournament.status === 'registration';

  const getStatusColor = () => {
    switch (tournament.status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'registration':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: tournament.name,
        text: tournament.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      // You could show a toast notification here
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="w-4 h-4" />
          </Button>
          
          {canManage && (
            <Link to={`/tournaments/${id}/manage`}>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Voting Progress for authenticated users */}
      {isAuthenticated && isActive && (
        <VotingProgress 
          tournamentId={id}
          votingStatus={votingStatus}
          className="bg-blue-50 border border-blue-200 rounded-lg"
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
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'stats'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-1" />
            Stats
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'bracket' && (
          <>
            {tournament.status === 'draft' || tournament.status === 'registration' ? (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {tournament.status === 'draft' ? 'Tournament Not Started' : 'Registration Open'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {tournament.status === 'draft' 
                    ? 'The tournament creator is still setting up contestants and bracket.'
                    : 'Waiting for more contestants to join before the tournament can begin.'
                  }
                </p>
                {tournament.status === 'registration' && !isAuthenticated && (
                  <Link to="/auth/login">
                    <Button>Sign In to Join</Button>
                  </Link>
                )}
              </div>
            ) : (
              <BracketVisualization 
                tournamentId={id!} 
                canVote={isAuthenticated && isActive}
                showVotingInterface={isActive}
              />
            )}
          </>
        )}

        {activeTab === 'info' && (
          <TournamentInfo tournament={tournament} />
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">
            {stats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="card p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-8 w-8 text-primary-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Participants</p>
                      <p className="text-2xl font-semibold text-gray-900">{stats.totalParticipants}</p>
                    </div>
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Trophy className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Votes</p>
                      <p className="text-2xl font-semibold text-gray-900">{stats.totalVotes}</p>
                    </div>
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Clock className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Completed Matches</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {stats.completedMatchups}/{stats.totalMatchups}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <BarChart3 className="h-8 w-8 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Progress</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {stats.completionPercentage}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentDetail;