import { supabase, uploadFile, deleteFile, getFileUrl } from '@/lib/supabase';
import type { Contestant, CreateContestantData } from '@/types';

export class ContestantService {
  // Get contestants for a tournament
  static async getContestants(tournamentId: string): Promise<Contestant[]> {
    try {
      const { data, error } = await supabase
        .from('contestants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('is_active', true)
        .order('seed');

      if (error) throw error;
      
      // Convert image paths to full URLs
      const contestants = (data || []).map(contestant => ({
        ...contestant,
        image_url: contestant.image_url ? this.getContestantImageUrl(contestant.image_url) : contestant.image_url
      }));
      
      return contestants;
    } catch (error) {
      console.error('Error fetching contestants:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch contestants');
    }
  }

  // Get single contestant
  static async getContestant(id: string): Promise<Contestant> {
    try {
      const { data, error } = await supabase
        .from('contestants')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Contestant not found');

      // Convert image path to full URL
      const contestant = {
        ...data,
        image_url: data.image_url ? this.getContestantImageUrl(data.image_url) : data.image_url
      };

      return contestant;
    } catch (error) {
      console.error('Error fetching contestant:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch contestant');
    }
  }

  // Create new contestant
  static async createContestant(
    tournamentId: string,
    contestantData: CreateContestantData,
    imageFile?: File
  ): Promise<Contestant> {
    try {
      let imageUrl: string | undefined;

      // Upload image if provided
      if (imageFile) {
        imageUrl = await this.uploadContestantImage(tournamentId, imageFile);
      }

      // Validate and handle seed conflicts per quadrant
      let finalSeed = contestantData.seed;
      let finalQuadrant = contestantData.quadrant || 1;
      
      // Check if the seed is already taken in this quadrant
      const { data: existingWithSameSeed } = await supabase
        .from('contestants')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('seed', finalSeed)
        .eq('quadrant', finalQuadrant)
        .eq('is_active', true);

      if (existingWithSameSeed && existingWithSameSeed.length > 0) {
        // Find the next available seed in this quadrant
        const { data: quadrantSeeds } = await supabase
          .from('contestants')
          .select('seed')
          .eq('tournament_id', tournamentId)
          .eq('quadrant', finalQuadrant)
          .eq('is_active', true)
          .order('seed', { ascending: true });

        const usedSeeds = new Set((quadrantSeeds || []).map(c => c.seed));
        finalSeed = 1;
        while (usedSeeds.has(finalSeed)) {
          finalSeed++;
        }
        
        console.warn(`Seed ${contestantData.seed} was taken in quadrant ${finalQuadrant}, assigned seed ${finalSeed} instead`);
      }

      // Prepare insert data with quadrant (will be added to database soon)
      const insertData: any = {
        tournament_id: tournamentId,
        name: contestantData.name,
        description: contestantData.description,
        image_url: imageUrl,
        seed: finalSeed,
      };

      // Add quadrant if provided (handle gracefully if column doesn't exist yet)
      if (finalQuadrant) {
        insertData.quadrant = finalQuadrant;
      }

      const { data, error } = await supabase
        .from('contestants')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        // Handle column doesn't exist error gracefully
        if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('quadrant')) {
          console.warn('Quadrant column not ready yet, creating without quadrant:', error.message);
          
          // Try insert without quadrant field
          const basicInsertData = { ...insertData };
          delete basicInsertData.quadrant;
          
          const { data: retryData, error: retryError } = await supabase
            .from('contestants')
            .insert([basicInsertData])
            .select()
            .single();
            
          if (retryError) {
            if (imageUrl) await this.deleteContestantImage(imageUrl);
            throw retryError;
          }
          
          // Convert image path to full URL before returning
          const contestant = {
            ...retryData,
            image_url: retryData.image_url ? this.getContestantImageUrl(retryData.image_url) : retryData.image_url,
            quadrant: finalQuadrant // Add quadrant info for UI even if not in DB yet
          };
          
          return contestant;
        }
        
        // Clean up uploaded image if contestant creation failed
        if (imageUrl) {
          await this.deleteContestantImage(imageUrl);
        }
        throw error;
      }

      // Convert image path to full URL before returning
      const contestant = {
        ...data,
        image_url: data.image_url ? this.getContestantImageUrl(data.image_url) : data.image_url
      };

      return contestant;
    } catch (error) {
      console.error('Error creating contestant:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create contestant');
    }
  }

  // Update contestant
  static async updateContestant(
    id: string,
    updates: Partial<CreateContestantData>,
    newImageFile?: File
  ): Promise<Contestant> {
    try {
      // Get current contestant data
      const currentContestant = await this.getContestant(id);
      let imageUrl = currentContestant.image_url;

      // Handle image update
      if (newImageFile) {
        // Delete old image
        if (currentContestant.image_url) {
          await this.deleteContestantImage(currentContestant.image_url);
        }
        // Upload new image
        imageUrl = await this.uploadContestantImage(currentContestant.tournament_id, newImageFile);
      }

      const updateData: Record<string, any> = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (imageUrl !== currentContestant.image_url) updateData.image_url = imageUrl;

      // Handle seed and quadrant updates with conflict checking
      if (updates.seed !== undefined || updates.quadrant !== undefined) {
        const newSeed = updates.seed !== undefined ? updates.seed : currentContestant.seed;
        const newQuadrant = updates.quadrant !== undefined ? updates.quadrant : (currentContestant.quadrant || 1);

        // Check for seed conflicts in the target quadrant (excluding current contestant)
        const { data: existingWithSameSeed } = await supabase
          .from('contestants')
          .select('id')
          .eq('tournament_id', currentContestant.tournament_id)
          .eq('seed', newSeed)
          .eq('quadrant', newQuadrant)
          .eq('is_active', true)
          .neq('id', id);

        if (existingWithSameSeed && existingWithSameSeed.length > 0) {
          throw new Error(`Seed ${newSeed} is already taken in this quadrant`);
        }

        updateData.seed = newSeed;
        if (updates.quadrant !== undefined) {
          updateData.quadrant = newQuadrant;
        }
      }

      const { data, error } = await supabase
        .from('contestants')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        // Handle quadrant column not existing gracefully
        if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('quadrant')) {
          console.warn('Quadrant column not ready yet, updating without quadrant:', error.message);
          
          // Try update without quadrant field
          const basicUpdateData = { ...updateData };
          delete basicUpdateData.quadrant;
          
          const { data: retryData, error: retryError } = await supabase
            .from('contestants')
            .update(basicUpdateData)
            .eq('id', id)
            .select()
            .single();
            
          if (retryError) throw retryError;
          
          // Convert image path to full URL before returning
          const contestant = {
            ...retryData,
            image_url: retryData.image_url ? this.getContestantImageUrl(retryData.image_url) : retryData.image_url,
            quadrant: updates.quadrant || currentContestant.quadrant || 1 // Preserve quadrant info for UI
          };
          
          return contestant;
        }
        
        throw error;
      }
      
      // Convert image path to full URL before returning
      const contestant = {
        ...data,
        image_url: data.image_url ? this.getContestantImageUrl(data.image_url) : data.image_url
      };
      
      return contestant;
    } catch (error) {
      console.error('Error updating contestant:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update contestant');
    }
  }

  // Delete contestant
  static async deleteContestant(id: string): Promise<void> {
    try {
      // Get contestant data to clean up image
      const contestant = await this.getContestant(id);

      // Delete contestant
      const { error } = await supabase.from('contestants').delete().eq('id', id);

      if (error) throw error;

      // Clean up image
      if (contestant.image_url) {
        await this.deleteContestantImage(contestant.image_url);
      }
    } catch (error) {
      console.error('Error deleting contestant:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete contestant');
    }
  }

  // Bulk create contestants
  static async createMultipleContestants(
    tournamentId: string,
    contestants: CreateContestantData[]
  ): Promise<Contestant[]> {
    try {
      // Get starting seed number
      const { data: existingContestants } = await supabase
        .from('contestants')
        .select('seed')
        .eq('tournament_id', tournamentId)
        .order('seed', { ascending: false })
        .limit(1);

      let nextSeed = existingContestants?.[0]?.seed ? existingContestants[0].seed + 1 : 1;

      const contestantData = contestants.map((contestant) => ({
        tournament_id: tournamentId,
        name: contestant.name,
        description: contestant.description,
        seed: nextSeed++,
      }));

      const { data, error } = await supabase
        .from('contestants')
        .insert(contestantData)
        .select();

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error creating multiple contestants:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create contestants');
    }
  }

  // Update contestant seeds (for reordering)
  static async updateContestantSeeds(
    _tournamentId: string,
    seedUpdates: { id: string; seed: number }[]
  ): Promise<void> {
    try {
      const updatePromises = seedUpdates.map(({ id, seed }) =>
        supabase.from('contestants').update({ seed }).eq('id', id)
      );

      const results = await Promise.all(updatePromises);

      for (const result of results) {
        if (result.error) throw result.error;
      }
    } catch (error) {
      console.error('Error updating contestant seeds:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update seeds');
    }
  }

  // Upload contestant image
  static async uploadContestantImage(tournamentId: string, file: File): Promise<string> {
    try {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.');
      }

      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('File size too large. Please upload an image smaller than 5MB.');
      }

      // Generate unique filename
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2);
      const fileName = `${tournamentId}/${timestamp}_${random}.${fileExtension}`;

      // Upload to Supabase Storage
      await uploadFile('contestant-images', fileName, file, { upsert: false });

      // Return the file path (not the full URL - that's handled in getContestantImageUrl)
      return fileName;
    } catch (error) {
      console.error('Error uploading contestant image:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to upload image');
    }
  }

  // Delete contestant image
  static async deleteContestantImage(imagePath: string): Promise<void> {
    try {
      await deleteFile('contestant-images', imagePath);
    } catch (error) {
      console.error('Error deleting contestant image:', error);
      // Don't throw error for image deletion failures
    }
  }

  // Get contestant image URL
  static getContestantImageUrl(imagePath: string): string {
    return getFileUrl('contestant-images', imagePath);
  }

  // Get contestant statistics
  static async getContestantStats(id: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('contestants')
        .select(`
          *,
          matchups_as_contestant1:matchups!contestant1_id(id, status, winner_id),
          matchups_as_contestant2:matchups!contestant2_id(id, status, winner_id)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Calculate additional stats
      const allMatchups = [
        ...(data.matchups_as_contestant1 || []),
        ...(data.matchups_as_contestant2 || []),
      ];

      const completedMatchups = allMatchups.filter((m) => m.status === 'completed');
      const wins = completedMatchups.filter((m) => m.winner_id === id).length;
      const losses = completedMatchups.filter((m) => m.winner_id && m.winner_id !== id).length;

      return {
        ...data,
        total_matchups: allMatchups.length,
        completed_matchups: completedMatchups.length,
        wins,
        losses,
        win_rate: completedMatchups.length > 0 ? (wins / completedMatchups.length) * 100 : 0,
      };
    } catch (error) {
      console.error('Error fetching contestant stats:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch contestant stats');
    }
  }

  // Seed contestants (set tournament seeding)
  static async seedContestants(
    _tournamentId: string,
    seedings: { id: string; seed: number }[]
  ): Promise<void> {
    try {
      const updatePromises = seedings.map(({ id, seed }) =>
        supabase.from('contestants').update({ seed }).eq('id', id)
      );

      const results = await Promise.all(updatePromises);

      for (const result of results) {
        if (result.error) throw result.error;
      }
    } catch (error) {
      console.error('Error seeding contestants:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to seed contestants');
    }
  }

  // Auto-generate seeding based on some criteria (e.g., random, alphabetical)
  static async autoSeedContestants(
    tournamentId: string,
    method: 'random' | 'alphabetical' | 'reverse-alphabetical' = 'random'
  ): Promise<void> {
    try {
      const contestants = await this.getContestants(tournamentId);

      let sortedContestants: Contestant[];
      switch (method) {
        case 'alphabetical':
          sortedContestants = [...contestants].sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'reverse-alphabetical':
          sortedContestants = [...contestants].sort((a, b) => b.name.localeCompare(a.name));
          break;
        case 'random':
        default:
          sortedContestants = [...contestants].sort(() => Math.random() - 0.5);
          break;
      }

      const seedings = sortedContestants.map((contestant, index) => ({
        id: contestant.id,
        seed: index + 1,
      }));

      await this.seedContestants(tournamentId, seedings);
    } catch (error) {
      console.error('Error auto-seeding contestants:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to auto-seed contestants');
    }
  }

  // Generate dummy contestants with quadrant/seed naming (A1, A2, B1, B2, etc.)
  static async generateDummyContestants(
    tournamentId: string,
    maxContestants: number,
    quadrantNames?: [string, string, string, string]
  ): Promise<Contestant[]> {
    try {
      console.log(`🤖 Generating ${maxContestants} dummy contestants for tournament ${tournamentId}`);
      
      // Default quadrant names if not provided
      const defaultQuadrantNames: [string, string, string, string] = ['A', 'B', 'C', 'D'];
      const quadrants = quadrantNames || defaultQuadrantNames;
      
      // Calculate contestants per quadrant
      const contestantsPerQuadrant = Math.ceil(maxContestants / 4);
      
      const dummyContestants: CreateContestantData[] = [];
      
      for (let quadrantIndex = 0; quadrantIndex < 4; quadrantIndex++) {
        const quadrantLetter = quadrants[quadrantIndex].charAt(0).toUpperCase();
        const quadrantNumber = quadrantIndex + 1;
        
        // Generate contestants for this quadrant
        for (let seed = 1; seed <= contestantsPerQuadrant && dummyContestants.length < maxContestants; seed++) {
          dummyContestants.push({
            name: `${quadrantLetter}${seed}`,
            description: `Dummy contestant for ${quadrants[quadrantIndex]} quadrant, seed ${seed}`,
            seed: seed,
            quadrant: quadrantNumber
          });
        }
      }
      
      console.log(`📋 Generated ${dummyContestants.length} dummy contestants`);
      
      // Create all contestants using the bulk creation method
      const insertData = dummyContestants.map((contestant, index) => ({
        tournament_id: tournamentId,
        name: contestant.name,
        description: contestant.description,
        seed: index + 1, // Sequential seeding for now
        quadrant: contestant.quadrant,
      }));

      const { data, error } = await supabase
        .from('contestants')
        .insert(insertData)
        .select();

      if (error) {
        // Handle quadrant column not existing gracefully
        if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('quadrant')) {
          console.warn('Quadrant column not ready yet, creating without quadrant:', error.message);
          
          // Try insert without quadrant field
          const basicInsertData = insertData.map(({ quadrant, ...rest }) => rest);
          
          const { data: retryData, error: retryError } = await supabase
            .from('contestants')
            .insert(basicInsertData)
            .select();
            
          if (retryError) throw retryError;
          
          console.log(`✅ Created ${retryData?.length || 0} dummy contestants (without quadrant info)`);
          return retryData || [];
        }
        
        throw error;
      }

      console.log(`✅ Created ${data?.length || 0} dummy contestants with quadrant info`);
      return data || [];
    } catch (error) {
      console.error('Error generating dummy contestants:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to generate dummy contestants');
    }
  }

  // Check if user can manage contestants for this tournament
  static async canManageContestants(tournamentId: string): Promise<boolean> {
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
      console.error('Error checking contestant permissions:', error);
      return false;
    }
  }
}