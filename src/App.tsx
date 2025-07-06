import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import Navigation from '@/components/layout/Navigation';
import TournamentList from '@/pages/tournament/TournamentList';
import TournamentDetail from '@/pages/tournament/TournamentDetail';
import CreateTournament from '@/pages/tournament/CreateTournament';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import ConnectionTest from '@/components/debug/ConnectionTest';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <Router>
          <div className="min-h-screen bg-gray-50">
            <Navigation />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <Routes>
                <Route path="/" element={<Navigate to="/tournaments" replace />} />
                <Route path="/tournaments" element={<TournamentList />} />
                <Route path="/tournaments/create" element={<CreateTournament />} />
                <Route path="/tournaments/:id" element={<TournamentDetail />} />
                <Route path="/auth/login" element={<LoginPage />} />
                <Route path="/auth/register" element={<RegisterPage />} />
                <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/admin" element={<AdminDashboard />} />
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
            </main>
          </div>
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;