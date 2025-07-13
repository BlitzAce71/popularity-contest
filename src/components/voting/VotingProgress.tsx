import React from 'react';
import { CheckCircle, Clock, Users, Trophy } from 'lucide-react';

interface VotingStatus {
  totalMatchups: number;
  votedMatchups: number;
  availableMatchups: number;
  completionPercentage: number;
}

interface VotingProgressProps {
  tournamentId?: string;
  votingStatus: VotingStatus;
  className?: string;
  liveSelections?: Record<string, string>;
}

const VotingProgress: React.FC<VotingProgressProps> = ({
  tournamentId,
  votingStatus,
  className = '',
  liveSelections = {},
}) => {
  const { 
    totalMatchups, 
    votedMatchups, 
    availableMatchups: rawAvailableMatchups, 
    completionPercentage: rawCompletionPercentage 
  } = votingStatus;
  
  // Calculate live progress including current selections
  const liveSelectionCount = Object.keys(liveSelections).length;
  const liveVotedMatchups = votedMatchups + liveSelectionCount;
  const liveCompletionPercentage = totalMatchups > 0 ? (liveVotedMatchups / totalMatchups) * 100 : 0;
  
  // Additional safeguards to prevent negative values and cap percentages
  const availableMatchups = Math.max(0, rawAvailableMatchups - liveSelectionCount);
  const completionPercentage = Math.min(100, Math.max(0, liveCompletionPercentage));

  if (totalMatchups === 0) {
    return null;
  }

  const getProgressColor = () => {
    if (completionPercentage === 100) return 'bg-green-500';
    if (completionPercentage >= 50) return 'bg-blue-500';
    return 'bg-primary-500';
  };

  const getStatusMessage = () => {
    if (availableMatchups === 0 && liveVotedMatchups === totalMatchups) {
      return "You've voted in all available matchups! 🎉";
    }
    if (availableMatchups === 0) {
      return liveSelectionCount > 0 
        ? `${liveSelectionCount} selection${liveSelectionCount !== 1 ? 's' : ''} ready to submit!`
        : "No matchups available for voting right now.";
    }
    if (liveVotedMatchups === 0) {
      return `${availableMatchups} matchup${availableMatchups !== 1 ? 's' : ''} available for voting.`;
    }
    return `${availableMatchups} more matchup${availableMatchups !== 1 ? 's' : ''} to vote on.`;
  };

  const getStatusIcon = () => {
    if (availableMatchups === 0 && votedMatchups === totalMatchups) {
      return <Trophy className="w-5 h-5 text-green-600" />;
    }
    if (availableMatchups === 0) {
      return <Clock className="w-5 h-5 text-gray-600" />;
    }
    return <Users className="w-5 h-5 text-primary-600" />;
  };

  return (
    <div className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h3 className="font-medium text-gray-900">Your Voting Progress</h3>
            <p className="text-sm text-gray-600">{getStatusMessage()}</p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-lg font-semibold text-gray-900">
            {liveVotedMatchups}/{totalMatchups}
          </div>
          <div className="text-sm text-gray-600">matchups</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Progress</span>
          <span>{Math.round(completionPercentage)}%</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>{votedMatchups} voted</span>
          </div>
          
          {liveSelectionCount > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-orange-600" />
              <span>{liveSelectionCount} selected</span>
            </div>
          )}
          
          {availableMatchups > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>{availableMatchups} pending</span>
            </div>
          )}
        </div>

        {availableMatchups > 0 && (
          <div className="text-sm">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
              Action needed
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default VotingProgress;