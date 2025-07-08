import { supabase } from '@/lib/supabase';
import type { AdminDashboardData, ActivityLog, User } from '@/types';

export class AdminService {
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
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch dashboard data');
    }
  }

  // Advance tournament to next round (only if all matchups completed)
  static async advanceToNextRound(tournamentId: string): Promise<void> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

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
  static async forceAdvanceRound(tournamentId: string): Promise<{
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
  static async resetTournamentBracket(tournamentId: string): Promise<void> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      const { error } = await supabase.rpc('reset_tournament_bracket', {
        tournament_uuid: tournamentId,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error resetting tournament bracket:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to reset tournament bracket');
    }
  }

  // Get all users with admin controls
  static async getAllUsers(
    page: number = 1,
    pageSize: number = 20,
    search?: string
  ): Promise<{ data: User[]; total: number }> {
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

      return {
        data: data || [],
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

  // Delete user account (admin only)
  static async deleteUser(userId: string): Promise<void> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

      // First delete the user profile
      const { error: profileError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (profileError) throw profileError;

      // Note: Deleting from auth.users requires admin service role key
      // This should be done via a secure server endpoint or admin API
      console.warn('User profile deleted, but auth record requires server-side deletion');
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete user');
    }
  }

  // Get tournament management data
  static async getTournamentManagementData(tournamentId: string): Promise<any> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

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
  static async exportTournamentData(tournamentId: string): Promise<any> {
    try {
      const isAdminUser = await this.isAdmin();
      if (!isAdminUser) {
        throw new Error('Unauthorized: Admin access required');
      }

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