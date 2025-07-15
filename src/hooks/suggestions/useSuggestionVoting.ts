import { useState, useEffect, useCallback } from 'react';
import { SuggestionService } from '@/services/suggestions';

export const useSuggestionVoting = (tournamentId: string) => {
  const [userVotes, setUserVotes] = useState<Record<string, boolean>>({});
  const [votingLoading, setVotingLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load user's vote status for all suggestions in the tournament
  const loadUserVoteStatus = useCallback(async () => {
    if (!tournamentId) return;
    
    try {
      const voteStatus = await SuggestionService.getUserVoteStatus(tournamentId);
      setUserVotes(voteStatus);
    } catch (err) {
      console.error('Error loading user vote status:', err);
      // Don't set error state for this - it's not critical
    }
  }, [tournamentId]);

  // Toggle vote for a suggestion with optimistic updates
  const toggleVote = async (
    suggestionId: string,
    onVoteCountChange?: (suggestionId: string, newCount: number) => void
  ): Promise<boolean> => {
    if (votingLoading === suggestionId) {
      return false; // Prevent double-clicking
    }

    const currentVote = userVotes[suggestionId] || false;
    const optimisticVotes = { ...userVotes, [suggestionId]: !currentVote };
    
    // Apply optimistic update
    setUserVotes(optimisticVotes);
    setVotingLoading(suggestionId);
    setError(null);
    
    try {
      let result;
      if (currentVote) {
        // Remove vote
        result = await SuggestionService.removeVote(suggestionId);
      } else {
        // Add vote
        result = await SuggestionService.voteOnSuggestion(suggestionId);
      }

      if (result.success && onVoteCountChange) {
        onVoteCountChange(suggestionId, result.newVoteCount);
      }

      return true;
    } catch (err) {
      // Rollback optimistic update on error
      setUserVotes(userVotes);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update vote';
      setError(errorMessage);
      return false;
    } finally {
      setVotingLoading(null);
    }
  };

  // Vote on a suggestion (without toggling - for new votes only)
  const voteOnSuggestion = async (
    suggestionId: string,
    onVoteCountChange?: (suggestionId: string, newCount: number) => void
  ): Promise<boolean> => {
    if (votingLoading === suggestionId || userVotes[suggestionId]) {
      return false; // Already voting or already voted
    }

    const optimisticVotes = { ...userVotes, [suggestionId]: true };
    
    // Apply optimistic update
    setUserVotes(optimisticVotes);
    setVotingLoading(suggestionId);
    setError(null);
    
    try {
      const result = await SuggestionService.voteOnSuggestion(suggestionId);

      if (result.success && onVoteCountChange) {
        onVoteCountChange(suggestionId, result.newVoteCount);
      }

      return true;
    } catch (err) {
      // Rollback optimistic update on error
      setUserVotes(userVotes);
      const errorMessage = err instanceof Error ? err.message : 'Failed to vote';
      setError(errorMessage);
      return false;
    } finally {
      setVotingLoading(null);
    }
  };

  // Remove vote from a suggestion
  const removeVote = async (
    suggestionId: string,
    onVoteCountChange?: (suggestionId: string, newCount: number) => void
  ): Promise<boolean> => {
    if (votingLoading === suggestionId || !userVotes[suggestionId]) {
      return false; // Already processing or no vote to remove
    }

    const optimisticVotes = { ...userVotes, [suggestionId]: false };
    
    // Apply optimistic update
    setUserVotes(optimisticVotes);
    setVotingLoading(suggestionId);
    setError(null);
    
    try {
      const result = await SuggestionService.removeVote(suggestionId);

      if (result.success && onVoteCountChange) {
        onVoteCountChange(suggestionId, result.newVoteCount);
      }

      return true;
    } catch (err) {
      // Rollback optimistic update on error
      setUserVotes(userVotes);
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove vote';
      setError(errorMessage);
      return false;
    } finally {
      setVotingLoading(null);
    }
  };

  // Check if user has voted on a specific suggestion
  const hasUserVoted = useCallback((suggestionId: string): boolean => {
    return userVotes[suggestionId] || false;
  }, [userVotes]);

  // Check if voting is in progress for a suggestion
  const isVotingInProgress = useCallback((suggestionId: string): boolean => {
    return votingLoading === suggestionId;
  }, [votingLoading]);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Update vote status for a specific suggestion (for external updates)
  const updateVoteStatus = useCallback((suggestionId: string, hasVoted: boolean) => {
    setUserVotes(prev => ({ ...prev, [suggestionId]: hasVoted }));
  }, []);

  // Load initial vote status
  useEffect(() => {
    loadUserVoteStatus();
  }, [loadUserVoteStatus]);

  return {
    userVotes,
    votingLoading,
    error,
    toggleVote,
    voteOnSuggestion,
    removeVote,
    hasUserVoted,
    isVotingInProgress,
    updateVoteStatus,
    loadUserVoteStatus,
    clearError,
  };
};