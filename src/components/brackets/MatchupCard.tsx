import React, { useState } from 'react';
import { useVoting } from '@/hooks/voting/useVoting';
import { getFileUrl } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Crown, Users, Clock, CheckCircle } from 'lucide-react';

interface Contestant {
  id: string;
  name: string;
  image_url?: string;
}

interface Matchup {
  id: string;
  status: 'upcoming' | 'active' | 'completed';
  contestant1?: Contestant;
  contestant2?: Contestant;
  winner?: Contestant;
  voteCounts: {
    contestant1Votes: number;
    contestant2Votes: number;
    totalVotes: number;
  };
}

interface MatchupCardProps {
  matchup: Matchup;
  canVote?: boolean;
  showVotingInterface?: boolean;
  loading?: boolean;
  compact?: boolean;
  className?: string;
  onSelectionChange?: (matchupId: string, contestantId: string | null) => void;
  externalSelection?: string | null;
  disableIndividualVoting?: boolean;
}

const MatchupCard: React.FC<MatchupCardProps> = ({
  matchup,
  canVote = false,
  showVotingInterface = false,
  loading = false,
  compact = false,
  className = '',
  onSelectionChange,
  externalSelection,
  disableIndividualVoting = false,
}) => {
  const [selectedContestant, setSelectedContestant] = useState<string | null>(null);
  const { 
    userVote, 
    submitting, 
    error, 
    submitVote, 
    saveDraft 
  } = useVoting(matchup.id);

  const { contestant1, contestant2, winner, voteCounts, status } = matchup;
  const isActive = status === 'active';
  const isCompleted = status === 'completed';
  const hasVoted = !!userVote;
  const totalVotes = voteCounts.totalVotes;

  // Debug logging for vote counts and winner data
  console.log('MatchupCard Debug:', {
    matchupId: matchup.id,
    voteCounts,
    vote_counts: matchup.vote_counts,
    totalVotes,
    contestant1Votes: voteCounts.contestant1Votes,
    contestant2Votes: voteCounts.contestant2Votes,
    status,
    winner: winner,
    winnerId: winner?.id,
    contestant1Id: contestant1?.id,
    contestant2Id: contestant2?.id,
    isCompleted,
  });

  // Calculate vote percentages
  const getVotePercentage = (votes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  const contestant1Percentage = getVotePercentage(voteCounts.contestant1Votes);
  const contestant2Percentage = getVotePercentage(voteCounts.contestant2Votes);

  const handleVoteSubmit = async () => {
    if (!selectedContestant || !canVote) return;

    const success = await submitVote(selectedContestant);
    if (success) {
      setSelectedContestant(null);
    }
  };

  const handleContestantSelect = (contestantId: string) => {
    console.log('MatchupCard handleContestantSelect:', { contestantId, canVote, hasVoted, submitting, onSelectionChange: !!onSelectionChange });
    if (!canVote || hasVoted || submitting) return;
    
    if (onSelectionChange) {
      // External selection handling for round-level voting
      const newSelection = externalSelection === contestantId ? null : contestantId;
      onSelectionChange(matchup.id, newSelection);
    } else {
      // Individual matchup voting
      setSelectedContestant(contestantId);
      saveDraft(contestantId);
    }
  };

  const getContestantCardClass = (contestantId: string) => {
    const baseClass = "relative p-4 rounded-lg border transition-all duration-200";
    
    if (!contestant1 || !contestant2) {
      return `${baseClass} bg-gray-50 border-gray-200`;
    }

    // Completed state
    if (isCompleted) {
      if (winner?.id === contestantId) {
        return `${baseClass} bg-green-50 border-green-300 ring-2 ring-green-200`;
      }
      return `${baseClass} bg-gray-50 border-gray-200`;
    }

    // Active voting state
    if (isActive && canVote && !hasVoted) {
      const currentSelection = onSelectionChange ? externalSelection : selectedContestant;
      if (currentSelection === contestantId) {
        return `${baseClass} bg-primary-50 border-primary-300 ring-2 ring-primary-200 cursor-pointer`;
      }
      return `${baseClass} bg-white border-gray-200 hover:border-primary-300 hover:bg-primary-25 cursor-pointer`;
    }

    // User has voted
    if (hasVoted && userVote?.selected_contestant_id === contestantId) {
      return `${baseClass} bg-blue-50 border-blue-300 ring-2 ring-blue-200`;
    }

    return `${baseClass} bg-white border-gray-200`;
  };

  const renderContestant = (contestant: Contestant | undefined, isContestant1: boolean) => {
    if (!contestant) {
      return (
        <div className={getContestantCardClass('')}>
          <div className="text-center text-gray-500">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <div className="text-sm">TBD</div>
          </div>
        </div>
      );
    }

    const votes = isContestant1 ? voteCounts.contestant1Votes : voteCounts.contestant2Votes;
    const percentage = isContestant1 ? contestant1Percentage : contestant2Percentage;
    const isWinner = winner?.id === contestant.id;
    const isUserChoice = userVote?.selected_contestant_id === contestant.id;

    // Debug winner highlighting
    console.log('Winner Debug:', {
      contestantName: contestant.name,
      contestantId: contestant.id,
      winnerId: winner?.id,
      isWinner,
      status,
      isCompleted
    });

    return (
      <div
        className={getContestantCardClass(contestant.id)}
        onClick={() => handleContestantSelect(contestant.id)}
      >
        {/* Winner crown */}
        {isWinner && (
          <div className="absolute -top-2 -right-2">
            <Crown className="w-6 h-6 text-yellow-500" />
          </div>
        )}

        {/* User vote indicator */}
        {isUserChoice && (
          <div className="absolute -top-2 -left-2">
            <CheckCircle className="w-5 h-5 text-blue-500" />
          </div>
        )}

        <div className="flex flex-col items-center gap-3">
          {/* Contestant image - Larger square format */}
          {contestant.image_url ? (
            <img
              src={getFileUrl('contestant-images', contestant.image_url)}
              alt={contestant.name}
              className={`object-cover ${compact ? 'w-20 h-20' : 'w-24 h-24'} rounded-lg`}
            />
          ) : (
            <div className={`bg-gray-200 flex items-center justify-center rounded-lg ${
              compact ? 'w-20 h-20' : 'w-24 h-24'
            }`}>
              <Users className="w-8 h-8 text-gray-500" />
            </div>
          )}

          <div className="text-center min-w-0 w-full">
            <div className={`font-medium truncate ${compact ? 'text-sm' : ''} ${
              isWinner 
                ? 'bg-green-100 text-green-800 px-3 py-1 rounded-lg' 
                : 'text-gray-900'
            }`}>
              {contestant.name}
            </div>
            
            {/* Vote count and percentage */}
            {(isCompleted || (isActive && totalVotes > 0)) && (
              <div className="flex items-center justify-center gap-2 mt-1">
                <div className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {votes} votes ({percentage}%)
                </div>
                {/* Progress bar */}
                <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-16">
                  <div
                    className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selection indicator for voting */}
        {isActive && canVote && !hasVoted && (onSelectionChange ? externalSelection : selectedContestant) === contestant.id && (
          <div className="absolute inset-0 bg-primary-500 bg-opacity-10 rounded-lg pointer-events-none" />
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Matchup header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {isActive && <Clock className="w-4 h-4 text-green-600" />}
          {isCompleted && <CheckCircle className="w-4 h-4 text-gray-600" />}
          <span className="capitalize">{status}</span>
        </div>
        
        {totalVotes > 0 && (
          <div className="text-sm text-gray-600">
            {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Contestants - Side by side layout */}
      <div className="flex items-center gap-6">
        <div className="flex-1">
          {renderContestant(contestant1, true)}
        </div>
        
        {/* VS divider */}
        <div className="flex-shrink-0">
          <span className="text-lg font-bold text-gray-500 bg-gray-100 px-4 py-2 rounded-full">
            VS
          </span>
        </div>
        
        <div className="flex-1">
          {renderContestant(contestant2, false)}
        </div>
      </div>

      {/* Voting controls - only show for individual voting, not external selection */}
      {showVotingInterface && isActive && canVote && !hasVoted && contestant1 && contestant2 && !onSelectionChange && (
        <div className="pt-4 border-t border-gray-200">
          {error && (
            <div className="text-red-600 text-sm mb-3">{error}</div>
          )}
          
          <div className="flex gap-2">
            <Button
              onClick={handleVoteSubmit}
              disabled={!selectedContestant || submitting}
              loading={submitting}
              className="flex-1"
              size="sm"
            >
              {submitting ? 'Voting...' : 'Submit Vote'}
            </Button>
            
            {selectedContestant && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedContestant(null)}
                disabled={submitting}
              >
                Clear
              </Button>
            )}
          </div>
          
          {!selectedContestant && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Select a contestant to vote
            </p>
          )}
        </div>
      )}

      {/* Already voted message */}
      {hasVoted && isActive && (
        <div className="pt-4 border-t border-gray-200">
          <div className="text-center text-sm text-green-600">
            ✓ You voted for {userVote.selected_contestant_id === contestant1?.id ? contestant1?.name : contestant2?.name}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center py-2">
          <LoadingSpinner size="sm" />
        </div>
      )}
    </div>
  );
};

export default MatchupCard;