import { supabase } from '@/lib/supabase';
import { AdminService } from '@/services/admin';
import { ContestantService } from '@/services/contestants';
import type { Tournament, CreateTournamentData, FilterOptions, SortOptions, PaginatedResponse } from '@/types';

export class TournamentService {
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
  // Get tournaments with filtering, sorting, and pagination
  static async getTournaments(
    page: number = 1,
    pageSize: number = 10,
    filters?: FilterOptions,
    sort?: SortOptions
  ): Promise<PaginatedResponse<Tournament>> {
    try {
      let query = supabase
        .from('tournaments')
        .select('*, users!created_by(username)', { count: 'exact' });

      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.bracket_type) {
        query = query.eq('bracket_type', filters.bracket_type);
      }
      if (filters?.is_public !== undefined) {
        query = query.eq('is_public', filters.is_public);
      }
      if (filters?.created_by) {
        query = query.eq('created_by', filters.created_by);
      }
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      // Apply sorting
      if (sort) {
        query = query.order(sort.field, { ascending: sort.direction === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        count: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch tournaments');
    }
  }

  // Get single tournament with full details (supports both UUID and slug)
  static async getTournament(identifier: string): Promise<Tournament> {
    try {
      // Check if identifier is a UUID pattern
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          users!created_by(username),
          contestants(*),
          rounds(
            *,
            matchups(
              *,
              contestant1:contestants!contestant1_id(*),
              contestant2:contestants!contestant2_id(*),
              winner:contestants!winner_id(*)
            )
          )
        `)
        .eq(isUUID ? 'id' : 'slug', identifier)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Tournament not found');

      return data;
    } catch (error) {
      console.error('Error fetching tournament:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch tournament');
    }
  }

  // Get tournament by ID only (for cases where UUID is specifically needed)
  static async getTournamentById(id: string): Promise<Tournament> {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          users!created_by(username),
          contestants(*),
          rounds(
            *,
            matchups(
              *,
              contestant1:contestants!contestant1_id(*),
              contestant2:contestants!contestant2_id(*),
              winner:contestants!winner_id(*)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Tournament not found');

      return data;
    } catch (error) {
      console.error('Error fetching tournament by ID:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch tournament');
    }
  }

  // Get tournament by slug only
  static async getTournamentBySlug(slug: string): Promise<Tournament> {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          users!created_by(username),
          contestants(*),
          rounds(
            *,
            matchups(
              *,
              contestant1:contestants!contestant1_id(*),
              contestant2:contestants!contestant2_id(*),
              winner:contestants!winner_id(*)
            )
          )
        `)
        .eq('slug', slug)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Tournament not found');

      return data;
    } catch (error) {
      console.error('Error fetching tournament by slug:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch tournament');
    }
  }

  // Create new tournament
  static async createTournament(tournamentData: CreateTournamentData): Promise<Tournament> {
    try {
      console.log('🏪 TournamentService.createTournament called with:', tournamentData);
      
      console.log('🔐 Getting authenticated user...');
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.log('❌ No authenticated user found');
        throw new Error('User not authenticated');
      }
      console.log('✅ User authenticated:', user.user.id);

      console.log('🔐 Checking admin status...');
      const isAdminUser = await AdminService.isAdmin();
      if (!isAdminUser) {
        console.log('❌ User is not an admin');
        throw new Error('Unauthorized: Only administrators can create tournaments');
      }
      console.log('✅ Admin access confirmed');

      // Use new column names (start_date, end_date) with fallback to old names if migration not applied
      const insertData = {
        name: tournamentData.name,
        description: tournamentData.description,
        image_url: tournamentData.image_url,
        start_date: tournamentData.start_date,
        end_date: tournamentData.end_date,
        max_contestants: tournamentData.max_contestants,
        bracket_type: tournamentData.bracket_type,
        is_public: tournamentData.is_public,
        quadrant_names: tournamentData.quadrant_names,
        created_by: user.user.id,
      };
      
      console.log('📤 Inserting tournament data:', insertData);

      // Add timeout to prevent infinite hanging
      const insertPromise = supabase
        .from('tournaments')
        .insert([insertData])
        .select('*, users!created_by(username)') // Include slug and user info
        .single();
        
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tournament creation timed out after 30 seconds')), 30000)
      );

      const { data, error } = await Promise.race([insertPromise, timeoutPromise]) as any;

      console.log('📥 Database response - data:', data, 'error:', error);

      if (error) {
        console.log('💥 Database error:', error);
        
        // Handle schema mismatch - try with old column names if migration not applied
        if (error.code === 'PGRST204' && (error.message?.includes('start_date') || error.message?.includes('end_date'))) {
          console.log('🔄 Retrying with legacy column names (tournament_start_date, tournament_end_date)...');
          
          const legacyInsertData = {
            name: tournamentData.name,
            description: tournamentData.description,
            image_url: tournamentData.image_url,
            tournament_start_date: tournamentData.start_date,
            tournament_end_date: tournamentData.end_date,
            max_contestants: tournamentData.max_contestants,
            bracket_type: tournamentData.bracket_type,
            is_public: tournamentData.is_public,
            created_by: user.user.id,
          };

          const { data: legacyData, error: legacyError } = await supabase
            .from('tournaments')
            .insert([legacyInsertData])
            .select('*, users!created_by(username)') // Include slug and user info
            .single();

          if (legacyError) {
            console.log('💥 Legacy retry failed:', legacyError);
            throw legacyError;
          }
          
          console.log('✅ Tournament created with legacy column names');
          return legacyData;
        }
        
        // Handle column doesn't exist error gracefully for quadrant_names
        if (error.code === 'PGRST116' || error.message?.includes('column') || error.message?.includes('quadrant_names')) {
          console.warn('Database schema not updated yet, trying without quadrant_names:', error.message);
          
          // Try creation without quadrant_names
          const basicInsertData = { ...insertData };
          delete basicInsertData.quadrant_names;
          
          const { data: retryData, error: retryError } = await supabase
            .from('tournaments')
            .insert([basicInsertData])
            .select()
            .single();
            
          if (retryError) {
            console.log('💥 Retry failed:', retryError);
            throw retryError;
          }
          
          console.log('⚠️ Tournament created without quadrant_names (database schema needs update)');
          return retryData;
        }
        
        throw error;
      }
      
      console.log('🎉 Tournament created successfully, returning:', data);
      return data;
    } catch (error) {
      console.error('💥 TournamentService.createTournament error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create tournament');
    }
  }

  // Update tournament
  static async updateTournament(
    id: string,
    updates: Partial<CreateTournamentData>
  ): Promise<Tournament> {
    try {
      const updateData: Record<string, any> = {};

      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.image_url !== undefined) updateData.image_url = updates.image_url;
      if (updates.start_date) updateData.start_date = updates.start_date;
      if (updates.end_date !== undefined) updateData.end_date = updates.end_date;
      if (updates.max_contestants) {
        updateData.max_contestants = updates.max_contestants;
      }
      if (updates.bracket_type) updateData.bracket_type = updates.bracket_type;
      if (updates.is_public !== undefined) updateData.is_public = updates.is_public;
      
      // Add quadrant_names if provided (gracefully handle if column doesn't exist yet)
      if (updates.quadrant_names) {
        updateData.quadrant_names = updates.quadrant_names;
      }

      const { data, error } = await supabase
        .from('tournaments')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        // Handle column doesn't exist error gracefully
        if (error.code === 'PGRST116' || error.message?.includes('column')) {
          console.warn('Database schema not updated yet, some fields may not be saved:', error.message);
          
          // Try update without the problematic fields
          const basicUpdateData = { ...updateData };
          delete basicUpdateData.quadrant_names; // Remove field that doesn't exist yet
          
          const { data: retryData, error: retryError } = await supabase
            .from('tournaments')
            .update(basicUpdateData)
            .eq('id', id)
            .select()
            .single();
            
          if (retryError) throw retryError;
          return retryData;
        }
        throw error;
      }
      return data;
    } catch (error) {
      console.error('Error updating tournament:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update tournament');
    }
  }

  // Delete tournament
  static async deleteTournament(id: string): Promise<void> {
    try {
      const { error } = await supabase.from('tournaments').delete().eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting tournament:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete tournament');
    }
  }

  // Get tournament statistics
  static async getTournamentStats(identifier: string): Promise<any> {
    try {
      const tournamentId = await this.getUuidFromIdentifier(identifier);
      const { data, error } = await supabase.rpc('get_tournament_stats', {
        tournament_uuid: tournamentId,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching tournament stats:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch tournament stats');
    }
  }

  // Get participant performance data (round-by-round stats)
  static async getParticipantPerformance(identifier: string): Promise<any> {
    try {
      const tournamentId = await this.getUuidFromIdentifier(identifier);
      const { data, error } = await supabase.rpc('get_participant_performance', {
        tournament_uuid: tournamentId,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching participant performance:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch participant performance');
    }
  }

  // Get bracket visualization data
  static async getBracketData(identifier: string): Promise<any> {
    try {
      const tournamentId = await this.getUuidFromIdentifier(identifier);
      console.log('Calling get_bracket_data with tournament_uuid:', tournamentId);
      const { data, error } = await supabase.rpc('get_bracket_data', {
        tournament_uuid: tournamentId,
      });

      console.log('Supabase response - data:', data, 'error:', error);
      
      if (error) {
        console.error('Supabase error details:', JSON.stringify(error, null, 2));
        throw error;
      }
      return data;
    } catch (error) {
      console.error('Error fetching bracket data:', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Full error object:', JSON.stringify(error, null, 2));
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch bracket data');
    }
  }

  // Start tournament (generate bracket)
  static async startTournament(identifier: string): Promise<void> {
    try {
      const tournamentId = await this.getUuidFromIdentifier(identifier);

      // First check if tournament can start
      const { data: canStart, error: checkError } = await supabase.rpc('can_start_tournament', {
        tournament_uuid: tournamentId,
      });

      if (checkError) throw checkError;
      if (!canStart) throw new Error('Tournament cannot be started yet');

      // Generate bracket
      const { error } = await supabase.rpc('generate_single_elimination_bracket', {
        tournament_uuid: tournamentId,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error starting tournament:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to start tournament');
    }
  }

  // Update tournament status
  static async updateTournamentStatus(
    id: string,
    status: 'draft' | 'registration' | 'active' | 'completed' | 'cancelled'
  ): Promise<void> {
    try {
      const { data, error, count } = await supabase
        .from('tournaments')
        .update({ status })
        .eq('id', id)
        .select();

      if (error) throw error;
      
      // Check if any rows were actually updated
      if (!data || data.length === 0) {
        // Verify user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('Authentication required. Please log in to manage tournaments.');
        }
        
        // Check if tournament exists and user has permission
        const { data: tournament } = await supabase
          .from('tournaments')
          .select('created_by')
          .eq('id', id)
          .single();
          
        if (!tournament) {
          throw new Error('Tournament not found.');
        }
        
        // Check if user is admin
        const { data: userProfile } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single();
          
        const isAdmin = userProfile?.is_admin || false;
        const isOwner = tournament.created_by === user.id;
        
        if (!isOwner && !isAdmin) {
          throw new Error('Permission denied. You can only manage tournaments you created or if you are an admin.');
        }
        
        throw new Error('Failed to update tournament status. The tournament may be protected by database constraints.');
      }
    } catch (error) {
      console.error('Error updating tournament status:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update tournament status');
    }
  }

  // Reset tournament bracket and voting
  static async resetTournament(identifier: string): Promise<void> {
    try {
      const tournamentId = await this.getUuidFromIdentifier(identifier);
      
      // First, reset the tournament data (clear votes, rounds, etc.)
      const { error: resetError } = await supabase.rpc('reset_tournament_bracket', {
        tournament_uuid: tournamentId,
      });

      if (resetError) throw resetError;

      // Then, regenerate the bracket
      const { error: generateError } = await supabase.rpc('generate_single_elimination_bracket', {
        tournament_uuid: tournamentId,
      });

      if (generateError) throw generateError;
    } catch (error) {
      console.error('Error resetting tournament:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to reset tournament');
    }
  }

  // Get user's tournaments
  static async getUserTournaments(userId: string): Promise<Tournament[]> {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user tournaments:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch user tournaments');
    }
  }

  // Check if user can manage tournament
  static async canManageTournament(tournamentId: string): Promise<boolean> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return false;

      // Check if user is admin
      const { data: userProfile } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.user.id)
        .single();

      if (userProfile?.is_admin) return true;

      // Check if user created the tournament
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('created_by')
        .eq('id', tournamentId)
        .single();

      return tournament?.created_by === user.user.id;
    } catch (error) {
      console.error('Error checking tournament permissions:', error);
      return false;
    }
  }

  // Subscribe to tournament changes
  static subscribeTo(
    tournamentId: string,
    callback: (payload: any) => void
  ): () => void {
    const subscription = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments',
          filter: `id=eq.${tournamentId}`,
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matchups',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        callback
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
}