import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserProfileData } from '@/services/profile';
import { Trophy, Users, Calendar, ExternalLink } from 'lucide-react';

interface ActivityDashboardProps {
  profileData: UserProfileData;
}

const ActivityDashboard: React.FC<ActivityDashboardProps> = ({ profileData }) => {
  const { recentActivity } = profileData;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'registration':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role: 'creator' | 'participant') => {
    return role === 'creator' ? Trophy : Users;
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Recent Tournament Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Recent Tournament Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.tournaments.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.tournaments.map((tournament) => {
                const RoleIcon = getRoleIcon(tournament.role);
                return (
                  <div key={tournament.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <RoleIcon className="w-4 h-4 text-gray-500" />
                      <div>
                        <div className="font-medium text-gray-900">{tournament.name}</div>
                        <div className="text-sm text-gray-500 capitalize">
                          {tournament.role} • {formatDate(tournament.lastActivity)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(tournament.status)}`}>
                        {tournament.status}
                      </span>
                      <Link 
                        to={`/tournaments/${tournament.id}`}
                        className="text-primary-600 hover:text-primary-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
              {recentActivity.tournaments.length === 0 && (
                <p className="text-gray-500 text-center py-4">No recent tournament activity</p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No tournament activity yet</p>
              <Link 
                to="/tournaments" 
                className="text-primary-600 hover:text-primary-700 text-sm mt-2 inline-block"
              >
                Browse tournaments to get started
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Voting Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Recent Votes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.votes.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.votes.slice(0, 5).map((vote) => (
                <div key={vote.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{vote.contestantName}</div>
                    <div className="text-sm text-gray-500">
                      in {vote.tournamentName}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDate(vote.votedAt)}
                  </div>
                </div>
              ))}
              {recentActivity.votes.length > 5 && (
                <div className="text-center pt-2">
                  <span className="text-sm text-gray-500">
                    +{recentActivity.votes.length - 5} more votes
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No votes cast yet</p>
              <Link 
                to="/tournaments" 
                className="text-primary-600 hover:text-primary-700 text-sm mt-2 inline-block"
              >
                Find active tournaments to vote in
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityDashboard;