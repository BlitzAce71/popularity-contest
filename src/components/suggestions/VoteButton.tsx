import React from 'react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ThumbsUp, Check } from 'lucide-react';

interface VoteButtonProps {
  suggestionId: string;
  voteCount: number;
  hasVoted: boolean;
  isLoading: boolean;
  onVote: (suggestionId: string) => Promise<void>;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const VoteButton: React.FC<VoteButtonProps> = ({
  suggestionId,
  voteCount,
  hasVoted,
  isLoading,
  onVote,
  disabled = false,
  size = 'md',
  className = '',
}) => {
  const handleClick = async () => {
    if (disabled || isLoading) return;
    await onVote(suggestionId);
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <Button
      variant={hasVoted ? 'default' : 'outline'}
      size={size}
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`
        flex items-center gap-2 font-medium transition-all duration-200
        ${hasVoted 
          ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
          : 'text-blue-600 border-blue-600 hover:bg-blue-50'
        }
        ${isLoading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}
        ${className}
      `}
      title={hasVoted ? 'Click to remove your vote' : 'Click to vote for this suggestion'}
    >
      {isLoading ? (
        <LoadingSpinner size="sm" />
      ) : hasVoted ? (
        <Check className={iconSize[size]} />
      ) : (
        <ThumbsUp className={iconSize[size]} />
      )}
      
      <span className="font-semibold">
        {voteCount}
      </span>
      
      {size !== 'sm' && (
        <span className="hidden sm:inline">
          {hasVoted ? 'Voted' : 'Vote'}
        </span>
      )}
    </Button>
  );
};

export default VoteButton;