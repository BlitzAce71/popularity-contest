import { useState, useEffect, useCallback } from 'react';
import { VotingService } from '@/services/voting';
import { Vote, UserVoteHistory, VoteCounts, VotingStatus } from '@/types';

export const useVoting = (matchupId: string | undefined) => {
  const [userVote, setUserVote] = useState<Vote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canVote, setCanVote] = useState(false);
  const [voteReason, setVoteReason] = useState<string | undefined>();

  // Check voting permission and fetch existing vote
  const checkVotingStatus = async () => {
    if (!matchupId) {
      setUserVote(null);
      setCanVote(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check if user can vote
      const { canVote: canVoteResult, reason } = await VotingService.canVoteInMatchup(matchupId);
      setCanVote(canVoteResult);
      setVoteReason(reason);

      // Get existing vote
      const existingVote = await VotingService.getUserVoteForMatchup(matchupId);
      setUserVote(existingVote);

      // Load saved draft if no existing vote
      if (!existingVote && canVoteResult) {
        const draft = VotingService.getVoteDraft(matchupId);
        if (draft) {
          // You could set this in a separate state for draft indication
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check voting status');
      setCanVote(false);
      setUserVote(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkVotingStatus();
  }, [matchupId]);

  // Submit vote with optimistic updates
  const submitVote = async (selectedContestantId: string): Promise<boolean> => {
    if (!matchupId || !canVote) return false;

    setSubmitting(true);
    setError(null);

    // Store original state for rollback
    const originalVote = userVote;

    try {
      const success = await VotingService.submitVote(
        matchupId,
        selectedContestantId,
        // Optimistic update
        (optimisticVote) => {
          setUserVote(optimisticVote);
        },
        // Rollback on error
        () => {
          setUserVote(originalVote);
        }
      );

      // Clear draft on successful vote
      VotingService.clearVoteDraft(matchupId);
      
      // Refresh to get the actual vote data
      await checkVotingStatus();
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // Save vote draft for auto-save functionality
  const saveDraft = useCallback((selectedContestantId: string) => {
    if (matchupId && canVote && !userVote) {
      VotingService.saveVoteDraft(matchupId, selectedContestantId);
    }
  }, [matchupId, canVote, userVote]);

  // Delete vote (if allowed)
  const deleteVote = async (): Promise<boolean> => {
    if (!matchupId || !userVote) return false;

    try {
      setSubmitting(true);
      setError(null);

      await VotingService.deleteVote(matchupId);
      setUserVote(null);
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete vote');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const refresh = () => {
    checkVotingStatus();
  };

  return {
    userVote,
    loading,
    submitting,
    error,
    canVote,
    voteReason,
    submitVote,
    deleteVote,
    saveDraft,
    refresh,
  };
};

export const useMatchupResults = (matchupId: string | undefined) => {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = async () => {
    if (!matchupId) {
      setResults(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await VotingService.getMatchupResults(matchupId);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch results');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [matchupId]);

  const refresh = () => {
    fetchResults();
  };

  return {
    results,
    loading,
    error,
    refresh,
  };
};

export const useVotingStatus = (tournamentId: string | undefined) => {
  const [status, setStatus] = useState({
    totalMatchups: 0,
    votedMatchups: 0,
    availableMatchups: 0,
    completionPercentage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!tournamentId) {
      setStatus({
        totalMatchups: 0,
        votedMatchups: 0,
        availableMatchups: 0,
        completionPercentage: 0,
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await VotingService.getVotingStatus(tournamentId);
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch voting status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [tournamentId]);

  const refresh = () => {
    fetchStatus();
  };

  return {
    status,
    loading,
    error,
    refresh,
  };
};

export const useVoteHistory = (page: number = 1, pageSize: number = 20) => {
  const [history, setHistory] = useState<UserVoteHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, total: totalCount } = await VotingService.getUserVoteHistory(page, pageSize);
      setHistory(data);
      setTotal(totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vote history');
      setHistory([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page, pageSize]);

  const refresh = () => {
    fetchHistory();
  };

  return {
    history,
    total,
    loading,
    error,
    refresh,
  };
};

export const useLiveVoteCounts = (tournamentId: string | undefined) => {
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVoteCounts = async () => {
    if (!tournamentId) {
      setVoteCounts({});
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await VotingService.getLiveVoteCounts(tournamentId);
      setVoteCounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vote counts');
      setVoteCounts({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVoteCounts();
  }, [tournamentId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!tournamentId) return;

    const unsubscribe = VotingService.subscribeToVoteUpdates(tournamentId, () => {
      fetchVoteCounts(); // Refetch on updates
    });

    return unsubscribe;
  }, [tournamentId]);

  const refresh = () => {
    fetchVoteCounts();
  };

  return {
    voteCounts,
    loading,
    error,
    refresh,
  };
};

export const useBatchVoting = () => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Vote[]>([]);

  const submitBatchVotes = async (
    votes: { matchupId: string; selectedContestantId: string; weight?: number }[]
  ): Promise<boolean> => {
    try {
      setSubmitting(true);
      setError(null);

      const votesData = await VotingService.submitBatchVotes(votes);
      setResults(votesData);
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit batch votes');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setResults([]);
    setError(null);
  };

  return {
    submitting,
    error,
    results,
    submitBatchVotes,
    reset,
  };
};