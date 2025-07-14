import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TournamentService } from '@/services/tournaments';
import { ContestantService } from '@/services/contestants';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { 
  ArrowLeft, 
  Trophy, 
  Calendar, 
  Users, 
  Settings,
  Image,
  Eye,
  EyeOff
} from 'lucide-react';

const createTournamentSchema = z.object({
  name: z.string().min(1, 'Tournament name is required').max(100, 'Name too long'),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  image_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional().or(z.literal('')),
  max_contestants: z.number().min(4, 'Minimum 4 contestants').max(128, 'Maximum 128 contestants'),
  bracket_type: z.enum(['single-elimination', 'double-elimination', 'round-robin']),
  is_public: z.boolean(),
  quadrant_1_name: z.string().min(1, 'Quadrant 1 name is required').max(50, 'Name too long'),
  quadrant_2_name: z.string().min(1, 'Quadrant 2 name is required').max(50, 'Name too long'),
  quadrant_3_name: z.string().min(1, 'Quadrant 3 name is required').max(50, 'Name too long'),
  quadrant_4_name: z.string().min(1, 'Quadrant 4 name is required').max(50, 'Name too long'),
});

type CreateTournamentFormData = z.infer<typeof createTournamentSchema>;

const CreateTournament: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { user, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch,
  } = useForm<CreateTournamentFormData>({
    resolver: zodResolver(createTournamentSchema),
    defaultValues: {
      max_contestants: 16,
      bracket_type: 'single-elimination',
      is_public: true,
      start_date: new Date().toISOString().split('T')[0],
      quadrant_1_name: 'Region A',
      quadrant_2_name: 'Region B',
      quadrant_3_name: 'Region C',
      quadrant_4_name: 'Region D',
    },
  });

  const onSubmit = async (data: CreateTournamentFormData) => {
    console.log('🔥 Tournament creation started:', data);
    
    if (!isAuthenticated || !user) {
      console.log('❌ User not authenticated');
      setError('root', { message: 'You must be logged in to create a tournament' });
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 Setting loading to true');
      
      // Clean up data before submission
      const tournamentData = {
        ...data,
        image_url: data.image_url || undefined,
        end_date: data.end_date || undefined,
        quadrant_names: [
          data.quadrant_1_name,
          data.quadrant_2_name,
          data.quadrant_3_name,
          data.quadrant_4_name,
        ] as [string, string, string, string],
        // Remove individual quadrant name fields
        quadrant_1_name: undefined,
        quadrant_2_name: undefined,
        quadrant_3_name: undefined,
        quadrant_4_name: undefined,
      };
      console.log('🚀 Calling TournamentService.createTournament...');

      // Add client-side timeout protection
      const createPromise = TournamentService.createTournament(tournamentData);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tournament creation timed out. Please try again.')), 45000)
      );

      const newTournament = await Promise.race([createPromise, timeoutPromise]);
      
      console.log('✅ Tournament created successfully:', newTournament);
      
      // Navigate to the newly created tournament
      if (newTournament?.slug) {
        console.log('✅ Using slug for navigation:', newTournament.slug);
        navigate(`/tournaments/${newTournament.slug}`);
      } else {
        console.log('⚠️ No slug found, falling back to ID:', newTournament?.id);
        navigate(`/tournaments/${newTournament?.id}`);
      }
      
      console.log('🎯 Navigation completed');
    } catch (error) {
      console.log('💥 Error during tournament creation:', error);
      setError('root', {
        message: error instanceof Error ? error.message : 'Failed to create tournament',
      });
    } finally {
      console.log('🏁 Setting loading to false');
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-6">You must be logged in to create a tournament.</p>
          <Link to="/auth/login">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-600 mb-6">Only administrators can create tournaments.</p>
          <Link to="/tournaments">
            <Button>View Tournaments</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/tournaments"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Tournaments
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create New Tournament</h1>
          <p className="text-gray-600 mt-2">
            Set up your tournament with contestants and let the voting begin!
          </p>
        </div>

        {/* Form */}
        <div className="bg-white shadow-sm rounded-lg">
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
            {/* Tournament Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Tournament Name *
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Trophy className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('name')}
                  type="text"
                  className="input-field pl-10"
                  placeholder="Enter tournament name"
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description *
              </label>
              <textarea
                {...register('description')}
                rows={3}
                className="input-field"
                placeholder="Describe your tournament..."
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            {/* Image URL */}
            <div>
              <label htmlFor="image_url" className="block text-sm font-medium text-gray-700">
                Tournament Image URL (optional)
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Image className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('image_url')}
                  type="url"
                  className="input-field pl-10"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              {errors.image_url && (
                <p className="mt-1 text-sm text-red-600">{errors.image_url.message}</p>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
                  Start Date *
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('start_date')}
                    type="date"
                    className="input-field pl-10"
                  />
                </div>
                {errors.start_date && (
                  <p className="mt-1 text-sm text-red-600">{errors.start_date.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
                  End Date (optional)
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('end_date')}
                    type="date"
                    className="input-field pl-10"
                  />
                </div>
                {errors.end_date && (
                  <p className="mt-1 text-sm text-red-600">{errors.end_date.message}</p>
                )}
              </div>
            </div>

            {/* Tournament Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="max_contestants" className="block text-sm font-medium text-gray-700">
                  Maximum Contestants *
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('max_contestants', { valueAsNumber: true })}
                    type="number"
                    min="4"
                    max="128"
                    className="input-field pl-10"
                  />
                </div>
                {errors.max_contestants && (
                  <p className="mt-1 text-sm text-red-600">{errors.max_contestants.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="bracket_type" className="block text-sm font-medium text-gray-700">
                  Bracket Type *
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Settings className="h-5 w-5 text-gray-400" />
                  </div>
                  <select {...register('bracket_type')} className="input-field pl-10">
                    <option value="single-elimination">Single Elimination</option>
                    <option value="double-elimination">Double Elimination</option>
                    <option value="round-robin">Round Robin</option>
                  </select>
                </div>
                {errors.bracket_type && (
                  <p className="mt-1 text-sm text-red-600">{errors.bracket_type.message}</p>
                )}
              </div>
            </div>

            {/* Quadrant Names */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Bracket Quadrant Names *
              </label>
              <p className="text-sm text-gray-600 mb-4">
                Customize the names of your tournament's four quadrants/regions. These names will be shown 
                when contestants select their quadrant placement and in the bracket visualization.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="quadrant_1_name" className="block text-sm font-medium text-gray-700">
                    Quadrant 1 (Top Left) *
                  </label>
                  <input
                    {...register('quadrant_1_name')}
                    type="text"
                    className="input-field mt-1"
                    placeholder="e.g., Region A, North Division"
                  />
                  {errors.quadrant_1_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.quadrant_1_name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="quadrant_2_name" className="block text-sm font-medium text-gray-700">
                    Quadrant 2 (Top Right) *
                  </label>
                  <input
                    {...register('quadrant_2_name')}
                    type="text"
                    className="input-field mt-1"
                    placeholder="e.g., Region B, South Division"
                  />
                  {errors.quadrant_2_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.quadrant_2_name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="quadrant_3_name" className="block text-sm font-medium text-gray-700">
                    Quadrant 3 (Bottom Left) *
                  </label>
                  <input
                    {...register('quadrant_3_name')}
                    type="text"
                    className="input-field mt-1"
                    placeholder="e.g., Region C, East Division"
                  />
                  {errors.quadrant_3_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.quadrant_3_name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="quadrant_4_name" className="block text-sm font-medium text-gray-700">
                    Quadrant 4 (Bottom Right) *
                  </label>
                  <input
                    {...register('quadrant_4_name')}
                    type="text"
                    className="input-field mt-1"
                    placeholder="e.g., Region D, West Division"
                  />
                  {errors.quadrant_4_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.quadrant_4_name.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Visibility */}
            <div>
              <div className="flex items-center">
                <input
                  {...register('is_public')}
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="is_public" className="ml-2 block text-sm text-gray-700">
                  Make this tournament public (visible to all users)
                </label>
              </div>
              {errors.is_public && (
                <p className="mt-1 text-sm text-red-600">{errors.is_public.message}</p>
              )}
            </div>

            {/* Global Error */}
            {errors.root && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{errors.root.message}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <Link to="/tournaments">
                <Button variant="outline" disabled={loading}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Creating Tournament...
                  </>
                ) : (
                  'Create Tournament'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateTournament;