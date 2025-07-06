import { supabase, uploadFile, deleteFile, getFileUrl } from '@/lib/supabase';
import type { User, SignUpData, AuthData, UpdateProfileData } from '@/types';

export class AuthService {
  // Sign up new user
  static async signUp(userData: SignUpData): Promise<{ user: import('@supabase/supabase-js').User | null; needsVerification: boolean }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            username: userData.username,
            firstName: userData.firstName,
            lastName: userData.lastName,
          },
        },
      });

      if (error) throw error;

      return {
        user: data.user,
        needsVerification: !data.user?.email_confirmed_at,
      };
    } catch (error) {
      console.error('Error during sign up:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create account');
    }
  }

  // Sign in user
  static async signIn(credentials: AuthData): Promise<any> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error during sign in:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to sign in');
    }
  }

  // Sign out user
  static async signOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error during sign out:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to sign out');
    }
  }

  // Get current user profile
  static async getCurrentUser(): Promise<User | null> {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser.user) return null;

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.user.id)
        .single();

      if (error) {
        // If user profile doesn't exist, create it
        if (error.code === 'PGRST116') {
          return await this.createUserProfile(authUser.user);
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching current user:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch user profile');
    }
  }

  // Create user profile (for users who signed up before the trigger was added)
  static async createUserProfile(authUser: import('@supabase/supabase-js').User): Promise<User> {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([
          {
            id: authUser.id,
            email: authUser.email,
            username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'user',
            first_name: authUser.user_metadata?.first_name || '',
            last_name: authUser.user_metadata?.last_name || '',
            avatar_url: authUser.user_metadata?.avatar_url,
            is_admin: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create user profile');
    }
  }

  // Update user profile
  static async updateProfile(
    updates: UpdateProfileData,
    newAvatarFile?: File
  ): Promise<User> {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser.user) throw new Error('User not authenticated');

      const currentUser = await this.getCurrentUser();
      if (!currentUser) throw new Error('User profile not found');

      let avatarUrl = currentUser.avatarUrl;

      // Handle avatar update
      if (newAvatarFile) {
        // Delete old avatar
        if (currentUser.avatarUrl) {
          await this.deleteUserAvatar(currentUser.avatarUrl);
        }
        // Upload new avatar
        avatarUrl = await this.uploadUserAvatar(authUser.user.id, newAvatarFile);
      }

      const updateData: Record<string, any> = {};
      if (updates.username) updateData.username = updates.username;
      if (updates.firstName !== undefined) updateData.first_name = updates.firstName;
      if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
      if (avatarUrl !== currentUser.avatarUrl) updateData.avatar_url = avatarUrl;

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', authUser.user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update profile');
    }
  }

  // Update email
  static async updateEmail(newEmail: string): Promise<void> {
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) throw error;

      // Note: User will need to verify the new email
    } catch (error) {
      console.error('Error updating email:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update email');
    }
  }

  // Update password
  static async updatePassword(newPassword: string): Promise<void> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating password:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update password');
    }
  }

  // Reset password
  static async resetPassword(email: string): Promise<void> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending password reset:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to send password reset email');
    }
  }

  // Confirm password reset
  static async confirmPasswordReset(
    accessToken: string,
    refreshToken: string,
    newPassword: string
  ): Promise<void> {
    try {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) throw sessionError;

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error confirming password reset:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to reset password');
    }
  }

  // Verify email
  static async verifyEmail(token: string, type: string): Promise<void> {
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: type as any,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error verifying email:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to verify email');
    }
  }

  // Upload user avatar
  static async uploadUserAvatar(userId: string, file: File): Promise<string> {
    try {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
      }

      // Validate file size (2MB limit)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        throw new Error('File size too large. Please upload an image smaller than 2MB.');
      }

      // Generate unique filename
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const fileName = `${userId}/avatar_${timestamp}.${fileExtension}`;

      // Upload to Supabase Storage
      await uploadFile('user-avatars', fileName, file, { upsert: true });

      return fileName;
    } catch (error) {
      console.error('Error uploading user avatar:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to upload avatar');
    }
  }

  // Delete user avatar
  static async deleteUserAvatar(avatarPath: string): Promise<void> {
    try {
      await deleteFile('user-avatars', avatarPath);
    } catch (error) {
      console.error('Error deleting user avatar:', error);
      // Don't throw error for avatar deletion failures
    }
  }

  // Get user avatar URL
  static getUserAvatarUrl(avatarPath: string): string {
    return getFileUrl('user-avatars', avatarPath);
  }

  // Delete user account
  static async deleteAccount(): Promise<void> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) throw new Error('User not found');

      // Delete user avatar if exists
      if (currentUser.avatarUrl) {
        await this.deleteUserAvatar(currentUser.avatarUrl);
      }

      // Delete user profile
      const { error: profileError } = await supabase
        .from('users')
        .delete()
        .eq('id', currentUser.id);

      if (profileError) throw profileError;

      // Note: Deleting from auth.users requires admin service role
      // This should typically be done via a secure server endpoint
      console.warn('User profile deleted, but auth record requires server-side deletion');
    } catch (error) {
      console.error('Error deleting account:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete account');
    }
  }

  // Check if username is available
  static async isUsernameAvailable(username: string, currentUserId?: string): Promise<boolean> {
    try {
      let query = supabase
        .from('users')
        .select('id')
        .eq('username', username);

      // Exclude current user when updating
      if (currentUserId) {
        query = query.neq('id', currentUserId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return !data; // Available if no user found
    } catch (error) {
      console.error('Error checking username availability:', error);
      return false; // Assume not available on error
    }
  }

  // Check if email is available
  static async isEmailAvailable(email: string, currentUserId?: string): Promise<boolean> {
    try {
      let query = supabase
        .from('users')
        .select('id')
        .eq('email', email);

      // Exclude current user when updating
      if (currentUserId) {
        query = query.neq('id', currentUserId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return !data; // Available if no user found
    } catch (error) {
      console.error('Error checking email availability:', error);
      return false; // Assume not available on error
    }
  }

  // Get user activity summary
  static async getUserActivity(userId?: string): Promise<any> {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      const targetUserId = userId || authUser.user?.id;

      if (!targetUserId) throw new Error('User not specified');

      // Get tournaments created
      const { data: tournaments } = await supabase
        .from('tournaments')
        .select('id, name, status, created_at')
        .eq('created_by', targetUserId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get recent votes
      const { data: votes } = await supabase
        .from('votes')
        .select(`
          created_at,
          matchups(
            id,
            tournaments(name)
          )
        `)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(10);

      // Get vote count
      const { count: totalVotes } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId);

      return {
        tournaments: tournaments || [],
        recentVotes: votes || [],
        totalVotes: totalVotes || 0,
        memberSince: authUser.user?.created_at,
      };
    } catch (error) {
      console.error('Error fetching user activity:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch user activity');
    }
  }

  // Subscribe to auth state changes
  static onAuthStateChange(callback: (event: string, session: import('@supabase/supabase-js').Session | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    
    return () => {
      subscription.unsubscribe();
    };
  }

  // Refresh session
  static async refreshSession(): Promise<void> {
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) throw error;
    } catch (error) {
      console.error('Error refreshing session:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to refresh session');
    }
  }

  // Get session
  static async getSession(): Promise<any> {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }
}