import { supabase } from '@/lib/supabase';
import type { AdminDashboardData, ActivityLog, User } from '@/types';

export class AdminService {
  // Helper method to convert slug to UUID if needed
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
  // Check if current user is admin
  static async isAdmin(): Promise<boolean> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return false;

      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.user.id)
        .single();

      if (error) return false;
      return data?.is_admin || false;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  // Get admin dashboard data
  static async getDashboardData(): Promise<AdminDashboardData> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      // Get tournament counts
      const { data: tournamentCounts } = await supabase
        .from('tournaments')
        .select('status', { count: 'exact' });

      const totalTournaments = tournamentCounts?.length || 0;
      const activeTournaments = tournamentCounts?.filter(t => t.status === 'active').length || 0;

      // Get user count
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Get total votes
      const { count: totalVotes } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true });

      // Get tournaments list for admin dashboard
      const { data: tournaments } = await supabase
        .from('tournaments')
        .select('id, name, description, status, current_contestants, max_contestants, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      // Get recent activity (mock for now - you could implement a proper activity log)
      const recentActivity: ActivityLog[] = [
        {
          id: '1',
          user_id: 'system',
          action: 'tournament_created',
          details: 'New tournament created',
          timestamp: new Date().toISOString(),
        },
      ];

      return {
        total_tournaments: totalTournaments,
        active_tournaments: activeTournaments,
        total_users: totalUsers || 0,
        total_votes: totalVotes || 0,
        recent_activity: recentActivity,
        tournaments: tournaments || [],
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch dashboard data');
    }
  }

  // Advance tournament to next round (only if all matchups completed)
  static async advanceToNextRound(identifier: string): Promise<void> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const tournamentId = await this.getUuidFromIdentifier(identifier);
      const { data, error } = await supabase.rpc('advance_to_next_round', {
        tournament_uuid: tournamentId,
      });

      if (error) throw error;
      if (!data) throw new Error('Failed to advance tournament');
    } catch (error) {
      console.error('Error advancing tournament:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to advance tournament');
    }
  }

  // Force advance tournament round by declaring winners for all active matchups
  static async forceAdvanceRound(identifier: string): Promise<{
    success: boolean;
    winnersDeclared: number;
    tiesResolved: number;
    message: string;
    error?: string;
  }> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const tournamentId = await this.getUuidFromIdentifier(identifier);
      const { data, error } = await supabase.rpc('force_advance_round', {
        tournament_uuid: tournamentId,
      });

      if (error) throw error;
      
      return {
        success: data.success,
        winnersDeclared: data.winners_declared || 0,
        tiesResolved: data.ties_resolved || 0,
        message: data.message || 'Round advanced successfully',
        error: data.error,
      };
    } catch (error) {
      console.error('Error force advancing tournament:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to force advance tournament');
    }
  }

  // Lock/unlock round
  static async lockRound(roundId: string, locked: boolean): Promise<void> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const updateData = locked 
        ? { locked_at: new Date().toISOString() }
        : { locked_at: null };

      const { error } = await supabase
        .from('rounds')
        .update(updateData)
        .eq('id', roundId);

      if (error) throw error;
    } catch (error) {
      console.error('Error locking/unlocking round:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update round lock status');
    }
  }

  // Finalize matchup results
  static async finalizeMatchup(matchupId: string): Promise<void> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const { error } = await supabase.rpc('finalize_matchup', {
        matchup_uuid: matchupId,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error finalizing matchup:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to finalize matchup');
    }
  }

  // Override matchup winner (admin decision)
  static async overrideMatchupWinner(matchupId: string, winnerId: string): Promise<void> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const { error } = await supabase
        .from('matchups')
        .update({ 
          winner_id: winnerId,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', matchupId);

      if (error) throw error;
    } catch (error) {
      console.error('Error overriding matchup winner:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to override matchup winner');
    }
  }

  // Reset tournament bracket
  static async resetTournamentBracket(identifier: string): Promise<void> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const tournamentId = await this.getUuidFromIdentifier(identifier);
      const { error } = await supabase.rpc('reset_tournament_bracket', {
        tournament_uuid: tournamentId,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error resetting tournament bracket:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to reset tournament bracket');
    }
  }

  // Get all users with admin controls and participation data
  static async getAllUsers(
    page: number = 1,
    pageSize: number = 20,
    search?: string
  ): Promise<{ data: any[]; total: number }> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
      }

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;

      // Enrich user data with tournament participation and vote history
      const enrichedUsers = await Promise.all(
        (data || []).map(async (user) => {
          // Get tournament participation (tournaments user has voted in)
          const { data: tournaments } = await supabase
            .from('votes')
            .select(`
              matchups!inner(
                tournament_id,
                tournaments!inner(id, name, status)
              )
            `)
            .eq('user_id', user.id);

          // Get unique tournaments user has participated in
          const uniqueTournaments = new Map();
          (tournaments || []).forEach(vote => {
            const tournament = vote.matchups.tournaments;
            uniqueTournaments.set(tournament.id, tournament);
          });

          // Get vote history with more details
          const { data: voteHistory } = await supabase
            .from('votes')
            .select(`
              *,
              matchups!inner(
                id,
                tournament_id,
                contestant1_votes,
                contestant2_votes,
                winner_id,
                rounds!inner(round_number, name),
                tournaments!inner(id, name),
                contestant1:contestants!contestant1_id(id, name),
                contestant2:contestants!contestant2_id(id, name)
              ),
              contestants!selected_contestant_id(id, name)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          // Get vote count
          const { count: voteCount } = await supabase
            .from('votes')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

          return {
            ...user,
            tournaments_participated: Array.from(uniqueTournaments.values()),
            vote_history: voteHistory || [],
            total_votes: voteCount || 0,
            // Add computed fields
            tournaments_count: uniqueTournaments.size,
            last_activity: voteHistory?.[0]?.created_at || null
          };
        })
      );

      return {
        data: enrichedUsers,
        total: count || 0,
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch users');
    }
  }

  // Update user admin status
  static async updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<void> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const { error } = await supabase
        .from('users')
        .update({ is_admin: isAdmin })
        .eq('id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating user admin status:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update user admin status');
    }
  }

  // Update user tournament creator permissions
  static async updateUserTournamentCreatorStatus(userId: string, canCreateTournaments: boolean): Promise<void> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const { error } = await supabase
        .from('users')
        .update({ can_create_tournaments: canCreateTournaments })
        .eq('id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating user tournament creator status:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update user tournament creator status');
    }
  }

  // Delete user account (admin only)
  static async deleteUser(userId: string): Promise<{ success: boolean; warning?: string }> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      // First delete from users table
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (profileError) throw profileError;

      // Then delete from auth using admin API
      const { data: authData, error: authError } = await supabase.auth.admin.deleteUser(userId);

      if (authError) {
        // If auth deletion fails, we should warn but not fail completely
        console.warn('Auth deletion failed:', authError);
        return {
          success: true,
          warning: 'User profile deleted successfully. Note: The authentication record still exists and requires manual deletion by a system administrator. The user may still appear in the list if they attempt to log in again.'
        };
      }

      return {
        success: true
      };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete user');
    }
  }

  // Debug authentication issues
  static async getAuthenticationDebugInfo(): Promise<any> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      // Get orphaned auth users (auth users without profiles)
      const { data: orphanedAuth, error: orphanedAuthError } = await supabase.rpc('get_orphaned_auth_users');
      if (orphanedAuthError) throw orphanedAuthError;

      // Get orphaned profiles (profiles without auth records)
      const { data: orphanedProfiles, error: orphanedProfilesError } = await supabase.rpc('get_orphaned_user_profiles');
      if (orphanedProfilesError) throw orphanedProfilesError;

      // Get basic counts
      const { count: authUsersCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      return {
        user_profiles_count: authUsersCount || 0,
        orphaned_auth_users: orphanedAuth || [],
        orphaned_profiles: orphanedProfiles || [],
        orphaned_auth_count: (orphanedAuth || []).length,
        orphaned_profiles_count: (orphanedProfiles || []).length,
        issues_found: (orphanedAuth || []).length > 0 || (orphanedProfiles || []).length > 0
      };
    } catch (error) {
      console.error('Error getting authentication debug info:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get authentication debug info');
    }
  }

  // Recover missing user profiles
  static async recoverMissingUserProfiles(): Promise<any> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const { data, error } = await supabase.rpc('recover_missing_user_profiles');
      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error recovering missing user profiles:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to recover missing user profiles');
    }
  }

  // Get tournament management data
  static async getTournamentManagementData(identifier: string): Promise<any> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const tournamentId = await this.getUuidFromIdentifier(identifier);
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          contestants(*),
          rounds(
            *,
            matchups(
              *,
              contestant1:contestants!contestant1_id(*),
              contestant2:contestants!contestant2_id(*),
              winner:contestants!winner_id(*),
              votes(count)
            )
          )
        `)
        .eq('id', tournamentId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching tournament management data:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch tournament data');
    }
  }

  // Cast admin vote
  static async castAdminVote(
    matchupId: string,
    selectedContestantId: string
  ): Promise<void> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('votes')
        .upsert([
          {
            user_id: user.user.id,
            matchup_id: matchupId,
            selected_contestant_id: selectedContestantId,
            is_admin_vote: true,
          },
        ]);

      if (error) throw error;
    } catch (error) {
      console.error('Error casting admin vote:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to cast admin vote');
    }
  }

  // Get detailed vote analysis for a matchup
  static async getMatchupVoteAnalysis(matchupId: string): Promise<any> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const { data, error } = await supabase
        .from('votes')
        .select(`
          *,
          users(username, email, is_admin),
          contestants(name)
        `)
        .eq('matchup_id', matchupId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Analyze vote patterns
      const regularVotes = data?.filter(v => !v.is_admin_vote) || [];
      const adminVotes = data?.filter(v => v.is_admin_vote) || [];

      return {
        votes: data || [],
        analysis: {
          totalVotes: data?.length || 0,
          regularVotes: regularVotes.length,
          adminVotes: adminVotes.length,
          votingTimespan: data?.length ? {
            first: data[data.length - 1]?.created_at,
            last: data[0]?.created_at,
          } : null,
        },
      };
    } catch (error) {
      console.error('Error fetching vote analysis:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch vote analysis');
    }
  }

  // Export tournament data
  static async exportTournamentData(identifier: string): Promise<any> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const tournamentId = await this.getUuidFromIdentifier(identifier);
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          contestants(*),
          rounds(
            *,
            matchups(
              *,
              contestant1:contestants!contestant1_id(*),
              contestant2:contestants!contestant2_id(*),
              winner:contestants!winner_id(*),
              votes(
                *,
                users(username)
              )
            )
          )
        `)
        .eq('id', tournamentId)
        .single();

      if (error) throw error;

      // Add metadata
      return {
        ...data,
        exported_at: new Date().toISOString(),
        exported_by: (await supabase.auth.getUser()).data.user?.id,
      };
    } catch (error) {
      console.error('Error exporting tournament data:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to export tournament data');
    }
  }

  // Get system statistics
  static async getSystemStats(): Promise<any> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      // Run multiple queries in parallel
      const [
        { count: totalUsers },
        { count: totalTournaments },
        { count: totalVotes },
        { count: totalContestants },
        { data: recentTournaments },
        { data: topUsers },
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }),
        supabase.from('votes').select('*', { count: 'exact', head: true }),
        supabase.from('contestants').select('*', { count: 'exact', head: true }),
        supabase.from('tournaments').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('users').select('*, votes(count)').order('created_at', { ascending: false }).limit(10),
      ]);

      return {
        overview: {
          totalUsers: totalUsers || 0,
          totalTournaments: totalTournaments || 0,
          totalVotes: totalVotes || 0,
          totalContestants: totalContestants || 0,
        },
        recent: {
          tournaments: recentTournaments || [],
          users: topUsers || [],
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching system stats:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch system statistics');
    }
  }

  // Cleanup orphaned data
  static async cleanupOrphanedData(): Promise<{ cleaned: number; details: string[] }> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const details: string[] = [];
      let totalCleaned = 0;

      // Clean up orphaned images
      const { data: imageCleanup, error: imageError } = await supabase.rpc('cleanup_orphaned_images');
      
      if (imageError) {
        details.push(`Image cleanup failed: ${imageError.message}`);
      } else {
        totalCleaned += imageCleanup || 0;
        details.push(`Cleaned ${imageCleanup} orphaned images`);
      }

      // Add more cleanup operations as needed

      return {
        cleaned: totalCleaned,
        details,
      };
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to cleanup orphaned data');
    }
  }
}