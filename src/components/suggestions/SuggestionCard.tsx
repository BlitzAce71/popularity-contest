import React from 'react';
import VoteButton from './VoteButton';
import { Image, Clock, User, CheckCircle, XCircle, Copy } from 'lucide-react';
import type { SuggestionWithVoteStatus } from '@/types';

interface SuggestionCardProps {
  suggestion: SuggestionWithVoteStatus;
  onVote: (suggestionId: string) => Promise<void>;
  isVotingLoading: boolean;
  canVote?: boolean;
  showAdminStatus?: boolean;
  className?: string;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onVote,
  isVotingLoading,
  canVote = true,
  showAdminStatus = false,
  className = '',
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'duplicate':
        return <Copy className="w-4 h-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'duplicate':
        return 'Duplicate';
      default:
        return 'Pending';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'rejected':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'duplicate':
        return 'text-orange-700 bg-orange-50 border-orange-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return diffInMinutes <= 1 ? 'just now' : `${diffInMinutes}m ago`;
    }
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200 ${className}`}>
      <div className="flex items-start gap-4">
        {/* Image */}
        <div className="flex-shrink-0">
          {suggestion.image_url ? (
            <img
              src={suggestion.image_url}
              alt={suggestion.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border border-gray-200"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center ${suggestion.image_url ? 'hidden' : ''}`}>
            <Image className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 break-words leading-tight">
                {suggestion.name}
              </h3>
              {suggestion.description && (
                <p className="text-sm text-gray-600 mt-1 break-words leading-relaxed">
                  {suggestion.description}
                </p>
              )}
            </div>

            {/* Admin Status Badge */}
            {showAdminStatus && suggestion.status !== 'pending' && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(suggestion.status)}`}>
                {getStatusIcon(suggestion.status)}
                <span>{getStatusLabel(suggestion.status)}</span>
              </div>
            )}
          </div>

          {/* Meta Information */}
          <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>by @{suggestion.suggested_by_user.username}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatTimeAgo(suggestion.created_at)}</span>
            </div>
            {suggestion.duplicate_count && suggestion.duplicate_count > 0 && (
              <div className="flex items-center gap-1 text-orange-600">
                <Copy className="w-3 h-3" />
                <span>{suggestion.duplicate_count} similar</span>
              </div>
            )}
          </div>

          {/* Vote Button */}
          <div className="flex items-center justify-between">
            <div className="flex-1" />
            <VoteButton
              suggestionId={suggestion.id}
              voteCount={suggestion.vote_count}
              hasVoted={suggestion.user_has_voted}
              isLoading={isVotingLoading}
              onVote={onVote}
              disabled={!canVote}
              size="md"
            />
          </div>

          {/* Admin Notes (if present and showAdminStatus is true) */}
          {showAdminStatus && suggestion.admin_notes && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
              <span className="font-medium text-yellow-800">Admin note:</span>
              <span className="text-yellow-700 ml-1">{suggestion.admin_notes}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuggestionCard;