import React, { useState } from 'react';
import { useBracketData } from '@/hooks/tournaments/useTournament';
import { useLiveVoteCounts, useVoting } from '@/hooks/voting/useVoting';
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get voting hooks for each matchup
  const votingHooks = round.matchups.map(matchup => ({
    matchupId: matchup.id,
    hook: useVoting(matchup.id)
  }));

  const totalMatchups = round.matchups.length;
  const selectedCount = Object.keys(selections).length;
  const allSelected = selectedCount === totalMatchups;

  const handleSubmitAllVotes = async () => {
    if (!allSelected) return;

    setSubmitting(true);
    setError(null);

    try {
      // Submit votes for all matchups
      const promises = votingHooks.map(({ matchupId, hook }) => {
        const selectedContestant = selections[matchupId];
        if (selectedContestant) {
          return hook.submitVote(selectedContestant);
        }
        return Promise.resolve(false);
      });

      const results = await Promise.all(promises);
      const allSuccessful = results.every(result => result);

      if (allSuccessful) {
        onVotesSubmitted();
      } else {
        setError('Some votes failed to submit. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit votes');
    } finally {
      setSubmitting(false);
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
  const { voteCounts, loading: voteLoading } = useLiveVoteCounts(tournamentId);
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
    
    rounds.forEach((round: BracketRound) => {
      // Group matchups by round_id
      const roundMatchups = matchups.filter((matchup: any) => matchup.round_id === round.id);
      
      const roundData = {
        ...round,
        isActive: round.status === 'active',
        matchups: roundMatchups.map((matchup: BracketMatchup) => ({
          ...matchup,
          voteCounts: voteCounts[matchup.id] || {
            contestant1Votes: 0,
            contestant2Votes: 0,
            totalVotes: 0,
          },
          vote_counts: voteCounts[matchup.id] || {
            contestant1_votes: 0,
            contestant2_votes: 0,
            total_votes: 0,
          },
        })),
      };
      layout.push(roundData);
    });

    return layout;
  };

  const bracketLayout = getBracketLayout();
  const activeRound = bracketLayout.find(round => round.isActive);


  // Round-by-round tournament view
  const currentRoundIndex = selectedRound !== null ? selectedRound : (bracketLayout.findIndex(r => r.isActive) || 0);
  const currentRound = bracketLayout[currentRoundIndex];
  const hasRoundVoting = showVotingInterface && currentRound?.isActive && canVote;

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
        
        {/* Round Navigation */}
        <div className="flex flex-wrap gap-3 mb-6">
          {bracketLayout.filter(round => round.status === 'completed' || round.isActive).map((round, index) => {
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
                    : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
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
                {currentRound.matchups.filter(m => m.status === 'completed').length} of {currentRound.matchups.length} matchups completed
              </p>
            </div>
            
            {/* Navigation arrows */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedRound(Math.max(0, currentRoundIndex - 1))}
                disabled={currentRoundIndex === 0}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ←
              </button>
              <button
                onClick={() => setSelectedRound(Math.min(bracketLayout.length - 1, currentRoundIndex + 1))}
                disabled={currentRoundIndex === bracketLayout.length - 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                →
              </button>
            </div>
          </div>

          {/* Matchups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(currentRound.matchups || []).map((matchup: BracketMatchup) => (
              <div key={matchup.id} className="space-y-4">
                <MatchupCard
                  matchup={matchup}
                  canVote={canVote && currentRound.isActive && matchup.status === 'active'}
                  showVotingInterface={showVotingInterface && !hasRoundVoting}
                  loading={voteLoading}
                  onSelectionChange={hasRoundVoting ? handleContestantSelect : undefined}
                  externalSelection={hasRoundVoting ? selections[matchup.id] : undefined}
                />
                
                {/* Next Round Preview - Only show if next round exists and is not pending */}
                {matchup.winner && currentRoundIndex < bracketLayout.length - 1 && 
                 bracketLayout[currentRoundIndex + 1] && 
                 (bracketLayout[currentRoundIndex + 1].status === 'completed' || bracketLayout[currentRoundIndex + 1].isActive) && (
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