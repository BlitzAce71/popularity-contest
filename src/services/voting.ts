import { supabase } from '@/lib/supabase';
import type { Vote, UserVoteHistory } from '@/types';

export class VotingService {
  // Submit a vote with optimistic updates and rollback capability
  static async submitVote(
    matchupId: string,
    selectedContestantId: string,
    onOptimisticUpdate?: (vote: Vote) => void,
    onRollback?: () => void
  ): Promise<Vote> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      // Create optimistic vote object
      const optimisticVote: Vote = {
        id: `temp-${Date.now()}`,
        user_id: user.user.id,
        matchup_id: matchupId,
        selected_contestant_id: selectedContestantId,
        is_admin_vote: false,
        weight: 1,
        created_at: new Date().toISOString(),
      };

      // Apply optimistic update
      if (onOptimisticUpdate) {
        onOptimisticUpdate(optimisticVote);
      }

      // Submit vote to database
      const { data, error } = await supabase
        .from('votes')
        .upsert([
          {
            user_id: user.user.id,
            matchup_id: matchupId,
            selected_contestant_id: selectedContestantId,
          },
        ])
        .select()
        .single();

      if (error) {
        // Rollback optimistic update
        if (onRollback) {
          onRollback();
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error submitting vote:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to submit vote');
    }
  }

