import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileService, type UserProfileUpdateData } from '@/services/profile';
import { User, Mail, Calendar, Save, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';

interface AccountSettingsProps {
  user: User;
  onUpdate: () => void;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({ user, onUpdate }) => {
  const [formData, setFormData] = useState<UserProfileUpdateData>({
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await ProfileService.updateProfile(formData);
      setSuccess(true);
      onUpdate();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof UserProfileUpdateData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const hasChanges = () => {
    return (
      formData.username !== user.username ||
      formData.first_name !== user.first_name ||
      formData.last_name !== user.last_name
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-700">{error}</span>
                </div>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Save className="w-5 h-5 text-green-600" />
                  <span className="text-green-700">Profile updated successfully!</span>
                </div>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  value={formData.username || ''}
                  onChange={(e) => handleChange('username', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={user.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Email cannot be changed from this page
                </p>
              </div>

              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  id="first_name"
                  value={formData.first_name || ''}
                  onChange={(e) => handleChange('first_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter your first name"
                />
              </div>

              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  id="last_name"
                  value={formData.last_name || ''}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter your last name"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                loading={loading}
                disabled={!hasChanges() || loading}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-medium">Email Address</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-b">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-medium">Member Since</div>
                  <div className="text-sm text-gray-500">{formatDate(user.created_at)}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-medium">Account Type</div>
                  <div className="text-sm text-gray-500">
                    {user.is_admin ? 'Administrator' : 
                     user.can_create_tournaments ? 'Tournament Creator' : 
                     'Participant'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default AccountSettings;