#!/usr/bin/env node

// Script to manually apply SQL migrations when supabase CLI is not available
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigrations() {
  const migrationFiles = [
    '20250107000003_fix_get_bracket_data_function.sql',
    '20250107000004_add_comprehensive_error_handling.sql'
  ];

  for (const filename of migrationFiles) {
    const filePath = path.join('supabase', 'migrations', filename);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Migration file not found: ${filename}`);
      continue;
    }

    console.log(`🔄 Applying migration: ${filename}`);
    
    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Split SQL by semicolons and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`  Executing: ${statement.substring(0, 50)}...`);
          
          const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
          
          if (error) {
            console.log(`    ❌ Error: ${error.message}`);
            // Continue with next statement
          } else {
            console.log(`    ✅ Success`);
          }
        }
      }
      
      console.log(`✅ Migration ${filename} completed`);
    } catch (error) {
      console.log(`❌ Failed to apply ${filename}:`, error.message);
    }
  }
}

console.log('📦 Starting migration application...');
applyMigrations().catch(console.error);