#!/usr/bin/env node

// Check if schema reference file needs updating
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, '..', 'SCHEMA_REFERENCE.md');
const migrationDir = path.join(__dirname, '..', 'supabase', 'migrations');

function checkSchemaFreshness() {
  try {
    // Check if schema file exists
    if (!fs.existsSync(schemaPath)) {
      console.log('⚠️  Schema reference file not found. Run: npm run schema:update');
      return;
    }

    // Check if migrations directory exists
    if (!fs.existsSync(migrationDir)) {
      console.log('✅ Schema reference file exists');
      return;
    }

    // Get last modified time of schema file
    const schemaStats = fs.statSync(schemaPath);
    const schemaModified = schemaStats.mtime;

    // Get most recent migration file
    const migrationFiles = fs.readdirSync(migrationDir)
      .filter(file => file.endsWith('.sql'))
      .sort()
      .reverse();

    if (migrationFiles.length === 0) {
      console.log('✅ Schema reference file exists (no migrations found)');
      return;
    }

    const latestMigration = path.join(migrationDir, migrationFiles[0]);
    const migrationStats = fs.statSync(latestMigration);
    const migrationModified = migrationStats.mtime;

    // Check if schema file is older than latest migration
    if (schemaModified < migrationModified) {
      console.log('⚠️  Schema reference file may be outdated.');
      console.log(`   Latest migration: ${migrationFiles[0]}`);
      console.log('   Run: npm run schema:update');
    } else {
      console.log('✅ Schema reference file is up to date');
    }

  } catch (error) {
    console.log('ℹ️  Could not check schema freshness:', error.message);
  }
}

checkSchemaFreshness();