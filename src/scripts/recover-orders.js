/**
 * Order Data Recovery Script
 * 
 * This script attempts to recover lost order data after the customer_reference migration.
 * It can:
 * 1. Check for missing orders by comparing against logs
 * 2. Recreate missing orders from backup data if available
 * 3. Generate a report of recovered and still-missing data
 * 
 * Usage: 
 * - Run with Node.js: node src/scripts/recover-orders.js
 */

import { getPrismaClient } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import logger from '../config/logger.js';

// Load environment variables
dotenv.config();

// Get Prisma client
const prisma = getPrismaClient();

// Create reports directory if it doesn't exist
const reportsDir = path.join(process.cwd(), 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

/**
 * Extract order IDs from log files
 */
async function extractOrderIdsFromLogs() {
  const logsDir = path.join(process.cwd(), 'logs');
  const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.log'));
  
  const orderIdPattern = /Order created: (ORD-\d+) for/;
  const orderIds = new Set();
  
  for (const logFile of logFiles) {
    const filePath = path.join(logsDir, logFile);
    const fileStream = fs.createReadStream(filePath);
    
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    for await (const line of rl) {
      const match = line.match(orderIdPattern);
      if (match && match[1]) {
        orderIds.add(match[1]);
      }
    }
  }
  
  return Array.from(orderIds);
}

/**
 * Identify missing orders by comparing log data with database
 */
async function identifyMissingOrders() {
  logger.info('Identifying missing orders...');
  
  // Get order IDs from logs
  const logOrderIds = await extractOrderIdsFromLogs();
  logger.info(`Found ${logOrderIds.length} order IDs in logs`);
  
  // Get order IDs from database
  const dbOrders = await prisma.order.findMany({
    select: { id: true }
  });
  const dbOrderIds = dbOrders.map(order => order.id);
  logger.info(`Found ${dbOrderIds.length} order IDs in database`);
  
  // Find missing orders
  const missingOrderIds = logOrderIds.filter(id => !dbOrderIds.includes(id));
  logger.info(`Identified ${missingOrderIds.length} missing orders`);
  
  return missingOrderIds;
}

/**
 * Search for backup data in available backup files
 */
async function findOrdersInBackups(missingOrderIds) {
  logger.info('Searching for missing orders in backup files...');
  
  const backupsDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    logger.warn('No backups directory found');
    return [];
  }
  
  const backupFiles = fs.readdirSync(backupsDir).filter(file => file.endsWith('.sql'));
  if (backupFiles.length === 0) {
    logger.warn('No backup files found');
    return [];
  }
  
  // Sort backup files by creation date (newest first)
  backupFiles.sort((a, b) => {
    const statA = fs.statSync(path.join(backupsDir, a));
    const statB = fs.statSync(path.join(backupsDir, b));
    return statB.mtime.getTime() - statA.mtime.getTime();
  });
  
  logger.info(`Found ${backupFiles.length} backup files, searching in newest first`);
  
  const recoveredOrders = [];
  
  // Search each backup file for missing order data
  for (const backupFile of backupFiles) {
    const filePath = path.join(backupsDir, backupFile);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    for (const orderId of missingOrderIds) {
      // Skip orders we've already found
      if (recoveredOrders.some(order => order.id === orderId)) {
        continue;
      }
      
      // Search for INSERT statements with this order ID
      const orderPattern = new RegExp(`INSERT INTO public\\.orders.*VALUES \\('${orderId}'.*\\);`);
      const match = fileContent.match(orderPattern);
      
      if (match) {
        logger.info(`Found order ${orderId} in backup file ${backupFile}`);
        
        // Extract values from the INSERT statement
        const orderData = parseInsertStatement(match[0]);
        if (orderData) {
          recoveredOrders.push(orderData);
        }
        
        // Also look for related order items
        const itemsPattern = new RegExp(`INSERT INTO public\\.order_items.*VALUES \\(\\d+, '${orderId}'.*\\);`, 'g');
        const itemMatches = [...fileContent.matchAll(itemsPattern)];
        
        if (itemMatches.length > 0) {
          const items = itemMatches.map(match => parseInsertStatement(match[0]));
          orderData.items = items.filter(Boolean);
        }
      }
    }
  }
  
  logger.info(`Recovered data for ${recoveredOrders.length} orders from backups`);
  return recoveredOrders;
}

/**
 * Parse an SQL INSERT statement and extract values
 */
function parseInsertStatement(insertSql) {
  try {
    // This is a simplified parser and may not handle all SQL formats correctly
    // Extract column names
    const columnsMatch = insertSql.match(/INSERT INTO public\\.\\w+\\s*\\(([^)]+)\\)/);
    if (!columnsMatch) return null;
    
    const columns = columnsMatch[1].split(',').map(col => col.trim());
    
    // Extract values
    const valuesMatch = insertSql.match(/VALUES\\s*\\(([^)]+)\\)/);
    if (!valuesMatch) return null;
    
    const values = valuesMatch[1].split(',').map(val => {
      const trimmed = val.trim();
      // Remove quotes from string values
      if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        return trimmed.substring(1, trimmed.length - 1);
      }
      return trimmed;
    });
    
    // Combine columns and values into an object
    const result = {};
    columns.forEach((col, index) => {
      if (index < values.length) {
        result[col] = values[index];
      }
    });
    
    return result;
  } catch (error) {
    logger.error('Error parsing INSERT statement:', error);
    return null;
  }
}

