import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileService, type UserProfileData } from '@/services/profile';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ActivityDashboard from '@/components/profile/ActivityDashboard';
import VotingHistory from '@/components/profile/VotingHistory';
import TournamentManagement from '@/components/profile/TournamentManagement';
import AccountSettings from '@/components/profile/AccountSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Activity, History, Settings, Trophy } from 'lucide-react';

const ProfilePage: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !authLoading) {
      loadProfile();
    }
  }, [user, authLoading]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ProfileService.getUserProfile();
      setProfileData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
        <p className="text-gray-600">You need to be logged in to view your profile.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={loadProfile}
          className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h2>
        <p className="text-gray-600">Unable to load profile data.</p>
      </div>
    );
  }

  const canCreateTournaments = user.is_admin || user.can_create_tournaments;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile</h1>
        <p className="text-gray-600">Manage your account and view your tournament activity</p>
      </div>

      <ProfileHeader profileData={profileData} />

      <Tabs defaultValue="activity" className="mt-8">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
          {canCreateTournaments && (
            <TabsTrigger value="tournaments" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              My Tournaments
            </TabsTrigger>
          )}
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-6">
          <ActivityDashboard profileData={profileData} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <VotingHistory />
        </TabsContent>

        {canCreateTournaments && (
          <TabsContent value="tournaments" className="mt-6">
            <TournamentManagement 
              tournaments={profileData.createdTournaments || []}
              onRefresh={loadProfile}
            />
          </TabsContent>
        )}

        <TabsContent value="settings" className="mt-6">
          <AccountSettings 
            user={profileData.user}
            onUpdate={loadProfile}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfilePage;