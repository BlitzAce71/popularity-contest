import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import AuthErrorBoundary from '@/components/ui/AuthErrorBoundary';
import ErrorRecovery from '@/components/ui/ErrorRecovery';
import Navigation from '@/components/layout/Navigation';
import TournamentList from '@/pages/tournament/TournamentList';
import TournamentDetail from '@/pages/tournament/TournamentDetail';
import CreateTournament from '@/pages/tournament/CreateTournament';
import ManageTournament from '@/pages/tournament/ManageTournament';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import ConnectionTest from '@/components/debug/ConnectionTest';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthErrorBoundary>
          <AuthProvider>
            <Router>
          <div className="min-h-screen bg-gray-50">
            <Navigation />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <ErrorRecovery>
                <Routes>
                  <Route path="/" element={<Navigate to="/tournaments" replace />} />
                  <Route path="/tournaments" element={
                    <ErrorRecovery>
                      <TournamentList />
                    </ErrorRecovery>
                  } />
                  <Route path="/tournaments/create" element={
                    <ErrorRecovery>
                      <CreateTournament />
                    </ErrorRecovery>
                  } />
                  <Route path="/tournaments/:id/manage" element={
                    <ErrorRecovery>
                      <ManageTournament />
                    </ErrorRecovery>
                  } />
                  <Route path="/tournaments/:id" element={
                    <ErrorRecovery>
                      <TournamentDetail />
                    </ErrorRecovery>
                  } />
                  <Route path="/auth/login" element={<LoginPage />} />
                  <Route path="/auth/register" element={<RegisterPage />} />
                  <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/admin" element={
                    <ErrorRecovery>
                      <AdminDashboard />
                    </ErrorRecovery>
                  } />
                  <Route path="/debug" element={<ConnectionTest />} />
                  <Route 
                    path="*" 
                    element={
                      <div className="text-center py-12">
                        <h2 className="text-2xl font-bold text-gray-900">Page Not Found</h2>
                        <p className="mt-2 text-gray-600">
                          The page you're looking for doesn't exist.
                        </p>
                      </div>
                    } 
                  />
                </Routes>
              </ErrorRecovery>
            </main>
          </div>
          </Router>
            </AuthProvider>
          </AuthErrorBoundary>
        </ToastProvider>
      </ErrorBoundary>
  );
};

export default App;