  // Get user's vote for a specific matchup
  static async getUserVoteForMatchup(matchupId: string): Promise<Vote | null> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;

      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('matchup_id', matchupId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user vote:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch user vote');
    }
  }

  // Get all user votes for a tournament
  static async getUserVotesForTournament(tournamentId: string): Promise<Vote[]> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];

      const { data, error } = await supabase
        .from('votes')
        .select(`
          *,
          matchups!inner(tournament_id)
        `)
        .eq('user_id', user.user.id)
        .eq('matchups.tournament_id', tournamentId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user tournament votes:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch user votes');
    }
  }

  // Get user's voting history with tournament context
  static async getUserVoteHistory(
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ data: UserVoteHistory[]; total: number }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return { data: [], total: 0 };

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('votes')
        .select(`
          *,
          matchups!inner(
            id,
            position,
            status,
            tournaments!inner(id, name)
          ),
          contestants!selected_contestant_id(id, name)
        `, { count: 'exact' })
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const voteHistory: UserVoteHistory[] = (data || []).map((vote) => ({
        matchId: vote.matchup_id,
        contestantId: vote.selected_contestant_id,
        tournamentTitle: vote.matchups.tournaments.name,
        votedAt: vote.created_at,
      }));

      return {
        data: voteHistory,
        total: count || 0,
      };
    } catch (error) {
      console.error('Error fetching vote history:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch vote history');
    }
  }

  // Get voting status for user in a tournament
  static async getVotingStatus(tournamentId: string): Promise<{
    totalMatchups: number;
    votedMatchups: number;
    availableMatchups: number;
    completionPercentage: number;
  }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return {
          totalMatchups: 0,
          votedMatchups: 0,
          availableMatchups: 0,
          completionPercentage: 0,
        };
      }

      // Get all active matchups in tournament
      const { data: activeMatchups, error: matchupsError } = await supabase
        .from('matchups')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('status', 'active');

      if (matchupsError) throw matchupsError;

      const totalMatchups = activeMatchups?.length || 0;

      if (totalMatchups === 0) {
        return {
          totalMatchups: 0,
          votedMatchups: 0,
          availableMatchups: 0,
          completionPercentage: 0,
        };
      }

      // Get user's votes for these matchups
      const matchupIds = activeMatchups.map((m) => m.id);
      const { data: userVotes, error: votesError } = await supabase
        .from('votes')
        .select('matchup_id')
        .eq('user_id', user.user.id)
        .in('matchup_id', matchupIds);

      if (votesError) throw votesError;

      const votedMatchups = userVotes?.length || 0;
      const availableMatchups = totalMatchups - votedMatchups;
      const completionPercentage = totalMatchups > 0 ? (votedMatchups / totalMatchups) * 100 : 0;

      return {
        totalMatchups,
        votedMatchups,
        availableMatchups,
        completionPercentage,
      };
    } catch (error) {
      console.error('Error fetching voting status:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch voting status');
    }
  }

  // Delete user's vote (if allowed)
  static async deleteVote(matchupId: string): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      // Check if matchup is still active
      const { data: matchup } = await supabase
        .from('matchups')
        .select('status')
        .eq('id', matchupId)
        .single();

      if (matchup?.status !== 'active') {
        throw new Error('Cannot delete vote for completed matchup');
      }

      const { error } = await supabase
        .from('votes')
        .delete()
        .eq('user_id', user.user.id)
        .eq('matchup_id', matchupId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting vote:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete vote');
    }
  }

  // Get vote results for a matchup
  static async getMatchupResults(matchupId: string): Promise<{
    matchupId: string;
    contestant1Votes: number;
    contestant2Votes: number;
    totalVotes: number;
    winnerId?: string;
    isTie: boolean;
    userVote?: string;
  }> {
    try {
      const { data: user } = await supabase.auth.getUser();

      // Get vote results
      const { data: results, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('matchup_id', matchupId)
        .single();

      if (resultsError) throw resultsError;

      // Get user's vote if authenticated
      let userVote: string | undefined;
      if (user.user) {
        const { data: vote } = await supabase
          .from('votes')
          .select('selected_contestant_id')
          .eq('user_id', user.user.id)
          .eq('matchup_id', matchupId)
          .maybeSingle();

        userVote = vote?.selected_contestant_id;
      }

      return {
        matchupId,
        contestant1Votes: results?.contestant1_votes || 0,
        contestant2Votes: results?.contestant2_votes || 0,
        totalVotes: results?.total_votes || 0,
        winnerId: results?.winner_id,
        isTie: results?.is_tie || false,
        userVote,
      };
    } catch (error) {
      console.error('Error fetching matchup results:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch matchup results');
    }
  }

  // Get live vote counts for active matchups in a tournament
  static async getLiveVoteCounts(tournamentId: string): Promise<Record<string, {
    contestant1Votes: number;
    contestant2Votes: number;
    totalVotes: number;
  }>> {
    try {
      const { data, error } = await supabase
        .from('results')
        .select(`
          matchup_id,
          contestant1_votes,
          contestant2_votes,
          total_votes,
          matchups!inner(tournament_id, status)
        `)
        .eq('matchups.tournament_id', tournamentId)
        .eq('matchups.status', 'active');

      if (error) throw error;

      const voteCounts: Record<string, any> = {};
      (data || []).forEach((result) => {
        voteCounts[result.matchup_id] = {
          contestant1Votes: result.contestant1_votes,
          contestant2Votes: result.contestant2_votes,
          totalVotes: result.total_votes,
        };
      });

      return voteCounts;
    } catch (error) {
      console.error('Error fetching live vote counts:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch live vote counts');
    }
  }

  // Subscribe to real-time vote updates for a tournament
  static subscribeToVoteUpdates(
    tournamentId: string,
    callback: (payload: any) => void
  ): () => void {
    const subscription = supabase
      .channel(`votes-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'results',
        },
        (payload) => {
          // Filter for this tournament's matchups
          callback(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
        },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }

  // Batch vote submission (for admin or special cases)
  static async submitBatchVotes(
    votes: { matchupId: string; selectedContestantId: string; weight?: number }[]
  ): Promise<Vote[]> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const voteData = votes.map((vote) => ({
        user_id: user.user.id,
        matchup_id: vote.matchupId,
        selected_contestant_id: vote.selectedContestantId,
        weight: vote.weight || 1,
      }));

      const { data, error } = await supabase
        .from('votes')
        .upsert(voteData)
        .select();

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error submitting batch votes:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to submit batch votes');
    }
  }

  // Check if user can vote in matchup
  static async canVoteInMatchup(matchupId: string): Promise<{
    canVote: boolean;
    reason?: string;
  }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return { canVote: false, reason: 'User not authenticated' };
      }

      // Check matchup status and timing
      const { data: matchup, error } = await supabase
        .from('matchups')
        .select('status, start_date, end_date')
        .eq('id', matchupId)
        .single();

      if (error) throw error;

      if (matchup.status !== 'active') {
        return { canVote: false, reason: 'Matchup is not currently active' };
      }

      const now = new Date();
      if (matchup.start_date && new Date(matchup.start_date) > now) {
        return { canVote: false, reason: 'Voting has not started yet' };
      }

      if (matchup.end_date && new Date(matchup.end_date) < now) {
        return { canVote: false, reason: 'Voting has ended' };
      }

      return { canVote: true };
    } catch (error) {
      console.error('Error checking vote permission:', error);
      return { canVote: false, reason: 'Error checking voting permission' };
    }
  }

  // Auto-save vote (for form persistence)
  static async saveVoteDraft(matchupId: string, selectedContestantId: string): Promise<void> {
    try {
      const key = `vote_draft_${matchupId}`;
      const draftData = {
        matchupId,
        selectedContestantId,
        timestamp: Date.now(),
      };
      
      localStorage.setItem(key, JSON.stringify(draftData));
    } catch (error) {
      console.error('Error saving vote draft:', error);
    }
  }

  // Get saved vote draft
  static getVoteDraft(matchupId: string): { selectedContestantId: string } | null {
    try {
      const key = `vote_draft_${matchupId}`;
      const saved = localStorage.getItem(key);
      
      if (!saved) return null;
      
      const draftData = JSON.parse(saved);
      
      // Check if draft is not too old (1 hour)
      const oneHour = 60 * 60 * 1000;
      if (Date.now() - draftData.timestamp > oneHour) {
        localStorage.removeItem(key);
        return null;
      }
      
      return { selectedContestantId: draftData.selectedContestantId };
    } catch (error) {
      console.error('Error getting vote draft:', error);
      return null;
    }
  }

  // Clear vote draft
  static clearVoteDraft(matchupId: string): void {
    try {
      const key = `vote_draft_${matchupId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing vote draft:', error);
    }
  }
}