import { supabase, uploadFile, deleteFile, getFileUrl } from '@/lib/supabase';
import type { User, SignUpData, AuthData, UpdateProfileData } from '@/types';

export class AuthService {
  // Local storage keys for persistence
  private static readonly STORAGE_KEYS = {
    SESSION: 'popularity_contest_session',
    USER: 'popularity_contest_user',
    REMEMBER_ME: 'popularity_contest_remember_me'
  };

  // Save session to localStorage
  static saveSessionToStorage(session: any, user: User | null, rememberMe: boolean = false): void {
    try {
      if (!rememberMe) {
        // Use sessionStorage for temporary login
        sessionStorage.setItem(this.STORAGE_KEYS.SESSION, JSON.stringify(session));
        sessionStorage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(user));
        // Clear any persistent storage
        localStorage.removeItem(this.STORAGE_KEYS.SESSION);
        localStorage.removeItem(this.STORAGE_KEYS.USER);
        localStorage.removeItem(this.STORAGE_KEYS.REMEMBER_ME);
      } else {
        // Use localStorage for persistent login
        localStorage.setItem(this.STORAGE_KEYS.SESSION, JSON.stringify(session));
        localStorage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(user));
        localStorage.setItem(this.STORAGE_KEYS.REMEMBER_ME, 'true');
        // Clear session storage
        sessionStorage.removeItem(this.STORAGE_KEYS.SESSION);
        sessionStorage.removeItem(this.STORAGE_KEYS.USER);
      }
    } catch (error) {
      console.error('Error saving session to storage:', error);
    }
  }

  // Load session from localStorage
  static loadSessionFromStorage(): { session: any; user: User | null; rememberMe: boolean } | null {
    try {
      // Check localStorage first (persistent login)
      const persistentSession = localStorage.getItem(this.STORAGE_KEYS.SESSION);
      const persistentUser = localStorage.getItem(this.STORAGE_KEYS.USER);
      const rememberMe = localStorage.getItem(this.STORAGE_KEYS.REMEMBER_ME) === 'true';

      if (persistentSession && persistentUser) {
        return {
          session: JSON.parse(persistentSession),
          user: JSON.parse(persistentUser),
          rememberMe: true
        };
      }

      // Check sessionStorage (temporary login)
      const tempSession = sessionStorage.getItem(this.STORAGE_KEYS.SESSION);
      const tempUser = sessionStorage.getItem(this.STORAGE_KEYS.USER);

      if (tempSession && tempUser) {
        return {
          session: JSON.parse(tempSession),
          user: JSON.parse(tempUser),
          rememberMe: false
        };
      }

      return null;
    } catch (error) {
      console.error('Error loading session from storage:', error);
      return null;
    }
  }

  // Clear stored session
  static clearStoredSession(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEYS.SESSION);
      localStorage.removeItem(this.STORAGE_KEYS.USER);
      localStorage.removeItem(this.STORAGE_KEYS.REMEMBER_ME);
      sessionStorage.removeItem(this.STORAGE_KEYS.SESSION);
      sessionStorage.removeItem(this.STORAGE_KEYS.USER);
    } catch (error) {
      console.error('Error clearing stored session:', error);
    }
  }

  // Check if session is valid (not expired)
  static isSessionValid(session: any): boolean {
    if (!session || !session.expires_at) return false;
    
    const expiresAt = new Date(session.expires_at * 1000); // Convert to milliseconds
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    
    return expiresAt.getTime() > now.getTime() + bufferTime;
  }

  // Restore session from storage
  static async restoreStoredSession(): Promise<{ user: User | null; rememberMe: boolean } | null> {
    try {
      const stored = this.loadSessionFromStorage();
      if (!stored) return null;

      const { session, user, rememberMe } = stored;

      // Check if session is still valid
      if (!this.isSessionValid(session)) {
        console.log('Stored session expired, clearing...');
        this.clearStoredSession();
        return null;
      }

      // Restore session to Supabase
      const { data, error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });

      if (error) {
        console.log('Failed to restore session, clearing stored data:', error.message);
        this.clearStoredSession();
        return null;
      }

      // Verify user profile still exists and is valid
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        this.clearStoredSession();
        return null;
      }

      // Update stored user data if it's different
      if (JSON.stringify(currentUser) !== JSON.stringify(user)) {
        this.saveSessionToStorage(data.session, currentUser, rememberMe);
      }

      return { user: currentUser, rememberMe };
    } catch (error) {
      console.error('Error restoring stored session:', error);
      this.clearStoredSession();
      return null;
    }
  }

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

      // Get user profile and save session with remember me preference
      if (data.session && data.user) {
        const userProfile = await this.getCurrentUser();
        this.saveSessionToStorage(data.session, userProfile, credentials.rememberMe || false);
      }

      return data;
    } catch (error) {
      console.error('Error during sign in:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to sign in');
    }
  }

  // Sign out user
  static async signOut(): Promise<void> {
    try {
      // Clear stored session data first
      this.clearStoredSession();
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error during sign out:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to sign out');
    }
  }

  // Get current user profile with timeout and error handling
  static async getCurrentUser(): Promise<User | null> {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 8000)
      );
      
      const authPromise = supabase.auth.getUser();
      const { data: authUser } = await Promise.race([authPromise, timeoutPromise]);
      
      if (!authUser.user) return null;

      // Add timeout to database query
      const dbTimeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), 5000)
      );
      
      const dbPromise = supabase
        .from('users')
        .select('*')
        .eq('id', authUser.user.id)
        .single();
        
      const { data, error } = await Promise.race([dbPromise, dbTimeoutPromise]);

      if (error) {
        // If user profile doesn't exist, create it as fallback
        // Note: This should normally be handled by the database trigger,
        // but we keep this as a safety net for edge cases
        if (error.code === 'PGRST116') {
          console.warn('User profile not found, creating as fallback. This may indicate a trigger issue.', {
            userId: authUser.user.id,
            email: authUser.user.email
          });
          return await this.createUserProfile(authUser.user);
        }
        
        // Handle auth errors gracefully
        if (error.message?.includes('JWT') || error.message?.includes('401')) {
          console.warn('Authentication expired, returning null');
          return null;
        }
        
        throw error;
      }

      return data;
    } catch (error) {
      // Don't throw for timeout or auth errors - return null instead
      if (error instanceof Error && (
        error.message.includes('timeout') || 
        error.message.includes('JWT') ||
        error.message.includes('401') ||
        error.message.includes('fetch')
      )) {
        console.warn('Auth request failed, returning null:', error.message);
        return null;
      }
      
      console.error('Error fetching current user:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch user profile');
    }
  }

  // Create user profile (fallback for users who signed up before the trigger was added)
  static async createUserProfile(authUser: import('@supabase/supabase-js').User): Promise<User> {
    try {
      console.log('Creating user profile fallback for:', {
        id: authUser.id,
        email: authUser.email,
        metadata: authUser.user_metadata
      });

      const { data, error } = await supabase
        .from('users')
        .insert([
          {
            id: authUser.id,
            email: authUser.email,
            username: authUser.user_metadata?.username || authUser.user_metadata?.firstName || authUser.email?.split('@')[0] || 'user',
            first_name: authUser.user_metadata?.first_name || authUser.user_metadata?.firstName || '',
            last_name: authUser.user_metadata?.last_name || authUser.user_metadata?.lastName || '',
            is_admin: false,
            can_create_tournaments: false,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error inserting user profile:', error);
        throw error;
      }
      
      console.log('User profile created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create user profile');
    }
  }

  // Update user profile
  static async updateProfile(updates: UpdateProfileData): Promise<User> {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser.user) throw new Error('User not authenticated');

      const updateData: Record<string, any> = {};
      if (updates.username) updateData.username = updates.username;
      if (updates.first_name !== undefined) updateData.first_name = updates.first_name;
      if (updates.last_name !== undefined) updateData.last_name = updates.last_name;

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


  // Delete user account
  static async deleteAccount(): Promise<void> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) throw new Error('User not found');

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

  // Subscribe to auth state changes with error handling
  static onAuthStateChange(callback: (event: string, session: import('@supabase/supabase-js').Session | null) => void): () => void {
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        try {
          callback(event, session);
        } catch (error) {
          console.error('Error in auth state change callback:', error);
        }
      });
      
      return () => {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing from auth changes:', error);
        }
      };
    } catch (error) {
      console.error('Error setting up auth state listener:', error);
      return () => {}; // Return no-op function
    }
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