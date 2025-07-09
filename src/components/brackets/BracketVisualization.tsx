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

  // Mobile/tablet view: scrollable bracket with better structure
  const isMobile = window.innerWidth < 1024;

  if (isMobile) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Bracket navigation */}
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
          {bracketLayout.map((round, index) => (
            <button
              key={round.id}
              onClick={() => setSelectedRound(index)}
              className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                selectedRound === index || (selectedRound === null && round.isActive)
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {round.name}
              {round.isActive && (
                <span className="ml-1 w-2 h-2 bg-green-400 rounded-full inline-block"></span>
              )}
            </button>
          ))}
        </div>

        {/* Mobile bracket view */}
        <div className="overflow-x-auto bg-gray-50 rounded-lg p-4">
          <div className="min-w-max flex gap-8">
            {bracketLayout.map((round, roundIndex) => {
              const isSelectedRound = selectedRound === roundIndex || (selectedRound === null && round.isActive);
              const shouldShow = selectedRound !== null ? isSelectedRound : roundIndex <= (bracketLayout.findIndex(r => r.isActive) || 0);
              
              if (!shouldShow) return null;
              
              const roundMatchups = round.matchups || [];
              const hasRoundVoting = showVotingInterface && round.isActive && canVote;
              
              return (
                <div key={round.id} className={`flex flex-col min-w-[280px] ${
                  isSelectedRound ? 'opacity-100' : 'opacity-60'
                }`}>
                  {/* Round header */}
                  <div className="text-center mb-6">
                    <h3 className={`text-lg font-bold mb-2 ${
                      round.isActive ? 'text-green-700' : 
                      round.status === 'completed' ? 'text-gray-700' : 'text-gray-500'
                    }`}>
                      {round.name}
                    </h3>
                    {round.isActive && (
                      <span className="inline-block px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full border border-green-200 font-medium">
                        Active Round
                      </span>
                    )}
                    {round.status === 'completed' && (
                      <span className="inline-block px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full border border-gray-200 font-medium">
                        Completed
                      </span>
                    )}
                    {round.status === 'pending' && (
                      <span className="inline-block px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-full border border-blue-200 font-medium">
                        Upcoming
                      </span>
                    )}
                    <div className="text-sm text-gray-500 mt-2">
                      {round.matchups.filter(m => m.status === 'completed').length}/{round.matchups.length} completed
                    </div>
                  </div>

                  {/* Matchups */}
                  <div className="space-y-4 flex-1">
                    {roundMatchups.map((matchup: BracketMatchup, matchupIndex: number) => (
                      <div key={matchup.id} className="relative">
                        <MatchupCard
                          matchup={matchup}
                          canVote={canVote && round.isActive && matchup.status === 'active'}
                          showVotingInterface={showVotingInterface && !hasRoundVoting}
                          loading={voteLoading}
                          onSelectionChange={hasRoundVoting ? handleContestantSelect : undefined}
                          externalSelection={hasRoundVoting ? selections[matchup.id] : undefined}
                        />
                        
                        {/* Simple connector line for mobile */}
                        {roundIndex < bracketLayout.length - 1 && matchupIndex % 2 === 0 && (
                          <div className="absolute top-1/2 -right-4 w-4 h-0.5 bg-gray-300 transform -translate-y-1/2"></div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Round voting interface */}
                  {hasRoundVoting && (
                    <RoundVotingInterface 
                      round={round}
                      onVotesSubmitted={() => {
                        window.location.reload();
                      }}
                      onSelectionChange={handleContestantSelect}
                      selections={selections}
                    />
                  )}
                </div>
              );
            })}
            
            {/* Mobile championship */}
            {bracketLayout.length > 0 && (selectedRound === null || selectedRound === bracketLayout.length - 1) && (
              <div className="flex flex-col justify-center min-w-[240px]">
                <div className="text-center bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-300 rounded-lg p-6 shadow-lg">
                  <Trophy className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
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
                              className="w-16 h-16 object-cover rounded-full mx-auto border-2 border-yellow-400 shadow-md"
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
                          <div className="text-sm font-medium">Tournament Complete</div>
                          <div className="text-xs mt-1">Winner will appear here</div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-gray-500">
                          <div className="text-sm font-medium">Final Match</div>
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
      </div>
    );
  }

  // Desktop view: full bracket visualization
  return (
    <div className={`${className}`}>
      <div className="overflow-x-auto bg-gray-50 p-6 rounded-lg">
        <div className="min-w-max flex items-center" style={{ gap: '120px' }}>
          {bracketLayout.map((round, roundIndex) => {
            const roundMatchups = round.matchups || [];
            const matchupHeight = 100; // Fixed height for each matchup
            const baseSpacing = 120; // Base spacing between matchups
            const spacing = baseSpacing * Math.pow(2, roundIndex);
            
            return (
              <div key={round.id} className="flex flex-col" style={{ minWidth: '280px' }}>
                {/* Round header */}
                <div className="text-center mb-8">
                  <h3 className={`text-lg font-bold mb-2 ${
                    round.isActive ? 'text-green-700' : 
                    round.status === 'completed' ? 'text-gray-700' : 'text-gray-500'
                  }`}>
                    {round.name}
                  </h3>
                  {round.isActive && (
                    <span className="inline-block px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full border border-green-200 font-medium">
                      Active Round
                    </span>
                  )}
                  {round.status === 'completed' && (
                    <span className="inline-block px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full border border-gray-200 font-medium">
                      Completed
                    </span>
                  )}
                  {round.status === 'pending' && (
                    <span className="inline-block px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-full border border-blue-200 font-medium">
                      Upcoming
                    </span>
                  )}
                  <div className="text-sm text-gray-500 mt-2">
                    {round.matchups.filter(m => m.status === 'completed').length}/{round.matchups.length} completed
                  </div>
                </div>

                {/* Matchups container */}
                <div className="flex flex-col justify-center flex-1 relative">
                  {roundMatchups.map((matchup: BracketMatchup, matchupIndex: number) => {
                    const isFirstInPair = matchupIndex % 2 === 0;
                    const isLastInPair = matchupIndex % 2 === 1;
                    const pairIndex = Math.floor(matchupIndex / 2);
                    
                    // Calculate precise vertical positioning
                    const totalHeight = (roundMatchups.length - 1) * spacing + matchupHeight;
                    const centerOffset = totalHeight / 2;
                    const matchupTop = matchupIndex * spacing - centerOffset;

                    return (
                      <div
                        key={matchup.id}
                        className="absolute w-full"
                        style={{ 
                          top: `calc(50% + ${matchupTop}px)`,
                          transform: 'translateY(-50%)'
                        }}
                      >
                        <div className="relative">
                          <MatchupCard
                            matchup={matchup}
                            canVote={canVote && round.isActive && matchup.status === 'active'}
                            showVotingInterface={showVotingInterface}
                            loading={voteLoading}
                            compact={totalRounds > 3}
                          />

                          {/* Bracket connector lines */}
                          {roundIndex < bracketLayout.length - 1 && (
                            <div className="absolute top-1/2 -right-[120px] w-[120px] transform -translate-y-1/2">
                              {/* Horizontal line from matchup */}
                              <div className="absolute top-0 left-0 w-16 h-0.5 bg-gray-400"></div>
                              
                              {/* Vertical connector for pairs */}
                              {isFirstInPair && matchupIndex + 1 < roundMatchups.length && (
                                <div className="absolute left-16 top-0 w-0.5 bg-gray-400" style={{
                                  height: `${spacing}px`,
                                  transform: 'translateY(-50%)'
                                }}></div>
                              )}
                              
                              {/* Horizontal line to next round (only for first in pair) */}
                              {isFirstInPair && (
                                <div className="absolute left-16 w-16 h-0.5 bg-gray-400" style={{
                                  top: `${spacing / 2}px`,
                                  transform: 'translateY(-50%)'
                                }}></div>
                              )}
                              
                              {/* Final connection to next round */}
                              {isFirstInPair && (
                                <div className="absolute right-0 top-0 w-8 h-0.5 bg-gray-400" style={{
                                  top: `${spacing / 2}px`,
                                  transform: 'translateY(-50%)'
                                }}></div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Championship area */}
          {bracketLayout.length > 0 && (
            <div className="flex flex-col justify-center" style={{ minWidth: '240px' }}>
              {/* Connector line from final round */}
              <div className="absolute top-1/2 -left-[120px] w-8 h-0.5 bg-gray-400 transform -translate-y-1/2"></div>
              
              <div className="text-center bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-300 rounded-lg p-6 shadow-lg">
                <Trophy className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
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
                            className="w-16 h-16 object-cover rounded-full mx-auto border-2 border-yellow-400 shadow-md"
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
                        <div className="text-sm font-medium">Tournament Complete</div>
                        <div className="text-xs mt-1">Winner will appear here</div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-gray-500">
                        <div className="text-sm font-medium">Final Match</div>
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
      <div className="mt-8 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Legend</h4>
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
            <span className="text-gray-700">Active voting</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-50 border border-blue-300 rounded"></div>
            <span className="text-gray-700">Upcoming</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></div>
            <span className="text-gray-700">Completed</span>
          </div>
          {showVotingInterface && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-600" />
              <span className="text-gray-700">Click to vote</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-gray-400"></div>
            <span className="text-gray-700">Bracket connections</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BracketVisualization;