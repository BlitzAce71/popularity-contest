import { supabase } from '@/lib/supabase';
import type { 
  ContestantSuggestion,
  SuggestionWithVoteStatus,
  SubmitSuggestionRequest,
  GetSuggestionsRequest,
  SuggestionAnalytics,
  ModerateSuggestionRequest,
  BulkModerationRequest,
  BulkModerationResponse,
  ConvertToContestantRequest
} from '@/types';

export class SuggestionService {
  // Helper method to convert slug to UUID if needed (following existing pattern)
  private static async getUuidFromIdentifier(identifier: string): Promise<string> {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    if (isUUID) {
      return identifier; // Already a UUID
    }
    
    // Convert slug to UUID
    const { data: tournament, error } = await supabase
      .from('tournaments')
      .select('id')
      .eq('slug', identifier)
      .single();

    if (error) throw error;
    if (!tournament) throw new Error('Tournament not found');

    return tournament.id;
  }

  // Validate suggestion data
  private static validateSuggestionData(data: SubmitSuggestionRequest): string[] {
    const errors: string[] = [];
    
    if (!data.name?.trim()) {
      errors.push('Suggestion name is required');
    } else if (data.name.length > 255) {
      errors.push('Suggestion name must be 255 characters or less');
    }
    
    if (data.description && data.description.length > 1000) {
      errors.push('Description must be 1000 characters or less');
    }
    
    if (data.image_url && !this.isValidImageUrl(data.image_url)) {
      errors.push('Image URL must be a valid image file (jpg, png, gif, webp)');
    }
    
    return errors;
  }

  // Validate image URL format
  private static isValidImageUrl(url: string): boolean {
    const imagePattern = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i;
    return imagePattern.test(url);
  }

  // Check for duplicate suggestions
  private static async checkDuplicates(tournamentId: string, name: string): Promise<ContestantSuggestion | null> {
    const { data, error } = await supabase
      .from('contestant_suggestions')
      .select('*')
      .eq('tournament_id', tournamentId)
      .ilike('name', name)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  // =============================================================================
  // PUBLIC METHODS - SUGGESTION MANAGEMENT
  // =============================================================================

  // Submit a new suggestion
  static async submitSuggestion(
    tournamentId: string,
    suggestionData: SubmitSuggestionRequest
  ): Promise<SuggestionWithVoteStatus> {
    try {
      // Get authenticated user
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Authentication required');

      // Convert identifier to UUID if needed
      const tournamentUuid = await this.getUuidFromIdentifier(tournamentId);

      // Validate input data
      const validationErrors = this.validateSuggestionData(suggestionData);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '));
      }

      // Check if tournament exists and is in draft status
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('id, status, is_public, created_by')
        .eq('id', tournamentUuid)
        .single();

      if (tournamentError) throw new Error('Tournament not found');
      if (tournament.status !== 'draft') {
        throw new Error('Suggestions can only be submitted for draft tournaments');
      }

      // Check for duplicates
      const duplicate = await this.checkDuplicates(tournamentUuid, suggestionData.name);
      if (duplicate) {
        throw new Error(`A suggestion named "${suggestionData.name}" already exists`);
      }

      // Submit suggestion
      const { data: newSuggestion, error } = await supabase
        .from('contestant_suggestions')
        .insert([
          {
            tournament_id: tournamentUuid,
            suggested_by: user.user.id,
            name: suggestionData.name.trim(),
            description: suggestionData.description?.trim() || null,
            image_url: suggestionData.image_url || null,
          },
        ])
        .select(`
          *,
          suggested_by_user:users!suggested_by(id, username)
        `)
        .single();

      if (error) throw error;

      return {
        ...newSuggestion,
        user_has_voted: false,
        duplicate_count: 0,
      };
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to submit suggestion');
    }
  }

  // Get suggestions for a tournament
  static async getSuggestions(
    request: GetSuggestionsRequest
  ): Promise<{ data: SuggestionWithVoteStatus[]; total: number }> {
    try {
      const { 
        tournament_id,
        page = 1,
        page_size = 20,
        sort_by = 'votes',
        status = 'all',
        search
      } = request;

      // Convert identifier to UUID if needed
      const tournamentUuid = await this.getUuidFromIdentifier(tournament_id);

      // Get current user for vote status
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;

      // Build query
      let query = supabase
        .from('contestant_suggestions')
        .select(`
          *,
          suggested_by_user:users!suggested_by(id, username),
          user_vote:suggestion_votes!left(user_id)
        `, { count: 'exact' })
        .eq('tournament_id', tournamentUuid);

      // Apply filters
      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      // Apply sorting
      switch (sort_by) {
        case 'votes':
          query = query.order('vote_count', { ascending: false }).order('created_at', { ascending: true });
          break;
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'alphabetical':
          query = query.order('name', { ascending: true });
          break;
      }

      // Apply pagination
      const from = (page - 1) * page_size;
      const to = from + page_size - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      // Process results to include vote status
      const processedData: SuggestionWithVoteStatus[] = (data || []).map((suggestion: any) => ({
        ...suggestion,
        user_has_voted: userId ? 
          suggestion.user_vote.some((vote: any) => vote.user_id === userId) : 
          false,
        duplicate_count: 0, // TODO: Calculate this if needed
      }));

      return { data: processedData, total: count || 0 };
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch suggestions');
    }
  }

