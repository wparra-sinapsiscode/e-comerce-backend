/**
 * Database Structure Inspection Script
 * 
 * This script inspects and reports on the structure of the PostgreSQL database,
 * including tables, columns, constraints, and data statistics.
 * 
 * Usage: 
 * - Run with Node.js: node src/scripts/inspect-database.js
 */

import { getPrismaClient } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import logger from '../config/logger.js';

// Load environment variables
dotenv.config();

// Create reports directory if it doesn't exist
const reportsDir = path.join(process.cwd(), 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// Get Prisma client
const prisma = getPrismaClient();

// Main inspection function
async function inspectDatabase() {
  try {
    logger.info('Starting database inspection...');
    
    // Create report filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFileName = `db-inspection-${timestamp}.json`;
    const reportFilePath = path.join(reportsDir, reportFileName);
    
    // Get database tables and their statistics
    const tables = await prisma.$queryRaw`
      SELECT 
        table_name,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size,
        (SELECT reltuples::bigint FROM pg_class WHERE relname = table_name) as estimated_row_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    // Get column information for each table
    const tableDetails = [];
    for (const table of tables) {
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table.table_name}
        ORDER BY ordinal_position;
      `;
      
      // Get primary key
      const primaryKey = await prisma.$queryRaw`
        SELECT c.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name)
        JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
          AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
        WHERE constraint_type = 'PRIMARY KEY' AND tc.table_name = ${table.table_name};
      `;
      
      // Get foreign keys
      const foreignKeys = await prisma.$queryRaw`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = ${table.table_name};
      `;
      
      // Get indexes
      const indexes = await prisma.$queryRaw`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = ${table.table_name}
        ORDER BY indexname;
      `;
      
      tableDetails.push({
        table_name: table.table_name,
        size: table.size,
        estimated_row_count: table.estimated_row_count,
        columns,
        primary_key: primaryKey,
        foreign_keys: foreignKeys,
        indexes
      });
    }
    
    // Compile report data
    const reportData = {
      timestamp: new Date().toISOString(),
      database_name: process.env.DATABASE_URL.split('/').pop(),
      tables_count: tables.length,
      tables: tableDetails
    };
    
    // Write report to file
    fs.writeFileSync(reportFilePath, JSON.stringify(reportData, null, 2));
    
    logger.info(`Database inspection completed successfully!`);
    logger.info(`Report saved to: ${reportFilePath}`);
    
    // Output some basic stats to console
    console.log('Database Inspection Summary:');
    console.log('---------------------------');
    console.log(`Total tables: ${tables.length}`);
    tables.forEach(table => {
      console.log(`- ${table.table_name}: ~${table.estimated_row_count} rows, ${table.size}`);
    });
    console.log('---------------------------');
    console.log(`Full report saved to: ${reportFilePath}`);
    
    return reportData;
  } catch (error) {
    logger.error('Database inspection failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// If script is run directly (not imported)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  inspectDatabase()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

// Export for programmatic use
export default inspectDatabase;