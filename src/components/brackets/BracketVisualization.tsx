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

const RoundVotingInterface: React.FC<RoundVotingInterfaceProps> = ({ round, onVotesSubmitted }) => {
  const [selections, setSelections] = useState<Record<string, string>>({});
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

  const handleContestantSelect = (matchupId: string, contestantId: string) => {
    setSelections(prev => ({
      ...prev,
      [matchupId]: contestantId
    }));
  };

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
      <h4 className="text-lg font-semibold text-gray-900 mb-4">Make Your Selections</h4>
      
      {/* Matchup selection list */}
      <div className="space-y-4 mb-6">
        {round.matchups.map((matchup) => (
          <div key={matchup.id} className="bg-gray-50 rounded-lg p-4">
            <h5 className="font-medium text-gray-900 mb-3">
              {matchup.contestant1?.name} vs {matchup.contestant2?.name}
            </h5>
            <div className="flex gap-3">
              <button
                onClick={() => handleContestantSelect(matchup.id, matchup.contestant1?.id || '')}
                className={`flex-1 p-3 rounded-lg border transition-colors ${
                  selections[matchup.id] === matchup.contestant1?.id
                    ? 'bg-primary-100 border-primary-500 text-primary-700'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                {matchup.contestant1?.name}
              </button>
              <button
                onClick={() => handleContestantSelect(matchup.id, matchup.contestant2?.id || '')}
                className={`flex-1 p-3 rounded-lg border transition-colors ${
                  selections[matchup.id] === matchup.contestant2?.id
                    ? 'bg-primary-100 border-primary-500 text-primary-700'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                {matchup.contestant2?.name}
              </button>
            </div>
          </div>
        ))}
      </div>

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

  if (!bracketData || !bracketData.rounds || bracketData.rounds.length === 0) {
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

  const rounds = bracketData.rounds || [];
  const matchups = bracketData.matchups || [];
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
          voteCounts: {
            contestant1Votes: matchup.contestant1_votes || 0,
            contestant2Votes: matchup.contestant2_votes || 0,
            totalVotes: matchup.total_votes || 0,
          },
          vote_counts: voteCounts[matchup.id] || {
            contestant1_votes: matchup.contestant1_votes || 0,
            contestant2_votes: matchup.contestant2_votes || 0,
            total_votes: matchup.total_votes || 0,
          },
        })),
      };
      layout.push(roundData);
    });

    return layout;
  };

  const bracketLayout = getBracketLayout();
  const activeRound = bracketLayout.find(round => round.isActive);

  // Mobile view: show rounds in tabs
  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Round selector */}
        <div className="flex overflow-x-auto gap-2 pb-2">
          {bracketLayout.map((round, index) => (
            <button
              key={round.id}
              onClick={() => setSelectedRound(index)}
              className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg border ${
                selectedRound === index || (selectedRound === null && round.isActive)
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {round.name}
            </button>
          ))}
        </div>

        {/* Selected round matchups */}
        {(() => {
          const displayRound = selectedRound !== null 
            ? bracketLayout[selectedRound] 
            : activeRound || bracketLayout[0];
          
          if (!displayRound) return null;

          return (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {displayRound.name}
                  {displayRound.isActive && (
                    <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      Active
                    </span>
                  )}
                </h3>
                <div className="space-y-4">
                  {(displayRound.matchups || []).map((matchup: BracketMatchup) => (
                    <MatchupCard
                      key={matchup.id}
                      matchup={matchup}
                      canVote={false}
                      showVotingInterface={false}
                      loading={voteLoading}
                    />
                  ))}
                </div>
                
                {showVotingInterface && displayRound.isActive && canVote && (
                  <RoundVotingInterface 
                    round={displayRound}
                    onVotesSubmitted={() => {
                      window.location.reload();
                    }}
                  />
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // Desktop view: full bracket visualization
  return (
    <div className={`${className}`}>
      <div className="overflow-x-auto">
        <div className="min-w-max flex gap-8 p-6">
          {bracketLayout.map((round, roundIndex) => (
            <div key={round.id} className="flex flex-col min-w-[300px]">
              {/* Round header */}
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {round.name}
                </h3>
                {round.isActive && (
                  <span className="inline-block mt-1 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                    Active Round
                  </span>
                )}
                <div className="text-sm text-gray-500 mt-1">
                  {round.matchups.filter(m => m.status === 'completed').length}/{round.matchups.length} completed
                </div>
              </div>

              {/* Matchups */}
              <div className="flex flex-col justify-center space-y-8 flex-1">
                {(round.matchups || []).map((matchup: BracketMatchup, matchupIndex: number) => {
                  // Calculate vertical spacing for bracket layout
                  const spacing = Math.pow(2, roundIndex) * 60;
                  const topMargin = matchupIndex > 0 ? spacing : 0;

                  return (
                    <div
                      key={matchup.id}
                      style={{ marginTop: topMargin }}
                      className="relative"
                    >
                      <MatchupCard
                        matchup={matchup}
                        canVote={canVote && round.isActive && matchup.status === 'active'}
                        showVotingInterface={showVotingInterface}
                        loading={voteLoading}
                        compact={totalRounds > 3}
                      />

                      {/* Connector lines for next round */}
                      {roundIndex < bracketLayout.length - 1 && (
                        <div className="absolute top-1/2 -right-8 w-8 transform -translate-y-1/2">
                          {/* Horizontal line */}
                          <div className="w-full h-0.5 bg-gray-300"></div>
                          
                          {/* Vertical connector */}
                          <div className="absolute right-0 top-0 w-0.5 bg-gray-300" style={{
                            height: matchupIndex % 2 === 0 ? (spacing / 2 + 16) + 'px' : (spacing / 2 + 16) + 'px',
                            transform: matchupIndex % 2 === 0 ? 'translateY(-50%)' : 'translateY(-50%)'
                          }}></div>
                          
                          {/* Connect pairs of matchups */}
                          {matchupIndex % 2 === 1 && (
                            <div className="absolute right-0 bg-gray-300 w-0.5" style={{
                              height: spacing + 32 + 'px',
                              top: -(spacing / 2 + 16) + 'px'
                            }}></div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Final winner display */}
          {bracketLayout.length > 0 && (
            <div className="flex flex-col justify-center min-w-[240px] pl-8">
              {/* Connector line from final round */}
              <div className="absolute top-1/2 -left-8 w-8 h-0.5 bg-gray-300 transform -translate-y-1/2"></div>
              
              <div className="text-center bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
                <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-gray-900 mb-4">Championship</h3>
                
                {(() => {
                  const finalRound = bracketLayout[bracketLayout.length - 1];
                  const finalMatchup = finalRound.matchups[0];
                  const winner = finalMatchup?.winner;
                  
                  if (winner) {
                    return (
                      <div className="space-y-3">
                        {winner.image_url && (
                          <img
                            src={winner.image_url}
                            alt={winner.name}
                            className="w-16 h-16 object-cover rounded-full mx-auto border-2 border-yellow-300"
                          />
                        )}
                        <div>
                          <div className="font-bold text-lg text-yellow-800">{winner.name}</div>
                          <div className="text-sm text-yellow-600 font-medium">
                            🏆 Tournament Winner
                          </div>
                        </div>
                      </div>
                    );
                  } else if (finalRound.status === 'completed') {
                    return (
                      <div className="text-gray-600">
                        <div className="text-sm">Tournament Complete</div>
                        <div className="text-xs mt-1">Winner will appear here</div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-gray-500">
                        <div className="text-sm">Final Match</div>
                        <div className="text-xs mt-1">
                          {finalRound.status === 'active' ? 'Currently voting' : 'Coming soon'}
                        </div>
                      </div>
                    );
                  }
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
            <span>Active voting</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
            <span>Upcoming</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></div>
            <span>Completed</span>
          </div>
          {showVotingInterface && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-600" />
              <span>Click to vote</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BracketVisualization;