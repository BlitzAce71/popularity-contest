import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin, useAdminDashboard, useUserAdmin } from '@/hooks/admin/useAdmin';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { getSettings, saveSettings } from '@/utils/settings';
import { 
  Users, 
  Trophy, 
  BarChart3, 
  Settings, 
  Shield, 
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { dashboardData, loading: dashboardLoading, error: dashboardError, refresh: refreshDashboard } = useAdminDashboard();
  const { users, loading: usersLoading, error: usersError, deleteUser, updateUserAdminStatus, updateUserTournamentCreatorStatus, refresh: refreshUsers } = useUserAdmin();
  const [activeTab, setActiveTab] = useState<'overview' | 'tournaments' | 'users' | 'settings'>('overview');
  
  // Settings state using the new settings utility
  const [settingsData, setSettingsData] = useState(getSettings());
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{type: 'success' | 'error' | 'warning', text: string} | null>(null);
  
  // User management state
  const [userMessage, setUserMessage] = useState<{type: 'success' | 'error' | 'warning', text: string} | null>(null);

  // Load settings from localStorage on component mount
  React.useEffect(() => {
    setSettingsData(getSettings());
  }, []);

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user? This action cannot be undone.')) {
      return;
    }

    setUserMessage(null);
    const result = await deleteUser(userId);
    
    if (result.success) {
      if (result.warning) {
        setUserMessage({ type: 'warning', text: result.warning });
      } else {
        setUserMessage({ type: 'success', text: 'User removed successfully.' });
      }
      // Clear message after 5 seconds for warnings, 3 seconds for success
      setTimeout(() => setUserMessage(null), result.warning ? 5000 : 3000);
    }
    // Error messages are handled by the hook
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsMessage(null);

    try {
      // Use the new settings utility which triggers navigation update
      saveSettings(settingsData);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSettingsMessage({ type: 'success', text: 'Settings saved successfully!' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setSettingsMessage(null), 3000);
    } catch (error) {
      setSettingsMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSettingsSaving(false);
    }
  };

  if (!user?.is_admin) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">You don't have permission to access the admin dashboard.</p>
      </div>
    );
  }

  if (dashboardLoading && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Dashboard</h2>
        <p className="text-gray-600 mb-4">{dashboardError}</p>
        <Button onClick={() => refreshDashboard()}>
          Try Again
        </Button>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Users</p>
              <p className="text-2xl font-semibold text-gray-900">{dashboardData?.total_users || 0}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Trophy className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Tournaments</p>
              <p className="text-2xl font-semibold text-gray-900">{dashboardData?.total_tournaments || 0}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Activity className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Tournaments</p>
              <p className="text-2xl font-semibold text-gray-900">{dashboardData?.active_tournaments || 0}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Votes</p>
              <p className="text-2xl font-semibold text-gray-900">{dashboardData?.total_votes || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {dashboardData?.recent_activity?.map((activity, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Activity className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-900">{activity.description}</p>
                <p className="text-xs text-gray-500">{new Date(activity.timestamp).toLocaleString()}</p>
              </div>
            </div>
          )) || (
            <p className="text-gray-500 text-center py-4">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderTournaments = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Tournament Management</h3>
        <Link to="/tournaments/create">
          <Button size="sm">Create Tournament</Button>
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tournament
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Participants
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dashboardData?.tournaments?.map((tournament) => (
                <tr key={tournament.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{tournament.name}</div>
                      <div className="text-sm text-gray-500">{tournament.description}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      tournament.status === 'active' 
                        ? 'bg-green-100 text-green-800'
                        : tournament.status === 'completed'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {tournament.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tournament.current_contestants}/{tournament.max_contestants}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(tournament.created_at).toLocaleDateString()}
                  </td>
                </tr>
              )) || (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    No tournaments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
      </div>

      {userMessage && (
        <div className={`p-4 rounded-md ${
          userMessage.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800'
            : userMessage.type === 'warning'
            ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {userMessage.text}
        </div>
      )}

      {usersError && (
        <div className="p-4 rounded-md bg-red-50 border border-red-200 text-red-800">
          {usersError}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Participation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users?.map((userData) => (
                <tr key={userData.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-600 font-medium text-sm">
                            {userData.username.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{userData.username}</div>
                        <div className="text-sm text-gray-500">{userData.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full w-fit ${
                        userData.is_admin 
                          ? 'bg-red-100 text-red-800'
                          : userData.is_moderator
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {userData.is_admin ? 'Admin' : userData.is_moderator ? 'Moderator' : 'User'}
                      </span>
                      {userData.can_create_tournaments && !userData.is_admin && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 w-fit">
                          Tournament Creator
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {userData.tournaments_count || 0} tournament{(userData.tournaments_count || 0) !== 1 ? 's' : ''}
                    </div>
                    <div className="text-sm text-gray-500">
                      {userData.total_votes || 0} votes cast
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {userData.last_activity ? (
                        <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400 mr-1" />
                      )}
                      <div className="text-sm text-gray-500">
                        {userData.last_activity ? (
                          <>
                            Last vote: {new Date(userData.last_activity).toLocaleDateString()}
                          </>
                        ) : (
                          'No activity'
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center gap-2 justify-end flex-wrap">
                      {userData.is_admin ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateUserAdminStatus(userData.id, false)}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          Remove Admin
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateUserAdminStatus(userData.id, true)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          Make Admin
                        </Button>
                      )}
                      
                      {!userData.is_admin && (
                        userData.can_create_tournaments ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateUserTournamentCreatorStatus(userData.id, false)}
                            className="text-yellow-600 hover:text-yellow-700"
                          >
                            Remove Creator
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateUserTournamentCreatorStatus(userData.id, true)}
                            className="text-green-600 hover:text-green-700"
                          >
                            Make Creator
                          </Button>
                        )
                      )}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteUser(userData.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              )) || (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => {


    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">System Settings</h3>
        
        {settingsMessage && (
          <div className={`p-4 rounded-md ${
            settingsMessage.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800'
              : settingsMessage.type === 'warning'
              ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {settingsMessage.text}
          </div>
        )}
        
        <form onSubmit={handleSettingsSubmit}>
          <div className="card p-6 space-y-8">
            {/* General Settings */}
            <div>
              <h4 className="text-base font-medium text-gray-900 mb-4">General Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Site Name</label>
                  <input
                    type="text"
                    value={settingsData.siteName}
                    onChange={(e) => setSettingsData(prev => ({ ...prev, siteName: e.target.value }))}
                    className="input-field"
                    placeholder="Enter site name"
                    disabled={settingsSaving}
                  />
                  <p className="text-xs text-gray-500 mt-1">This name appears in the browser title and navigation</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Default Tournament Format</label>
                  <input
                    value="Single Elimination"
                    readOnly
                    className="input-field bg-gray-50 text-gray-900"
                    disabled={settingsSaving}
                  />
                  <p className="text-xs text-gray-500 mt-1">Default format for new tournaments</p>
                </div>
              </div>
            </div>

            {/* User Registration Settings */}
            <div>
              <h4 className="text-base font-medium text-gray-900 mb-4">User Registration</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Allow Public Registration</p>
                    <p className="text-xs text-gray-500">Let users sign up without invitation</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={settingsData.allowPublicRegistration}
                    onChange={(e) => setSettingsData(prev => ({ ...prev, allowPublicRegistration: e.target.checked }))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    disabled={settingsSaving}
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Require Email Verification</p>
                    <p className="text-xs text-gray-500">Users must verify email before participating</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={settingsData.requireEmailVerification}
                    onChange={(e) => setSettingsData(prev => ({ ...prev, requireEmailVerification: e.target.checked }))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    disabled={settingsSaving}
                  />
                </div>
              </div>
            </div>

            {/* Single Save Button */}
            <div className="pt-6 border-t">
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={settingsSaving}
                  className="flex items-center gap-2"
                >
                  {settingsSaving ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Saving...
                    </>
                  ) : (
                    'Save All Settings'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Manage tournaments, users, and system settings</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'tournaments', label: 'Tournaments', icon: Trophy },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'overview' && (
          <ErrorBoundary fallback={
            <div className="text-center py-12">
              <p className="text-red-600">Failed to load overview data</p>
              <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
                Refresh Dashboard
              </Button>
            </div>
          }>
            {renderOverview()}
          </ErrorBoundary>
        )}
        {activeTab === 'tournaments' && (
          <ErrorBoundary fallback={
            <div className="text-center py-12">
              <p className="text-red-600">Failed to load tournament data</p>
              <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
                Refresh Dashboard
              </Button>
            </div>
          }>
            {renderTournaments()}
          </ErrorBoundary>
        )}
        {activeTab === 'users' && (
          <ErrorBoundary fallback={
            <div className="text-center py-12">
              <p className="text-red-600">Failed to load user data</p>
              <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
                Refresh Dashboard
              </Button>
            </div>
          }>
            {renderUsers()}
          </ErrorBoundary>
        )}
        {activeTab === 'settings' && (
          <ErrorBoundary fallback={
            <div className="text-center py-12">
              <p className="text-red-600">Failed to load settings</p>
              <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
                Refresh Dashboard
              </Button>
            </div>
          }>
            {renderSettings()}
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;