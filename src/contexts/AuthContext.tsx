import React, { createContext, useContext } from 'react';
import { useAuth as useAuthHook } from '@/hooks/auth/useAuth';
import { User, SignUpData, AuthData, UpdateProfileData } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (credentials: AuthData) => Promise<boolean>;
  signUp: (userData: SignUpData) => Promise<{ success: boolean; needsVerification: boolean }>;
  signOut: () => Promise<boolean>;
  updateProfile: (updates: UpdateProfileData, avatarFile?: File) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  clearError: () => void;
  refresh: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const authHook = useAuthHook();

  return (
    <AuthContext.Provider value={authHook}>
      {children}
    </AuthContext.Provider>
  );
};