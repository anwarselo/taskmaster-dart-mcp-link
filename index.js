/**
 * Dart-TaskMaster Integration
 * 
 * This is the main entry point for the Dart-TaskMaster integration.
 * It provides a bidirectional connection between Dart AI and TaskMaster
 * using the Model Context Protocol (MCP) with standardized JSON schema.
 */

import dotenv from 'dotenv';
import { startMCPServer, stopMCPServer } from './mcp-server.js';
import { startWebhookServer, stopWebhookServer } from './dart-webhook.js';
import { startTaskMasterListener } from './taskmaster-listener.js';
import { initMCPConnector } from './mcp-connector.js';

// Load environment variables
dotenv.config();

// Configuration
const config = {
  logLevel: process.env.LOG_LEVEL || 'info'
};

/**
 * Logger utility
 */
const logger = {
  debug: (...args) => {
    if (config.logLevel === 'debug') console.debug('[Dart-TaskMaster]', ...args);
  },
  info: (...args) => {
    if (['debug', 'info'].includes(config.logLevel)) console.info('[Dart-TaskMaster]', ...args);
  },
  warn: (...args) => {
    if (['debug', 'info', 'warn'].includes(config.logLevel)) console.warn('[Dart-TaskMaster]', ...args);
  },
  error: (...args) => {
    console.error('[Dart-TaskMaster]', ...args);
  }
};

// Store the running services
let mcpServer = null;
let webhookServer = null;
let taskMasterListener = null;

/**
 * Start the Dart-TaskMaster integration
 * @returns {Object} - The running services
 */
export async function start() {
  try {
    logger.info('Starting Dart-TaskMaster integration');
    
    // Initialize the MCP connector
    const mcpConnector = initMCPConnector();
    
    // Start the MCP server
    mcpServer = await startMCPServer();
    
    // Start the webhook server
    webhookServer = startWebhookServer();
    
    // Start the TaskMaster listener
    taskMasterListener = startTaskMasterListener();
    
    logger.info('Dart-TaskMaster integration started successfully');
    
    return {
      mcpServer,
      webhookServer,
      taskMasterListener,
      mcpConnector
    };
  } catch (error) {
    logger.error('Error starting Dart-TaskMaster integration:', error);
    
    // Clean up any started services
    await stop();
    
    throw error;
  }
}

/**
 * Stop the Dart-TaskMaster integration
 */
export async function stop() {
  logger.info('Stopping Dart-TaskMaster integration');
  
  // Stop the TaskMaster listener
  if (taskMasterListener) {
    taskMasterListener.stop();
    taskMasterListener = null;
  }
  
  // Stop the webhook server
  if (webhookServer) {
    stopWebhookServer(webhookServer);
    webhookServer = null;
  }
  
  // Stop the MCP server
  if (mcpServer) {
    await stopMCPServer(mcpServer);
    mcpServer = null;
  }
  
  logger.info('Dart-TaskMaster integration stopped');
}

// Start the integration if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch(error => {
    logger.error('Failed to start Dart-TaskMaster integration:', error);
    process.exit(1);
  });
  
  // Handle process termination
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await stop();
    process.exit(0);
  });
}

export default {
  start,
  stop,
  initMCPConnector
};
