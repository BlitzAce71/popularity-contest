#!/usr/bin/env node

// Debug authentication and permissions for tournament management
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAuthPermissions() {
  console.log('🔍 Debugging authentication and permissions...\n');

  try {
    // Check current user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log(`👤 AUTHENTICATION STATUS:`);
    if (authError) {
      console.log(`❌ Auth error: ${authError.message}`);
      return;
    }
    
    if (!user) {
      console.log(`❌ NOT LOGGED IN`);
      console.log(`   This is likely the issue! You need to be logged in to manage tournaments.`);
      return;
    }
    
    console.log(`✅ LOGGED IN`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);

    // Get user profile for admin status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
      
    const isAdmin = profile?.is_admin || false;
    console.log(`   Is Admin: ${isAdmin}`);

    // Get the most recent tournament
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, created_by, status')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!tournament) {
      console.log('❌ No tournaments found');
      return;
    }

    console.log(`\n📊 TOURNAMENT PERMISSIONS:`);
    console.log(`Tournament: ${tournament.name}`);
    console.log(`Tournament ID: ${tournament.id}`);
    console.log(`Tournament status: ${tournament.status}`);
    console.log(`Created by: ${tournament.created_by}`);
    console.log(`Current user: ${user.id}`);
    console.log(`User is creator: ${user.id === tournament.created_by}`);
    console.log(`User is admin: ${isAdmin}`);
    
    const canManage = user.id === tournament.created_by || isAdmin;
    console.log(`\n🔐 PERMISSION CHECK:`);
    console.log(`canManage = (user.id === tournament.created_by) || isAdmin`);
    console.log(`canManage = (${user.id === tournament.created_by}) || (${isAdmin})`);
    console.log(`canManage = ${canManage}`);
    
    if (canManage) {
      console.log(`\n✅ USER HAS PERMISSION to manage this tournament`);
      console.log(`   The Start Tournament button should be accessible`);
    } else {
      console.log(`\n❌ USER LACKS PERMISSION to manage this tournament`);
      console.log(`   You should see an "Access Denied" screen instead of the tournament management interface`);
      console.log(`   To fix: Either log in as the tournament creator or get admin permissions`);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

console.log('🔐 Authentication & Permissions Debugger');
console.log('=' .repeat(50));
debugAuthPermissions().catch(console.error);