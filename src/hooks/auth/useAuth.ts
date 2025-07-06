import { useState, useEffect, useCallback, useRef } from 'react';
import { AuthService } from '@/services/auth';
import { User, SignUpData, AuthData, UpdateProfileData } from '@/types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const initializeAttempted = useRef(false);
  const authStateListener = useRef<(() => void) | null>(null);
  
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;

  // Initialize auth state with circuit breaker and stored session restoration
  const initializeAuth = useCallback(async () => {
    if (initializeAttempted.current && retryCount >= MAX_RETRIES) {
      console.warn('Auth initialization max retries exceeded');
      setLoading(false);
      setError('Authentication service temporarily unavailable');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // First, try to restore stored session
      let currentUser: User | null = null;
      
      try {
        const restored = await AuthService.restoreStoredSession();
        if (restored) {
          currentUser = restored.user;
          console.log('Session restored from storage');
        }
      } catch (err) {
        console.log('Failed to restore stored session, falling back to normal auth check');
      }
      
      // If no stored session, try normal auth check
      if (!currentUser) {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth timeout')), 10000)
        );
        
        const authPromise = AuthService.getCurrentUser();
        currentUser = await Promise.race([authPromise, timeoutPromise]) as User | null;
      }
      
      setUser(currentUser);
      setRetryCount(0); // Reset on success
      initializeAttempted.current = true;
    } catch (err) {
      console.error('Auth initialization error:', err);
      setUser(null);
      
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying auth initialization (${retryCount + 1}/${MAX_RETRIES})`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => initializeAuth(), RETRY_DELAY * (retryCount + 1));
        return;
      } else {
        setError('Failed to initialize authentication');
      }
    } finally {
      if (retryCount >= MAX_RETRIES) {
        setLoading(false);
      }
    }
  }, [retryCount]);

  useEffect(() => {
    let mounted = true;
    
    const setupAuth = async () => {
      if (!mounted) return;
      
      // Initialize auth only once
      if (!initializeAttempted.current) {
        await initializeAuth();
      }

      // Listen for auth state changes with error handling
      if (!authStateListener.current && mounted) {
        try {
          authStateListener.current = AuthService.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            
            try {
              if (event === 'SIGNED_IN' && session) {
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Auth timeout')), 5000)
                );
                
                const authPromise = AuthService.getCurrentUser();
                const currentUser = await Promise.race([authPromise, timeoutPromise]) as User | null;
                
                if (mounted) {
                  setUser(currentUser);
                  setError(null);
                }
              } else if (event === 'SIGNED_OUT') {
                if (mounted) {
                  setUser(null);
                  setError(null);
                }
              }
            } catch (err) {
              console.error('Error in auth state change:', err);
              if (mounted) {
                setError('Authentication error occurred');
              }
            } finally {
              if (mounted) {
                setLoading(false);
              }
            }
          });
        } catch (err) {
          console.error('Error setting up auth listener:', err);
          if (mounted) {
            setError('Failed to setup authentication');
            setLoading(false);
          }
        }
      }
    };

    setupAuth();

    return () => {
      mounted = false;
      if (authStateListener.current) {
        try {
          authStateListener.current();
          authStateListener.current = null;
        } catch (err) {
          console.error('Error cleaning up auth listener:', err);
        }
      }
    };
  }, [initializeAuth]);

  // Sign up
  const signUp = async (userData: SignUpData): Promise<{ success: boolean; needsVerification: boolean }> => {
    try {
      setLoading(true);
      setError(null);

      const result = await AuthService.signUp(userData);
      
      if (!result.needsVerification) {
        // Auto-fetch user profile if email is already confirmed
        const currentUser = await AuthService.getCurrentUser();
        setUser(currentUser);
      }

      return { success: true, needsVerification: result.needsVerification };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account';
      setError(errorMessage);
      return { success: false, needsVerification: false };
    } finally {
      setLoading(false);
    }
  };

  // Sign in
  const signIn = async (credentials: AuthData): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      await AuthService.signIn(credentials);
      const currentUser = await AuthService.getCurrentUser();
      setUser(currentUser);
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      await AuthService.signOut();
      setUser(null);
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign out';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Update profile
  const updateProfile = async (updates: UpdateProfileData, avatarFile?: File): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const updatedUser = await AuthService.updateProfile(updates, avatarFile);
      setUser(updatedUser);
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Clear error and reset retry count
  const clearError = () => {
    setError(null);
    setRetryCount(0);
  };

  // Reset password
  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      await AuthService.resetPassword(email);
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Refresh user data
  const refresh = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      console.error('Error refreshing user:', err);
    }
  };

  return {
    user,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    clearError,
    refresh,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin || false,
  };
};

export const useUserValidation = () => {
  const [checking, setChecking] = useState(false);

  const checkUsernameAvailability = async (username: string, currentUserId?: string): Promise<boolean> => {
    try {
      setChecking(true);
      return await AuthService.isUsernameAvailable(username, currentUserId);
    } catch (err) {
      return false;
    } finally {
      setChecking(false);
    }
  };

  const checkEmailAvailability = async (email: string, currentUserId?: string): Promise<boolean> => {
    try {
      setChecking(true);
      return await AuthService.isEmailAvailable(email, currentUserId);
    } catch (err) {
      return false;
    } finally {
      setChecking(false);
    }
  };

  return {
    checking,
    checkUsernameAvailability,
    checkEmailAvailability,
  };
};

export const useUserActivity = (userId?: string) => {
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await AuthService.getUserActivity(userId);
      setActivity(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user activity');
      setActivity(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, [userId]);

  const refresh = () => {
    fetchActivity();
  };

  return {
    activity,
    loading,
    error,
    refresh,
  };
};

export const usePasswordReset = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const sendResetEmail = async (email: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      await AuthService.resetPassword(email);
      setSuccess(true);
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (
    accessToken: string,
    refreshToken: string,
    newPassword: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      await AuthService.confirmPasswordReset(accessToken, refreshToken, newPassword);
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset password';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearState = () => {
    setError(null);
    setSuccess(false);
  };

  return {
    loading,
    error,
    success,
    sendResetEmail,
    confirmReset,
    clearState,
  };
};

export const useEmailVerification = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const verifyEmail = async (token: string, type: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      await AuthService.verifyEmail(token, type);
      setSuccess(true);
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify email';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearState = () => {
    setError(null);
    setSuccess(false);
  };

  return {
    loading,
    error,
    success,
    verifyEmail,
    clearState,
  };
};