  // Vote on a suggestion
  static async voteOnSuggestion(suggestionId: string): Promise<{ success: boolean; newVoteCount: number }> {
    try {
      // Get authenticated user
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Authentication required');

      // Check if user has already voted
      const { data: existingVote } = await supabase
        .from('suggestion_votes')
        .select('id')
        .eq('suggestion_id', suggestionId)
        .eq('user_id', user.user.id)
        .single();

      if (existingVote) {
        throw new Error('You have already voted on this suggestion');
      }

      // Submit vote
      const { error: voteError } = await supabase
        .from('suggestion_votes')
        .insert([
          {
            suggestion_id: suggestionId,
            user_id: user.user.id,
          },
        ]);

      if (voteError) throw voteError;

      // Get updated vote count
      const { data: suggestion } = await supabase
        .from('contestant_suggestions')
        .select('vote_count')
        .eq('id', suggestionId)
        .single();

      return { success: true, newVoteCount: suggestion?.vote_count || 0 };
    } catch (error) {
      console.error('Error voting on suggestion:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to vote on suggestion');
    }
  }

  // Remove vote from suggestion
  static async removeVote(suggestionId: string): Promise<{ success: boolean; newVoteCount: number }> {
    try {
      // Get authenticated user
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Authentication required');

      // Remove vote
      const { error: deleteError } = await supabase
        .from('suggestion_votes')
        .delete()
        .eq('suggestion_id', suggestionId)
        .eq('user_id', user.user.id);

      if (deleteError) throw deleteError;

      // Get updated vote count
      const { data: suggestion } = await supabase
        .from('contestant_suggestions')
        .select('vote_count')
        .eq('id', suggestionId)
        .single();

      return { success: true, newVoteCount: suggestion?.vote_count || 0 };
    } catch (error) {
      console.error('Error removing vote:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to remove vote');
    }
  }

  // Get user's vote status for all suggestions in a tournament
  static async getUserVoteStatus(tournamentId: string): Promise<Record<string, boolean>> {
    try {
      // Get authenticated user
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return {};

      // Convert identifier to UUID if needed
      const tournamentUuid = await this.getUuidFromIdentifier(tournamentId);

      // Get all user votes for suggestions in this tournament
      const { data: votes, error } = await supabase
        .from('suggestion_votes')
        .select(`
          suggestion_id,
          contestant_suggestions!inner(tournament_id)
        `)
        .eq('user_id', user.user.id)
        .eq('contestant_suggestions.tournament_id', tournamentUuid);

      if (error) throw error;

      // Convert to record
      const voteStatus: Record<string, boolean> = {};
      (votes || []).forEach(vote => {
        voteStatus[vote.suggestion_id] = true;
      });

      return voteStatus;
    } catch (error) {
      console.error('Error getting user vote status:', error);
      return {};
    }
  }

  // =============================================================================
  // ADMIN METHODS - MODERATION AND MANAGEMENT
  // =============================================================================

  // Check if user has admin/creator permissions for a tournament
  private static async hasAdminPermissions(tournamentId: string): Promise<boolean> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return false;

