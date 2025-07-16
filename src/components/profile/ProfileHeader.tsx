import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { UserProfileData } from '@/services/profile';
import { Calendar, Trophy, Users, Vote, Crown, Shield } from 'lucide-react';

interface ProfileHeaderProps {
  profileData: UserProfileData;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ profileData }) => {
  const { user, stats } = profileData;
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getUserRole = () => {
    if (user.is_admin) return { label: 'Administrator', icon: Crown, color: 'text-purple-600' };
    if (user.can_create_tournaments) return { label: 'Tournament Creator', icon: Shield, color: 'text-blue-600' };
    return { label: 'Participant', icon: Users, color: 'text-green-600' };
  };

  const role = getUserRole();
  const RoleIcon = role.icon;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* User Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-primary-600">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{user.username}</h2>
                <p className="text-gray-600">{user.first_name} {user.last_name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <RoleIcon className={`w-4 h-4 ${role.color}`} />
                  <span className={`text-sm font-medium ${role.color}`}>
                    {role.label}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              <span>Joined {formatDate(stats.joinDate)}</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-blue-100 rounded-lg">
                <Trophy className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.tournamentsCreated}</div>
              <div className="text-xs text-gray-500">Created</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-green-100 rounded-lg">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.tournamentsParticipated}</div>
              <div className="text-xs text-gray-500">Participated</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-purple-100 rounded-lg">
                <Vote className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalVotes}</div>
              <div className="text-xs text-gray-500">Total Votes</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-orange-100 rounded-lg">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{Math.round(stats.completionRate)}%</div>
              <div className="text-xs text-gray-500">Completion</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileHeader;