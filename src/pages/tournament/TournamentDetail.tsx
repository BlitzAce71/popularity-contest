import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTournament } from '@/hooks/tournaments/useTournament';
import { useVotingStatus } from '@/hooks/voting/useVoting';
import { useAuth } from '@/contexts/AuthContext';
import { useSuggestions, useSuggestionVoting } from '@/hooks/suggestions';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import BracketVisualization from '@/components/brackets/BracketVisualization';
import TournamentInfo from '@/components/tournaments/TournamentInfo';
import VotingProgress from '@/components/voting/VotingProgress';
import TieBreakerPanel from '@/components/admin/TieBreakerPanel';
import SuggestionForm from '@/components/suggestions/SuggestionForm';
import SuggestionList from '@/components/suggestions/SuggestionList';
import type { SubmitSuggestionRequest } from '@/types';
import { 
  ArrowLeft, 
  Trophy, 
  Users, 
  Clock, 
  Settings,
  Lightbulb,
} from 'lucide-react';

const TournamentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'bracket' | 'info' | 'suggestions'>('bracket');
  const [liveSelections, setLiveSelections] = useState<Record<string, string>>({});

  const { tournament, loading: tournamentLoading, error: tournamentError, refresh } = useTournament(id);
  const { status: votingStatus, loading: votingLoading } = useVotingStatus(id);

  // Suggestion hooks (only needed for draft tournaments)
  const shouldLoadSuggestions = tournament?.status === 'draft';
  const { 
    suggestions, 
    loading: suggestionsLoading, 
    error: suggestionsError, 
    total: suggestionsTotal,
    submitSuggestion, 
    refreshSuggestions,
    updateSuggestionInList,
    hasMore: hasMoreSuggestions,
    loadMore: loadMoreSuggestions
  } = useSuggestions(shouldLoadSuggestions ? id : null);
  
  const { toggleVote, hasUserVoted, isVotingInProgress: isVotingLoading } = useSuggestionVoting(id || '');

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
  const isDraft = tournament.status === 'draft';

  // Suggestion handlers
  const handleSubmitSuggestion = async (data: SubmitSuggestionRequest) => {
    if (!id) return false;
    return await submitSuggestion({ ...data, tournament_id: id });
  };

  const handleVoteSuggestion = async (suggestionId: string) => {
    if (!id) return;
    
    // Get current suggestion and vote status before toggling
    const currentSuggestion = suggestions.find(s => s.id === suggestionId);
    const currentlyVoted = hasUserVoted(suggestionId);
    
    if (!currentSuggestion) {
      console.error('Suggestion not found:', suggestionId);
      return;
    }
    
    // Calculate expected vote count change
    const voteCountDelta = currentlyVoted ? -1 : 1;
    const expectedVoteCount = Math.max(0, currentSuggestion.vote_count + voteCountDelta);
    
    // Apply optimistic update immediately
    updateSuggestionInList(suggestionId, { 
      vote_count: expectedVoteCount,
      user_has_voted: !currentlyVoted
    });
    
    // Call the toggle vote function
    const success = await toggleVote(suggestionId, (suggestionId, serverVoteCount) => {
      // Update with server response if different from our optimistic update
      if (serverVoteCount !== expectedVoteCount) {
        console.log(`Vote count mismatch for ${suggestionId}: expected ${expectedVoteCount}, got ${serverVoteCount}`);
        updateSuggestionInList(suggestionId, { 
          vote_count: serverVoteCount,
          user_has_voted: !currentlyVoted
        });
      }
    });
    
    if (!success) {
      // Rollback optimistic update on failure
      updateSuggestionInList(suggestionId, { 
        vote_count: currentSuggestion.vote_count,
        user_has_voted: currentlyVoted
      });
    }
  };
  
  // Debug voting permissions
  console.log('TournamentDetail Voting Debug:', {
    isAuthenticated,
    isActive, 
    tournamentStatus: tournament.status,
    canVoteResult: isAuthenticated && isActive,
    user: user ? { id: user.id, email: user.email } : null
  });

  // Debug suggestions
  if (isDraft) {
    console.log('Suggestions Debug:', {
      suggestions,
      suggestionsType: typeof suggestions,
      isArray: Array.isArray(suggestions),
      suggestionsError,
      suggestionsLoading,
      firstSuggestion: suggestions && suggestions.length > 0 ? suggestions[0] : null,
      suggestionKeys: suggestions && suggestions.length > 0 ? Object.keys(suggestions[0]) : []
    });
  }

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
                  <Link to={`/tournaments/${tournament?.slug}/manage`}>
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
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            
            {canManage && (
              <Link to={`/tournaments/${tournament?.slug}/manage`}>
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
          {isDraft && (
            <button
              onClick={() => setActiveTab('suggestions')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'suggestions'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              Suggestions ({suggestionsTotal || 0})
            </button>
          )}
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

        {activeTab === 'suggestions' && isDraft && (
          <div className="space-y-6">
            {/* Suggestions Header */}
            <div className="text-center py-6 border-b border-gray-200">
              <Lightbulb className="w-12 h-12 text-blue-600 mx-auto mb-3" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Contestant Suggestions
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Help shape this tournament by suggesting contestants and voting on others' ideas. 
                The most popular suggestions will be considered by the tournament organizer.
              </p>
            </div>

            {/* Suggestion Form */}
            {isAuthenticated && (
              <SuggestionForm
                onSubmit={handleSubmitSuggestion}
                loading={suggestionsLoading}
              />
            )}

            {/* Login prompt for unauthenticated users */}
            {!isAuthenticated && (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-gray-600 mb-4">
                  Please log in to submit suggestions and vote on others' ideas.
                </div>
                <Link to="/login">
                  <Button>Sign In</Button>
                </Link>
              </div>
            )}

            {/* Suggestions List */}
            <SuggestionList
              suggestions={suggestions}
              loading={suggestionsLoading}
              error={suggestionsError}
              total={suggestionsTotal}
              onVote={handleVoteSuggestion}
              onRefresh={refreshSuggestions}
              onLoadMore={hasMoreSuggestions ? loadMoreSuggestions : undefined}
              isVotingLoading={(suggestionId) => isVotingLoading(suggestionId)}
              canVote={isAuthenticated}
              hasMore={hasMoreSuggestions}
            />
          </div>
        )}

        {activeTab === 'info' && (
          <TournamentInfo tournament={tournament} />
        )}

      </div>
    </div>
  );
};

export default TournamentDetail;