/**
 * Restore missing orders to the database
 */
async function restoreOrders(recoveredOrders) {
  logger.info(`Attempting to restore ${recoveredOrders.length} orders to database...`);
  
  const restoredOrders = [];
  const failedOrders = [];
  
  for (const orderData of recoveredOrders) {
    try {
      // Check if order already exists
      const existingOrder = await prisma.order.findUnique({
        where: { id: orderData.id }
      });
      
      if (existingOrder) {
        logger.info(`Order ${orderData.id} already exists in database, skipping`);
        continue;
      }
      
      // Prepare data for Prisma insert
      const orderItems = orderData.items || [];
      delete orderData.items;
      
      // Reconstruct the required fields for Prisma
      const orderInsertData = {
        id: orderData.id,
        customerName: orderData.customer_name,
        customerPhone: orderData.customer_phone,
        customerEmail: orderData.customer_email,
        customerAddress: orderData.customer_address,
        // New field that was added
        customerReference: null,
        userId: orderData.user_id ? parseInt(orderData.user_id) : null,
        date: new Date(orderData.date),
        status: orderData.status,
        paymentMethod: orderData.payment_method,
        paymentStatus: orderData.payment_status,
        subtotal: parseFloat(orderData.subtotal),
        tax: parseFloat(orderData.tax),
        total: parseFloat(orderData.total),
        notes: orderData.notes,
        deliveryDate: orderData.delivery_date ? new Date(orderData.delivery_date) : null,
        deliveryNotes: orderData.delivery_notes,
        createdAt: new Date(orderData.created_at || Date.now()),
        updatedAt: new Date(orderData.updated_at || Date.now())
      };
      
      // Insert the order
      const restoredOrder = await prisma.order.create({
        data: orderInsertData
      });
      
      // Insert order items if available
      if (orderItems.length > 0) {
        for (const item of orderItems) {
          await prisma.orderItem.create({
            data: {
              orderId: orderData.id,
              productId: parseInt(item.product_id),
              presentationId: item.presentation_id ? parseInt(item.presentation_id) : null,
              productName: item.product_name,
              quantity: parseFloat(item.quantity),
              price: parseFloat(item.price),
              total: parseFloat(item.total),
              presentationInfo: item.presentation_info ? JSON.parse(item.presentation_info) : null
            }
          });
        }
      }
      
      logger.info(`Successfully restored order ${orderData.id}`);
      restoredOrders.push(orderData.id);
    } catch (error) {
      logger.error(`Failed to restore order ${orderData.id}:`, error);
      failedOrders.push({ id: orderData.id, error: error.message });
    }
  }
  
  return { restoredOrders, failedOrders };
}

/**
 * Generate recovery report
 */
function generateReport(missingOrderIds, recoveredOrders, restoredOrders, failedOrders) {
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      total_missing_orders: missingOrderIds.length,
      orders_found_in_backups: recoveredOrders.length,
      orders_restored_to_database: restoredOrders.length,
      failed_restorations: failedOrders.length,
      unrecoverable_orders: missingOrderIds.length - recoveredOrders.length
    },
    missing_order_ids: missingOrderIds,
    restored_order_ids: restoredOrders,
    failed_restorations: failedOrders,
    unrecoverable_order_ids: missingOrderIds.filter(id => 
      !recoveredOrders.some(order => order.id === id)
    )
  };
  
  // Write report to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFileName = `recovery-report-${timestamp}.json`;
  const reportFilePath = path.join(reportsDir, reportFileName);
  
  fs.writeFileSync(reportFilePath, JSON.stringify(reportData, null, 2));
  logger.info(`Recovery report saved to: ${reportFilePath}`);
  
  return reportData;
}

/**
 * Main recovery process
 */
async function recoverOrderData() {
  try {
    logger.info('Starting order data recovery process...');
    
    // Step 1: Identify missing orders
    const missingOrderIds = await identifyMissingOrders();
    
    if (missingOrderIds.length === 0) {
      logger.info('No missing orders identified, recovery not needed');
      return { success: true, message: 'No missing orders identified' };
    }
    
    // Step 2: Find orders in backups
    const recoveredOrders = await findOrdersInBackups(missingOrderIds);
    
    if (recoveredOrders.length === 0) {
      logger.warn('No orders found in backup files');
      // Generate report for unrecoverable orders
      generateReport(missingOrderIds, [], [], []);
      return { 
        success: false, 
        message: 'No orders found in backup files',
        unrecoverable_count: missingOrderIds.length
      };
    }
    
    // Step 3: Restore orders to database
    const { restoredOrders, failedOrders } = await restoreOrders(recoveredOrders);
    
    // Step 4: Generate report
    const report = generateReport(
      missingOrderIds, 
      recoveredOrders, 
      restoredOrders, 
      failedOrders
    );
    
    return {
      success: true,
      message: `Restored ${restoredOrders.length} of ${missingOrderIds.length} missing orders`,
      report
    };
  } catch (error) {
    logger.error('Order recovery process failed:', error);
    return { success: false, error: error.message };
  } finally {
    await prisma.$disconnect();
  }
}

// If script is run directly (not imported)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  recoverOrderData()
    .then(result => {
      console.log('Recovery process result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

// Export for programmatic use
export default recoverOrderData;