      // Check if user is admin
      const { data: userData } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.user.id)
        .single();

      if (userData?.is_admin) return true;

      // Check if user is tournament creator
      const tournamentUuid = await this.getUuidFromIdentifier(tournamentId);
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('created_by')
        .eq('id', tournamentUuid)
        .single();

      return tournament?.created_by === user.user.id;
    } catch (error) {
      console.error('Error checking admin permissions:', error);
      return false;
    }
  }

  // Moderate a single suggestion
  static async moderateSuggestion(request: ModerateSuggestionRequest): Promise<void> {
    try {
      const { suggestion_id, status, admin_notes } = request;

      // Get suggestion to check tournament
      const { data: suggestion } = await supabase
        .from('contestant_suggestions')
        .select('tournament_id')
        .eq('id', suggestion_id)
        .single();

      if (!suggestion) throw new Error('Suggestion not found');

      // Check permissions
      const hasPermission = await this.hasAdminPermissions(suggestion.tournament_id);
      if (!hasPermission) {
        throw new Error('Unauthorized: Admin or tournament creator access required');
      }

      // Update suggestion
      const { error } = await supabase
        .from('contestant_suggestions')
        .update({
          status,
          admin_notes: admin_notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', suggestion_id);

      if (error) throw error;
    } catch (error) {
      console.error('Error moderating suggestion:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to moderate suggestion');
    }
  }

  // Bulk moderate suggestions
  static async bulkModerateSuggestions(request: BulkModerationRequest): Promise<BulkModerationResponse> {
    try {
      const { suggestion_ids, action, admin_notes } = request;
      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const suggestionId of suggestion_ids) {
        try {
          if (action === 'delete') {
            // Get suggestion to check permissions
            const { data: suggestion } = await supabase
              .from('contestant_suggestions')
              .select('tournament_id')
              .eq('id', suggestionId)
              .single();

            if (!suggestion) throw new Error('Suggestion not found');

            const hasPermission = await this.hasAdminPermissions(suggestion.tournament_id);
            if (!hasPermission) throw new Error('Unauthorized');

            // Delete suggestion (votes will be deleted via CASCADE)
            const { error } = await supabase
              .from('contestant_suggestions')
              .delete()
              .eq('id', suggestionId);

            if (error) throw error;
          } else {
            // Approve or reject
            const status = action === 'approve' ? 'approved' : 'rejected';
            await this.moderateSuggestion({
              suggestion_id: suggestionId,
              status,
              admin_notes,
            });
          }
          success++;
        } catch (error) {
          failed++;
          errors.push(`${suggestionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return { success, failed, errors };
    } catch (error) {
      console.error('Error bulk moderating suggestions:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to bulk moderate suggestions');
    }
  }

  // Get suggestion analytics for a tournament
  static async getSuggestionAnalytics(tournamentId: string): Promise<SuggestionAnalytics> {
    try {
      // Check permissions
      const hasPermission = await this.hasAdminPermissions(tournamentId);
      if (!hasPermission) {
        throw new Error('Unauthorized: Admin or tournament creator access required');
      }

      const tournamentUuid = await this.getUuidFromIdentifier(tournamentId);

      // Get basic stats
      const { data: suggestions, error } = await supabase
        .from('contestant_suggestions')
        .select(`
          *,
          suggested_by_user:users!suggested_by(id, username)
        `)
        .eq('tournament_id', tournamentUuid);

      if (error) throw error;

      const totalSuggestions = suggestions?.length || 0;
      const uniqueContributors = new Set(suggestions?.map(s => s.suggested_by)).size;
      const totalVotes = suggestions?.reduce((sum, s) => sum + s.vote_count, 0) || 0;
      const averageVotesPerSuggestion = totalSuggestions > 0 ? totalVotes / totalSuggestions : 0;

      // Top suggestions
      const topSuggestions = (suggestions || [])
        .sort((a, b) => b.vote_count - a.vote_count)
        .slice(0, 10)
        .map(s => ({
          id: s.id,
          name: s.name,
          vote_count: s.vote_count,
          suggested_by_username: s.suggested_by_user.username,
        }));

      // Top contributors
      const contributorMap = new Map<string, { username: string; suggestionCount: number; totalVotesReceived: number }>();
      (suggestions || []).forEach(s => {
        const userId = s.suggested_by;
        const existing = contributorMap.get(userId) || { 
          username: s.suggested_by_user.username, 
          suggestionCount: 0, 
          totalVotesReceived: 0 
        };
        existing.suggestionCount++;
        existing.totalVotesReceived += s.vote_count;
        contributorMap.set(userId, existing);
      });

      const topContributors = Array.from(contributorMap.entries())
        .sort((a, b) => b[1].totalVotesReceived - a[1].totalVotesReceived)
        .slice(0, 10)
        .map(([userId, data]) => ({
          user_id: userId,
          username: data.username,
          suggestion_count: data.suggestionCount,
          total_votes_received: data.totalVotesReceived,
        }));

      // Status breakdown
      const statusBreakdown = {
        pending: suggestions?.filter(s => s.status === 'pending').length || 0,
        approved: suggestions?.filter(s => s.status === 'approved').length || 0,
        rejected: suggestions?.filter(s => s.status === 'rejected').length || 0,
        duplicate: suggestions?.filter(s => s.status === 'duplicate').length || 0,
      };

      return {
        total_suggestions: totalSuggestions,
        unique_contributors: uniqueContributors,
        total_votes: totalVotes,
        average_votes_per_suggestion: Math.round(averageVotesPerSuggestion * 100) / 100,
        top_suggestions: topSuggestions,
        top_contributors: topContributors,
        activity_timeline: [], // TODO: Implement if needed
        status_breakdown: statusBreakdown,
      };
    } catch (error) {
      console.error('Error getting suggestion analytics:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get suggestion analytics');
    }
  }

  // =============================================================================
  // REAL-TIME SUBSCRIPTIONS
  // =============================================================================

  // Subscribe to suggestion updates for a tournament
  static subscribeToSuggestionUpdates(
    tournamentId: string,
    callback: (payload: any) => void
  ): () => void {
    const subscription = supabase
      .channel(`suggestions-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contestant_suggestions',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'suggestion_votes',
        },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }
}