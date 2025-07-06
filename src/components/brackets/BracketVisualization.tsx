import React, { useState } from 'react';
import { useBracketData } from '@/hooks/tournaments/useTournament';
import { useLiveVoteCounts } from '@/hooks/voting/useVoting';
import type { BracketRound, BracketMatchup } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import MatchupCard from './MatchupCard';
import { Trophy, Users } from 'lucide-react';

interface BracketVisualizationProps {
  tournamentId: string;
  canVote?: boolean;
  showVotingInterface?: boolean;
  className?: string;
}

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

  const rounds = bracketData.rounds;
  const totalRounds = rounds.length;

  // Calculate bracket layout
  const getBracketLayout = (): BracketRound[] => {
    const layout: BracketRound[] = [];
    
    rounds.forEach((round: BracketRound) => {
      const roundData = {
        ...round,
        isActive: round.status === 'active',
        matchups: round.matchups.map((matchup: BracketMatchup) => ({
          ...matchup,
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
        <div className="space-y-4">
          {(() => {
            const displayRound = selectedRound !== null 
              ? bracketLayout[selectedRound] 
              : activeRound || bracketLayout[0];
            
            if (!displayRound) return null;

            return (
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
                  {displayRound.matchups.map((matchup: BracketMatchup) => (
                    <MatchupCard
                      key={matchup.id}
                      matchup={matchup}
                      canVote={canVote && displayRound.isActive && matchup.status === 'active'}
                      showVotingInterface={showVotingInterface}
                      loading={voteLoading}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
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
                  {round.completed_matchups}/{round.total_matchups} completed
                </div>
              </div>

              {/* Matchups */}
              <div className="flex flex-col justify-center space-y-8 flex-1">
                {round.matchups.map((matchup: BracketMatchup, matchupIndex: number) => {
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
                        <div className="absolute top-1/2 -right-8 w-8 h-px bg-gray-300 transform -translate-y-1/2">
                          <div className="absolute right-0 top-0 w-px h-8 bg-gray-300 transform -translate-y-1/2"></div>
                          {matchupIndex % 2 === 1 && (
                            <div className="absolute right-0 top-0 w-px bg-gray-300 transform -translate-y-1/2"
                                 style={{ height: spacing + 32 }}></div>
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
          {bracketLayout.length > 0 && bracketLayout[bracketLayout.length - 1].status === 'completed' && (
            <div className="flex flex-col justify-center min-w-[200px]">
              <div className="text-center">
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900">Champion</h3>
                {(() => {
                  const finalRound = bracketLayout[bracketLayout.length - 1];
                  const finalMatchup = finalRound.matchups[0];
                  const winner = finalMatchup?.winner;
                  
                  if (winner) {
                    return (
                      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        {winner.image_url && (
                          <img
                            src={winner.image_url}
                            alt={winner.name}
                            className="w-16 h-16 object-cover rounded-full mx-auto mb-2"
                          />
                        )}
                        <div className="font-semibold text-lg">{winner.name}</div>
                        <div className="text-sm text-gray-600">
                          Tournament Winner
                        </div>
                      </div>
                    );
                  }
                  
                  return null;
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