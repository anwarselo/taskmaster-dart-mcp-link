/**
 * Dart-TaskMaster MCP Server
 *
 * This module provides a Model Context Protocol (MCP) server that integrates
 * Dart AI and TaskMaster, enabling bidirectional communication between the two systems.
 */

import { initMCPConnector } from './mcp-connector.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize the MCP connector
const mcpConnector = initMCPConnector();

// Configuration
const config = {
  port: process.env.MCP_PORT || 3100,
  host: process.env.MCP_HOST || 'localhost',
  logLevel: process.env.LOG_LEVEL || 'info'
};

/**
 * Logger utility
 */
const logger = {
  debug: (...args) => {
    if (config.logLevel === 'debug') console.debug('[MCP Server]', ...args);
  },
  info: (...args) => {
    if (['debug', 'info'].includes(config.logLevel)) console.info('[MCP Server]', ...args);
  },
  warn: (...args) => {
    if (['debug', 'info', 'warn'].includes(config.logLevel)) console.warn('[MCP Server]', ...args);
  },
  error: (...args) => {
    console.error('[MCP Server]', ...args);
  }
};

/**
 * Start the MCP server
 */
export async function startMCPServer() {
  try {
    logger.info('Starting Dart-TaskMaster MCP Server');

    // Create the Express app
    const app = express();

    // Add middleware
    app.use(helmet());
    app.use(cors());
    app.use(express.json());

    // Add health check route
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString()
      });
    });

    // Add MCP routes
    app.post('/mcp/sync_dart_to_taskmaster', async (req, res) => {
      try {
        logger.debug('Received sync_dart_to_taskmaster request:', req.body);

        const { task_id, update_type, payload } = req.body;

        if (!task_id || !update_type || !payload) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameters'
          });
        }

        // Create the message
        const message = {
          source: 'Dart',
          task_id,
          update_type,
          timestamp: new Date().toISOString(),
          payload
        };

        // Send the message to TaskMaster
        const result = await mcpConnector.sendDartToTaskMaster(message);

        res.status(200).json({
          success: true,
          result
        });
      } catch (error) {
        logger.error('Error in sync_dart_to_taskmaster:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.post('/mcp/sync_taskmaster_to_dart', async (req, res) => {
      try {
        logger.debug('Received sync_taskmaster_to_dart request:', req.body);

        const { task_id, update_type, payload } = req.body;

        if (!task_id || !update_type || !payload) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameters'
          });
        }

        // Create the message
        const message = {
          source: 'TaskMaster',
          task_id,
          update_type,
          timestamp: new Date().toISOString(),
          payload
        };

        // Send the message to Dart
        const result = await mcpConnector.sendTaskMasterToDart(message);

        res.status(200).json({
          success: true,
          result
        });
      } catch (error) {
        logger.error('Error in sync_taskmaster_to_dart:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.get('/mcp/get_config', async (req, res) => {
      try {
        res.status(200).json({
          success: true,
          config: {
            ...mcpConnector.config,
            // Don't expose sensitive information
            dart: {
              ...mcpConnector.config.dart,
              apiKey: mcpConnector.config.dart.apiKey ? '***' : undefined
            }
          }
        });
      } catch (error) {
        logger.error('Error in get_config:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Start the server
    const server = app.listen(config.port, config.host, () => {
      logger.info(`MCP Server listening on ${config.host}:${config.port}`);
    });

    return server;
  } catch (error) {
    logger.error('Error starting MCP Server:', error);
    throw error;
  }
}

/**
 * Stop the MCP server
 * @param {Object} server - The Express server instance
 */
export async function stopMCPServer(server) {
  try {
    logger.info('Stopping MCP Server');
    server.close();
    logger.info('MCP Server stopped');
  } catch (error) {
    logger.error('Error stopping MCP Server:', error);
    throw error;
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMCPServer().catch(error => {
    logger.error('Failed to start MCP Server:', error);
    process.exit(1);
  });
}

export default {
  startMCPServer,
  stopMCPServer
};
