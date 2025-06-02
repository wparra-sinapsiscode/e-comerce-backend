/**
 * Safe Migration Script
 * 
 * This script performs a safe database migration by:
 * 1. Creating a backup of the current database
 * 2. Running the Prisma migration
 * 3. Verifying the migration was successful
 * 
 * Usage: 
 * - Run with Node.js: node src/scripts/safe-migrate.js
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import logger from '../config/logger.js';
import createBackup from './backup-database.js';

const execPromise = promisify(exec);

// Load environment variables
dotenv.config();

// Create backups directory if it doesn't exist
const backupDir = path.join(process.cwd(), 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Run the safe migration process
async function safeMigrate() {
  try {
    logger.info('Starting safe migration process...');
    
    // Step 1: Create backup
    logger.info('Step 1: Creating database backup...');
    await createBackup();
    
    // Wait for backup to complete (simple delay, could be improved)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 2: Run Prisma migration
    logger.info('Step 2: Running Prisma migration...');
    try {
      const { stdout, stderr } = await execPromise('npx prisma migrate dev');
      logger.info('Migration output:', stdout);
      if (stderr) {
        logger.warn('Migration warnings:', stderr);
      }
    } catch (error) {
      logger.error('Migration failed:', error.message);
      logger.error('Consider restoring from backup using: node src/scripts/restore-database.js [backup-file]');
      throw error;
    }
    
    // Step 3: Verify migration
    logger.info('Step 3: Verifying migration...');
    try {
      const { stdout } = await execPromise('npx prisma db pull');
      logger.info('Verification output:', stdout);
      logger.info('Migration completed successfully!');
    } catch (error) {
      logger.error('Verification failed:', error.message);
      logger.error('Consider restoring from backup using: node src/scripts/restore-database.js [backup-file]');
      throw error;
    }
  } catch (error) {
    logger.error('Safe migration process failed:', error);
    process.exit(1);
  }
}

// Run the safe migration
safeMigrate();