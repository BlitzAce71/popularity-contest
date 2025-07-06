import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { CheckCircle, XCircle, AlertTriangle, Database, Shield } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

const ConnectionTest: React.FC = () => {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');

  const updateTest = (name: string, status: TestResult['status'], message: string, details?: string) => {
    setTests(prev => {
      const existing = prev.find(t => t.name === name);
      if (existing) {
        existing.status = status;
        existing.message = message;
        existing.details = details;
        return [...prev];
      } else {
        return [...prev, { name, status, message, details }];
      }
    });
  };

  const runTests = async () => {
    setIsRunning(true);
    setTests([]);

    // Test 1: Basic Connection
    setCurrentTest('Basic Connection');
    updateTest('Basic Connection', 'pending', 'Testing connection to Supabase...');
    
    try {
      const { error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (error) {
        updateTest('Basic Connection', 'error', 'Failed to connect to Supabase', error.message);
      } else {
        updateTest('Basic Connection', 'success', 'Successfully connected to Supabase');
      }
    } catch (err) {
      updateTest('Basic Connection', 'error', 'Connection failed', err instanceof Error ? err.message : 'Unknown error');
    }

    // Test 2: Environment Variables
    setCurrentTest('Environment Variables');
    updateTest('Environment Variables', 'pending', 'Checking environment configuration...');
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      updateTest('Environment Variables', 'error', 'Missing environment variables', 
        `Missing: ${!supabaseUrl ? 'VITE_SUPABASE_URL' : ''} ${!supabaseKey ? 'VITE_SUPABASE_ANON_KEY' : ''}`);
    } else if (!supabaseUrl.startsWith('https://')) {
      updateTest('Environment Variables', 'warning', 'Invalid Supabase URL format', 'URL should start with https://');
    } else {
      updateTest('Environment Variables', 'success', 'Environment variables configured correctly');
    }

    // Test 3: Database Tables
    setCurrentTest('Database Tables');
    updateTest('Database Tables', 'pending', 'Checking database schema...');
    
    try {
      const tables = ['users', 'tournaments', 'contestants', 'rounds', 'matchups', 'votes'];
      const tableChecks = await Promise.all(
        tables.map(async (table) => {
          try {
            const { error } = await supabase.from(table).select('count').limit(1);
            return { table, exists: !error };
          } catch {
            return { table, exists: false };
          }
        })
      );

      const existingTables = tableChecks.filter(t => t.exists).map(t => t.table);
      const missingTables = tableChecks.filter(t => !t.exists).map(t => t.table);

      if (missingTables.length === 0) {
        updateTest('Database Tables', 'success', `All ${tables.length} tables exist`, existingTables.join(', '));
      } else if (existingTables.length > 0) {
        updateTest('Database Tables', 'warning', `Some tables missing`, 
          `Existing: ${existingTables.join(', ')}. Missing: ${missingTables.join(', ')}`);
      } else {
        updateTest('Database Tables', 'error', 'No tables found', 'Run the migration script first');
      }
    } catch (err) {
      updateTest('Database Tables', 'error', 'Failed to check tables', err instanceof Error ? err.message : 'Unknown error');
    }

    // Test 4: Authentication
    setCurrentTest('Authentication');
    updateTest('Authentication', 'pending', 'Testing authentication system...');
    
    try {
      const { data: session } = await supabase.auth.getSession();
      const { data: user } = await supabase.auth.getUser();
      
      if (session.session || user.user) {
        updateTest('Authentication', 'success', 'User is authenticated', `User ID: ${user.user?.id}`);
      } else {
        updateTest('Authentication', 'warning', 'No user authenticated', 'This is normal for first-time setup');
      }
    } catch (err) {
      updateTest('Authentication', 'error', 'Authentication check failed', err instanceof Error ? err.message : 'Unknown error');
    }

    // Test 5: Storage Buckets
    setCurrentTest('Storage Buckets');
    updateTest('Storage Buckets', 'pending', 'Checking storage configuration...');
    
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      
      if (error) {
        updateTest('Storage Buckets', 'error', 'Failed to list buckets', error.message);
      } else {
        const requiredBuckets = ['tournament-images', 'contestant-images'];
        const existingBuckets = buckets?.map(b => b.name) || [];
        const missingBuckets = requiredBuckets.filter(b => !existingBuckets.includes(b));
        
        if (missingBuckets.length === 0) {
          updateTest('Storage Buckets', 'success', 'All storage buckets configured', existingBuckets.join(', '));
        } else {
          updateTest('Storage Buckets', 'warning', 'Some buckets missing', 
            `Missing: ${missingBuckets.join(', ')}`);
        }
      }
    } catch (err) {
      updateTest('Storage Buckets', 'error', 'Storage check failed', err instanceof Error ? err.message : 'Unknown error');
    }

    // Test 6: Row Level Security
    setCurrentTest('Row Level Security');
    updateTest('Row Level Security', 'pending', 'Checking RLS policies...');
    
    try {
      // Try to access a protected resource without authentication
      const { error } = await supabase
        .from('users')
        .insert({ email: 'test@test.com', username: 'test' });
      
      if (error && error.message.includes('new row violates row-level security')) {
        updateTest('Row Level Security', 'success', 'RLS policies are active and working');
      } else if (error) {
        updateTest('Row Level Security', 'warning', 'RLS policies may need configuration', error.message);
      } else {
        updateTest('Row Level Security', 'warning', 'RLS policies may be too permissive', 'Insertion succeeded without authentication');
      }
    } catch (err) {
      updateTest('Row Level Security', 'error', 'RLS check failed', err instanceof Error ? err.message : 'Unknown error');
    }

    setCurrentTest('');
    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'pending':
        return <LoadingSpinner size="sm" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'pending':
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getOverallStatus = () => {
    if (tests.length === 0) return 'Not tested';
    const errors = tests.filter(t => t.status === 'error').length;
    const warnings = tests.filter(t => t.status === 'warning').length;
    const success = tests.filter(t => t.status === 'success').length;
    
    if (errors > 0) return `${errors} errors found`;
    if (warnings > 0) return `${warnings} warnings, ${success} passed`;
    return `All ${success} tests passed`;
  };

  // Auto-run tests on component mount
  useEffect(() => {
    runTests();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <Database className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-gray-900">Supabase Connection Test</h1>
        <p className="text-gray-600 mt-2">
          Verify your Supabase configuration and database setup
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-lg font-medium text-gray-900">
          Status: {getOverallStatus()}
        </div>
        <Button 
          onClick={runTests} 
          disabled={isRunning}
          className="flex items-center gap-2"
        >
          {isRunning && <LoadingSpinner size="sm" />}
          {isRunning ? 'Running Tests...' : 'Run Tests'}
        </Button>
      </div>

      {isRunning && currentTest && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <LoadingSpinner size="sm" />
            <span className="text-blue-800 font-medium">
              Currently testing: {currentTest}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {tests.map((test) => (
          <div 
            key={test.name}
            className={`border rounded-lg p-4 ${getStatusColor(test.status)}`}
          >
            <div className="flex items-start gap-3">
              {getStatusIcon(test.status)}
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{test.name}</h3>
                <p className="text-gray-700 mt-1">{test.message}</p>
                {test.details && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                      Show details
                    </summary>
                    <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto">
                      {test.details}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {tests.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Environment Information</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Supabase URL: {import.meta.env.VITE_SUPABASE_URL || 'Not configured'}</div>
            <div>Supabase Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Configured' : 'Not configured'}</div>
            <div>App Name: {import.meta.env.VITE_APP_NAME || 'Not configured'}</div>
            <div>App URL: {import.meta.env.VITE_APP_URL || 'Not configured'}</div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Next Steps
        </h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>1. If any tests failed, check the MIGRATION_GUIDE.md for setup instructions</p>
          <p>2. For storage issues, see STORAGE_SETUP.md</p>
          <p>3. Remove this test component before deploying to production</p>
          <p>4. Create your first admin user by registering and updating the database</p>
        </div>
      </div>
    </div>
  );
};

export default ConnectionTest;