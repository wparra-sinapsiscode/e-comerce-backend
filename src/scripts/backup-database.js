/**
 * Database Backup Script
 * 
 * This script creates a backup of the PostgreSQL database used by the application.
 * It uses the pg_dump utility to create a SQL dump file.
 * 
 * Usage: 
 * - Run with Node.js: node src/scripts/backup-database.js
 * - Schedule with cron or similar for automated backups
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import logger from '../config/logger.js';

// Load environment variables
dotenv.config();

// Create backups directory if it doesn't exist
const backupDir = path.join(process.cwd(), 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

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

// Create backup
async function createBackup() {
  try {
    logger.info('Starting database backup process...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${timestamp}.sql`;
    const backupFilePath = path.join(backupDir, backupFileName);
    
    const { user, password, host, port, database } = parseDatabaseUrl(process.env.DATABASE_URL);
    
    // Set PGPASSWORD environment variable for pg_dump
    const env = { ...process.env, PGPASSWORD: password };
    
    // Create pg_dump command
    const command = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F p -f "${backupFilePath}"`;
    
    // Execute pg_dump
    exec(command, { env }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Database backup failed: ${error.message}`);
        return;
      }
      
      if (stderr) {
        logger.warn(`pg_dump warnings: ${stderr}`);
      }
      
      const stats = fs.statSync(backupFilePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      
      logger.info(`Database backup completed successfully!`);
      logger.info(`Backup saved to: ${backupFilePath}`);
      logger.info(`Backup size: ${fileSizeInMB.toFixed(2)} MB`);
    });
  } catch (error) {
    logger.error('Backup process failed:', error);
  }
}

// Run backup
createBackup();

// Export for potential programmatic use
export default createBackup;