#!/usr/bin/env node

// Test authentication context for contestant creation
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read environment variables from .env.local manually
const envContent = readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line.includes('=') && !line.startsWith('#')) {
    const [key, value] = line.split('=', 2);
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuthContext() {
  try {
    console.log('🔍 Checking authentication context...');
    
    // Check current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.log('❌ User error:', userError);
      return;
    }
    
    if (!user) {
      console.log('❌ No authenticated user found');
      console.log('💡 This explains the RLS error - contestant creation requires authentication');
      return;
    }
    
    console.log(`✅ Authenticated user: ${user.email} (ID: ${user.id})`);
    
    // Check if user is admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();
      
    console.log(`👤 User profile:`, userProfile);
    console.log(`🔑 Is admin: ${userProfile?.is_admin || false}`);
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testAuthContext().catch(console.error);