/**
 * Database Restore Script
 * 
 * This script restores a PostgreSQL database from a backup file.
 * It uses the psql utility to restore from a SQL dump file.
 * 
 * Usage: 
 * - Run with Node.js: node src/scripts/restore-database.js backups/backup-file.sql
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import logger from '../config/logger.js';

// Load environment variables
dotenv.config();

// Parse DATABASE_URL to get connection details
function parseDatabaseUrl(url) {
  try {
    const pattern = /^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/;
    const match = url.match(pattern);
    
    if (!match || match.length < 6) {
      throw new Error('Invalid DATABASE_URL format');
    }
    
    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: match[4],
      database: match[5],
    };
  } catch (error) {
    logger.error('Failed to parse DATABASE_URL:', error);
    throw error;
  }
}

// Restore backup
async function restoreBackup(backupFilePath) {
  try {
    if (!backupFilePath) {
      logger.error('No backup file specified. Usage: node restore-database.js backups/backup-file.sql');
      process.exit(1);
    }
    
    // Check if backup file exists
    if (!fs.existsSync(backupFilePath)) {
      logger.error(`Backup file not found: ${backupFilePath}`);
      process.exit(1);
    }
    
    logger.info(`Starting database restore from ${backupFilePath}...`);
    
    const { user, password, host, port, database } = parseDatabaseUrl(process.env.DATABASE_URL);
    
    // Set PGPASSWORD environment variable for psql
    const env = { ...process.env, PGPASSWORD: password };
    
    // Create psql command
    const command = `psql -h ${host} -p ${port} -U ${user} -d ${database} -f "${backupFilePath}"`;
    
    // Execute psql
    exec(command, { env }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Database restore failed: ${error.message}`);
        return;
      }
      
      if (stderr) {
        logger.warn(`psql warnings: ${stderr}`);
      }
      
      logger.info(`Database restore completed successfully!`);
      logger.info(`Output: ${stdout}`);
    });
  } catch (error) {
    logger.error('Restore process failed:', error);
  }
}

// Get backup file path from command line args
const backupFilePath = process.argv[2];

// Run restore
restoreBackup(backupFilePath);

// Export for potential programmatic use
export default restoreBackup;