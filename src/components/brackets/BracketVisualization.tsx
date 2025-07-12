import React, { useState } from 'react';
import { useBracketData } from '@/hooks/tournaments/useTournament';
import { useLiveVoteCounts, useVoting, useBatchVoting } from '@/hooks/voting/useVoting';
import type { BracketRound, BracketMatchup } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import MatchupCard from './MatchupCard';
import { Trophy, Users } from 'lucide-react';

interface BracketVisualizationProps {
  tournamentId: string;
  canVote?: boolean;
  showVotingInterface?: boolean;
  className?: string;
}

interface RoundVotingInterfaceProps {
  round: BracketRound;
  onVotesSubmitted: () => void;
}

interface RoundVotingProps {
  round: BracketRound;
  onVotesSubmitted: () => void;
  onSelectionChange: (matchupId: string, contestantId: string | null) => void;
  selections: Record<string, string>;
}

const RoundVotingInterface: React.FC<RoundVotingProps> = ({ round, onVotesSubmitted, onSelectionChange, selections }) => {
  const { submitting, error, submitBatchVotes } = useBatchVoting();

  const totalMatchups = round.matchups.length;
  const selectedCount = Object.keys(selections).length;
  const allSelected = selectedCount === totalMatchups;

  const handleSubmitAllVotes = async () => {
    if (!allSelected) return;

    // Convert selections to batch vote format
    const votes = Object.entries(selections).map(([matchupId, selectedContestantId]) => ({
      matchupId,
      selectedContestantId,
    }));

    const success = await submitBatchVotes(votes);
    if (success) {
      onVotesSubmitted();
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Submit button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {selectedCount} of {totalMatchups} selections made
        </p>
        <Button
          onClick={handleSubmitAllVotes}
          disabled={!allSelected || submitting}
          loading={submitting}
          className="px-6"
        >
          {submitting ? 'Submitting Votes...' : `Submit All Votes (${selectedCount}/${totalMatchups})`}
        </Button>
      </div>
    </div>
  );
};

const BracketVisualization: React.FC<BracketVisualizationProps> = ({
  tournamentId,
  canVote = false,
  showVotingInterface = false,
  className = '',
}) => {
  const { bracketData, loading: bracketLoading, error } = useBracketData(tournamentId);
  const { voteCounts, loading: voteLoading } = useLiveVoteCounts(tournamentId, bracketData?.tournament?.status);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});

  const handleContestantSelect = (matchupId: string, contestantId: string | null) => {
    setSelections(prev => {
      if (contestantId === null) {
        const newSelections = { ...prev };
        delete newSelections[matchupId];
        return newSelections;
      }
      return {
        ...prev,
        [matchupId]: contestantId
      };
    });
  };

  if (bracketLoading && !bracketData) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">Failed to load bracket: {error}</div>
      </div>
    );
  }

  if (!bracketData || !Array.isArray(bracketData) || bracketData.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Bracket Available</h3>
        <p className="text-gray-600">
          The tournament bracket hasn't been generated yet.
        </p>
      </div>
    );
  }

  const rounds = bracketData || [];
  const matchups = rounds.flatMap(round => round.matchups || []);
  const totalRounds = rounds.length;

  // Calculate bracket layout
  const getBracketLayout = (): BracketRound[] => {
    const layout: BracketRound[] = [];
    
    rounds.forEach((round: any) => {
      // Map the API response structure to our expected structure
      const roundData = {
        id: round.id || `round-${round.round_number}`,
        name: round.round_name || `Round ${round.round_number}`,
        status: round.round_status,
        round_number: round.round_number,
        isActive: round.round_status === 'active',
        matchups: (round.matchups || []).map((matchup: any) => {
          const voteData = voteCounts[matchup.id] || {
            contestant1Votes: 0,
            contestant2Votes: 0,
            totalVotes: 0,
          };
          
          console.log('BracketVisualization Debug Mapping:', {
            matchupId: matchup.id,
            rawVoteData: voteCounts[matchup.id],
            mappedVoteData: voteData,
            finalVoteCounts: {
              contestant1Votes: voteData.contestant1Votes,
              contestant2Votes: voteData.contestant2Votes,
              totalVotes: voteData.totalVotes,
            }
          });
          
          // Determine winner based on vote counts for completed matchups
          let winner = matchup.winner;
          if (matchup.status === 'completed' && !winner && matchup.contestant1 && matchup.contestant2) {
            if (voteData.contestant1Votes > voteData.contestant2Votes) {
              winner = matchup.contestant1;
              console.log(`Winner determined: ${winner.name} (contestant1) - ${voteData.contestant1Votes} vs ${voteData.contestant2Votes}`);
            } else if (voteData.contestant2Votes > voteData.contestant1Votes) {
              winner = matchup.contestant2;
              console.log(`Winner determined: ${winner.name} (contestant2) - ${voteData.contestant1Votes} vs ${voteData.contestant2Votes}`);
            }
          }
          
          return {
            ...matchup,
            winner,
            voteCounts: voteData,
            vote_counts: {
              contestant1_votes: voteData.contestant1Votes,
              contestant2_votes: voteData.contestant2Votes,
              total_votes: voteData.totalVotes,
            },
          };
        }),
      };
      layout.push(roundData);
    });

    return layout;
  };

  const bracketLayout = getBracketLayout();
  const activeRound = bracketLayout.find(round => round.isActive);


  // Round-by-round tournament view - default to active round
  const activeRoundIndex = bracketLayout.findIndex(r => r.isActive);
  const defaultRoundIndex = activeRoundIndex >= 0 ? activeRoundIndex : 0;
  const currentRoundIndex = selectedRound !== null ? selectedRound : defaultRoundIndex;
  const currentRound = bracketLayout[currentRoundIndex];
  
  // Only show rounds up to and including the active round
  const visibleRounds = bracketLayout.filter((round, index) => {
    return round.status === 'completed' || round.isActive;
  });
  const hasRoundVoting = showVotingInterface && currentRound?.isActive && currentRound?.status !== 'completed' && canVote;
  
  // Debug logging
  console.log('BracketVisualization Debug:', {
    showVotingInterface,
    canVote,
    currentRound: currentRound ? { id: currentRound.id, name: currentRound.name, isActive: currentRound.isActive, status: currentRound.status } : null,
    hasRoundVoting,
    bracketLayoutLength: bracketLayout.length,
    activeRound: activeRound ? { id: activeRound.id, name: activeRound.name, status: activeRound.status } : null,
    votingInterfaceConditions: {
      showVotingInterface,
      currentRoundIsActive: currentRound?.isActive,
      currentRoundNotCompleted: currentRound?.status !== 'completed',
      canVote,
      finalResult: hasRoundVoting
    }
  });

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Tournament Progress Overview */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Tournament Progress</h2>
          <div className="text-sm text-gray-500">
            {bracketLayout.filter(r => r.status === 'completed').length} of {bracketLayout.length} rounds completed
          </div>
        </div>
        
        {/* Round Navigation - Only show completed and active rounds */}
        <div className="flex flex-wrap gap-3 mb-6">
          {visibleRounds.map((round) => {
            const originalIndex = bracketLayout.findIndex(r => r.id === round.id);
            const isSelected = originalIndex === currentRoundIndex;
            const isCompleted = round.status === 'completed';
            const isActive = round.isActive;
            
            return (
              <button
                key={round.id}
                onClick={() => setSelectedRound(originalIndex)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors border ${
                  isSelected
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                    : isCompleted
                    ? 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                    : isActive
                    ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isCompleted && <span className="text-sm">✓</span>}
                  {isActive && <span className="w-2 h-2 bg-green-600 rounded-full"></span>}
                  <span>{round.name || `Round ${originalIndex + 1}`}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Round Display */}
      {currentRound && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {currentRound.name}
                {currentRound.isActive && (
                  <span className="ml-3 px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full font-medium">
                    Active - Vote Now!
                  </span>
                )}
                {currentRound.status === 'completed' && (
                  <span className="ml-3 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full font-medium">
                    Completed
                  </span>
                )}
              </h3>
              <p className="text-gray-600">
                {currentRound.matchups.filter(m => m.status === 'completed' && m.contestant1 && m.contestant2 && m.contestant1.name && m.contestant2.name && m.contestant1.name !== 'TBD' && m.contestant2.name !== 'TBD').length} of {currentRound.matchups.filter(m => m.contestant1 && m.contestant2 && m.contestant1.name && m.contestant2.name && m.contestant1.name !== 'TBD' && m.contestant2.name !== 'TBD').length} matchups completed
              </p>
            </div>
            
            {/* Navigation arrows - Only navigate through visible rounds */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const currentVisibleIndex = visibleRounds.findIndex(r => r.id === currentRound.id);
                  if (currentVisibleIndex > 0) {
                    const prevRound = visibleRounds[currentVisibleIndex - 1];
                    const prevIndex = bracketLayout.findIndex(r => r.id === prevRound.id);
                    setSelectedRound(prevIndex);
                  }
                }}
                disabled={visibleRounds.findIndex(r => r.id === currentRound.id) === 0}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ←
              </button>
              <button
                onClick={() => {
                  const currentVisibleIndex = visibleRounds.findIndex(r => r.id === currentRound.id);
                  if (currentVisibleIndex < visibleRounds.length - 1) {
                    const nextRound = visibleRounds[currentVisibleIndex + 1];
                    const nextIndex = bracketLayout.findIndex(r => r.id === nextRound.id);
                    setSelectedRound(nextIndex);
                  }
                }}
                disabled={visibleRounds.findIndex(r => r.id === currentRound.id) === visibleRounds.length - 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                →
              </button>
            </div>
          </div>

          {/* Matchups List - Single column layout with separators */}
          <div className="space-y-8">
            {(currentRound.matchups || []).filter((matchup: BracketMatchup) => 
              matchup.contestant1 && matchup.contestant2 && 
              matchup.contestant1.name && matchup.contestant2.name &&
              matchup.contestant1.name !== 'TBD' && matchup.contestant2.name !== 'TBD'
            ).map((matchup: BracketMatchup, index: number, filteredMatchups: BracketMatchup[]) => (
              <div key={matchup.id}>
                <div className="space-y-4">
                  <MatchupCard
                    matchup={matchup}
                    canVote={canVote && currentRound.isActive && matchup.status === 'active'}
                    showVotingInterface={showVotingInterface}
                    loading={voteLoading}
                    onSelectionChange={hasRoundVoting ? handleContestantSelect : undefined}
                    externalSelection={hasRoundVoting ? selections[matchup.id] : undefined}
                  />
                  
                  {/* Next Round Preview */}
                  {matchup.winner && currentRoundIndex < bracketLayout.length - 1 && (
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <span>→</span>
                        <span>Advances to {bracketLayout[currentRoundIndex + 1]?.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {matchup.winner.image_url && (
                          <img
                            src={matchup.winner.image_url}
                            alt={matchup.winner.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        )}
                        <span className="font-medium text-gray-900">{matchup.winner.name}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Separator between matchups - not shown after the last matchup */}
                {index < filteredMatchups.length - 1 && (
                  <div className="mt-8 pt-8 border-t border-gray-200">
                    <div className="flex items-center justify-center">
                      <div className="bg-gray-100 rounded-full px-4 py-2">
                        <span className="text-sm font-medium text-gray-600">
                          Matchup {index + 2}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Round voting interface */}
          {hasRoundVoting && (
            <RoundVotingInterface 
              round={currentRound}
              onVotesSubmitted={() => {
                window.location.reload();
              }}
              onSelectionChange={handleContestantSelect}
              selections={selections}
            />
          )}
        </div>
      )}

      {/* Tournament Winner */}
      {bracketLayout.length > 0 && (() => {
        const finalRound = bracketLayout[bracketLayout.length - 1];
        const finalMatchup = finalRound.matchups[0];
        const winner = finalMatchup?.winner;
        
        if (winner) {
          return (
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-300 rounded-lg p-8 text-center">
              <Trophy className="w-20 h-20 text-yellow-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Tournament Champion!</h3>
              
              <div className="space-y-4">
                {winner.image_url && (
                  <img
                    src={winner.image_url}
                    alt={winner.name}
                    className="w-24 h-24 object-cover rounded-full mx-auto border-4 border-yellow-400 shadow-lg"
                  />
                )}
                <div>
                  <div className="font-bold text-2xl text-yellow-800">{winner.name}</div>
                  <div className="text-lg text-yellow-600 font-medium mt-1">
                    🏆 Tournament Winner
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
};

export default BracketVisualization;