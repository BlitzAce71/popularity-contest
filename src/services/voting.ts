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

  // Get user's voting history grouped by tournament
  static async getUserVoteHistoryByTournament(): Promise<any[]> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];

      const { data, error } = await supabase
        .from('votes')
        .select(`
          *,
          matchups!inner(
            id,
            position,
            status,
            contestant1_votes,
            contestant2_votes,
            winner_id,
            rounds!inner(
              id,
              round_number,
              name
            ),
            tournaments!inner(id, name, status),
            contestant1:contestants!contestant1_id(id, name),
            contestant2:contestants!contestant2_id(id, name)
          ),
          contestants!selected_contestant_id(id, name)
        `)
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group votes by tournament
      const tournamentGroups = new Map();
      
      (data || []).forEach((vote) => {
        const tournament = vote.matchups.tournaments;
        const tournamentKey = tournament.id;
        
        if (!tournamentGroups.has(tournamentKey)) {
          tournamentGroups.set(tournamentKey, {
            tournament: {
              id: tournament.id,
              name: tournament.name,
              status: tournament.status
            },
            votes: []
          });
        }
        
        // Determine opponent
        const myContestant = vote.contestants;
        const opponent = vote.matchups.contestant1.id === myContestant.id 
          ? vote.matchups.contestant2 
          : vote.matchups.contestant1;
        
        // Determine my votes and opponent votes
        const myVotes = vote.matchups.contestant1.id === myContestant.id 
          ? vote.matchups.contestant1_votes 
          : vote.matchups.contestant2_votes;
        const opponentVotes = vote.matchups.contestant1.id === myContestant.id 
          ? vote.matchups.contestant2_votes 
          : vote.matchups.contestant1_votes;

        // Determine result
        let result = 'PENDING';
        if (vote.matchups.winner_id) {
          result = vote.matchups.winner_id === myContestant.id ? 'WON' : 'LOST';
        }
        
        tournamentGroups.get(tournamentKey).votes.push({
          id: vote.id,
          matchup_id: vote.matchup_id,
          round_number: vote.matchups.rounds.round_number,
          round_name: vote.matchups.rounds.name,
          my_contestant: myContestant,
          opponent: opponent,
          my_votes: myVotes,
          opponent_votes: opponentVotes,
          result: result,
          matchup_status: vote.matchups.status,
          voted_at: vote.created_at
        });
      });

      // Convert to array and sort votes within each tournament by round
      const result = Array.from(tournamentGroups.values()).map(group => ({
        ...group,
        votes: group.votes.sort((a, b) => a.round_number - b.round_number)
      }));

      return result;
    } catch (error) {
      console.error('Error fetching vote history by tournament:', error);
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

      // Get user's votes for these matchups (exclude admin votes)
      const matchupIds = activeMatchups.map((m) => m.id);
      const { data: userVotes, error: votesError } = await supabase
        .from('votes')
        .select('matchup_id')
        .eq('user_id', user.user.id)
        .eq('is_admin_vote', false)
        .in('matchup_id', matchupIds);

      if (votesError) throw votesError;

      const votedMatchups = userVotes?.length || 0;
      const availableMatchups = Math.max(0, totalMatchups - votedMatchups);
      const completionPercentage = totalMatchups > 0 ? Math.min(100, (votedMatchups / totalMatchups) * 100) : 0;

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
        .from('vote_results')
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

  // Get vote counts for all matchups in a tournament (both active and completed)
  // PERFORMANCE OPTIMIZED: Uses pre-calculated vote counts from matchups table
  // instead of manually counting votes (was 189 queries for 64-contestant tournament, now just 1)
  static async getLiveVoteCounts(tournamentId: string): Promise<Record<string, {
    contestant1Votes: number;
    contestant2Votes: number;
    totalVotes: number;
  }>> {
    try {
      // Get all matchups with pre-calculated vote counts in a single efficient query
      const { data: matchups, error: matchupsError } = await supabase
        .from('matchups')
        .select('id, contestant1_votes, contestant2_votes, total_votes')
        .eq('tournament_id', tournamentId);

      if (matchupsError) throw matchupsError;

      if (!matchups || matchups.length === 0) {
        return {};
      }

      // Transform the pre-calculated vote counts into the expected format
      const voteCounts: Record<string, any> = {};
      
      for (const matchup of matchups) {
        voteCounts[matchup.id] = {
          contestant1Votes: matchup.contestant1_votes || 0,
          contestant2Votes: matchup.contestant2_votes || 0,
          totalVotes: matchup.total_votes || 0,
        };
      }

      return voteCounts;
    } catch (error) {
      console.error('Error fetching vote counts:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch vote counts');
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
          table: 'vote_results',
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

  // Submit admin tie-breaking vote (simplified - no weight)
  static async submitAdminTieBreaker(
    matchupId: string,
    selectedContestantId: string
  ): Promise<Vote> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      // Verify user is admin
      const { data: userData } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.user.id)
        .single();

      if (!userData?.is_admin) {
        throw new Error('Unauthorized: Admin access required for tie-breaking votes');
      }

      // Check if matchup is actually tied
      const results = await this.getMatchupResults(matchupId);
      const voteDifference = Math.abs(results.contestant1Votes - results.contestant2Votes);
      
      if (voteDifference !== 0) {
        throw new Error('Tie-breaking votes can only be used for actual ties (vote difference = 0)');
      }

      // First, remove any existing admin vote from this user for this matchup
      await supabase
        .from('votes')
        .delete()
        .eq('user_id', user.user.id)
        .eq('matchup_id', matchupId)
        .eq('is_admin_vote', true);

      // Then insert the new admin tie-breaker vote
      const { data, error } = await supabase
        .from('votes')
        .insert([
          {
            user_id: user.user.id,
            matchup_id: matchupId,
            selected_contestant_id: selectedContestantId,
            is_admin_vote: true,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error submitting admin tie-breaker vote:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to submit tie-breaker vote');
    }
  }

  // Get tie-breaking opportunities for admins
  static async getTieBreakingOpportunities(tournamentId: string): Promise<{
    matchupId: string;
    contestant1: any;
    contestant2: any;
    contestant1Votes: number;
    contestant2Votes: number;
    voteDifference: number;
    hasAdminVote: boolean;
  }[]> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];

      // Verify user is admin
      const { data: userData } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.user.id)
        .single();

      if (!userData?.is_admin) return [];

      // Get active matchups with close vote counts
      const { data: matchups, error } = await supabase
        .from('matchups')
        .select(`
          id,
          contestant1_id,
          contestant2_id,
          status
        `)
        .eq('tournament_id', tournamentId)
        .eq('status', 'active');

      if (error) throw error;

      const opportunities = [];
      
      for (const matchup of matchups || []) {
        const results = await this.getMatchupResults(matchup.id);
        const voteDifference = Math.abs(results.contestant1Votes - results.contestant2Votes);
        
        // Only show matchups that are actually tied (difference of 0)
        if (voteDifference === 0) {
          // Get contestant data separately
          const { data: contestant1 } = await supabase
            .from('contestants')
            .select('id, name, image_url')
            .eq('id', matchup.contestant1_id)
            .single();

          const { data: contestant2 } = await supabase
            .from('contestants')
            .select('id, name, image_url')
            .eq('id', matchup.contestant2_id)
            .single();

          // Check if any admin has already cast a tie-breaker vote for this matchup
          const { data: adminVote } = await supabase
            .from('votes')
            .select('id')
            .eq('matchup_id', matchup.id)
            .eq('is_admin_vote', true)
            .maybeSingle();

          if (contestant1 && contestant2) {
            opportunities.push({
              matchupId: matchup.id,
              contestant1,
              contestant2, 
              contestant1Votes: results.contestant1Votes,
              contestant2Votes: results.contestant2Votes,
              voteDifference,
              hasAdminVote: !!adminVote,
            });
          }
        }
      }

      return opportunities;
    } catch (error) {
      console.error('Error getting tie-breaking opportunities:', error);
      return [];
    }
  }

  // Remove admin tie-breaking vote
  static async removeAdminTieBreaker(matchupId: string): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      // Verify user is admin
      const { data: userData } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.user.id)
        .single();

      if (!userData?.is_admin) {
        throw new Error('Unauthorized: Admin access required');
      }

      // Remove any admin tie-breaker vote for this matchup
      const { error } = await supabase
        .from('votes')
        .delete()
        .eq('matchup_id', matchupId)
        .eq('is_admin_vote', true);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing admin tie-breaker vote:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to remove tie-breaker vote');
    }
  }

  // Batch vote submission (simplified - no weight)
  static async submitBatchVotes(
    votes: { matchupId: string; selectedContestantId: string; isAdminVote?: boolean }[]
  ): Promise<Vote[]> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const voteData = votes.map((vote) => ({
        user_id: user.user.id,
        matchup_id: vote.matchupId,
        selected_contestant_id: vote.selectedContestantId,
        is_admin_vote: vote.isAdminVote || false,
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

      // Check matchup status
      const { data: matchup, error } = await supabase
        .from('matchups')
        .select('status')
        .eq('id', matchupId)
        .single();

      if (error) throw error;

      if (matchup.status !== 'active') {
        return { canVote: false, reason: 'Matchup is not currently active' };
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