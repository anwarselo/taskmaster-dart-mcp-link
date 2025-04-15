/**
 * Dart-TaskMaster MCP Server
 * 
 * This module provides a Model Context Protocol (MCP) server that integrates
 * Dart AI and TaskMaster, enabling bidirectional communication between the two systems.
 */

import { initMCPConnector } from './mcp-connector.js';
import fastmcp from 'fastmcp';
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
    
    // Create the MCP server
    const server = fastmcp.createServer({
      name: 'dart-taskmaster-mcp',
      version: '1.0.0',
      description: 'MCP Server for Dart-TaskMaster integration',
      tools: [
        {
          name: 'sync_dart_to_taskmaster',
          description: 'Synchronize a task from Dart to TaskMaster',
          parameters: {
            type: 'object',
            required: ['task_id', 'update_type', 'payload'],
            properties: {
              task_id: {
                type: 'string',
                description: 'The Dart task ID'
              },
              update_type: {
                type: 'string',
                enum: ['create', 'update', 'complete', 'delete'],
                description: 'The type of update to perform'
              },
              payload: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    description: 'The task status'
                  },
                  title: {
                    type: 'string',
                    description: 'The task title'
                  },
                  description: {
                    type: 'string',
                    description: 'The task description'
                  },
                  priority: {
                    type: 'string',
                    description: 'The task priority'
                  },
                  metadata: {
                    type: 'object',
                    description: 'Additional task metadata'
                  }
                }
              }
            }
          },
          handler: async (params) => {
            try {
              logger.debug('Received sync_dart_to_taskmaster request:', params);
              
              // Create the message
              const message = {
                source: 'Dart',
                task_id: params.task_id,
                update_type: params.update_type,
                timestamp: new Date().toISOString(),
                payload: params.payload
              };
              
              // Send the message to TaskMaster
              const result = await mcpConnector.sendDartToTaskMaster(message);
              
              return {
                success: true,
                result
              };
            } catch (error) {
              logger.error('Error in sync_dart_to_taskmaster:', error);
              return {
                success: false,
                error: error.message
              };
            }
          }
        },
        {
          name: 'sync_taskmaster_to_dart',
          description: 'Synchronize a task from TaskMaster to Dart',
          parameters: {
            type: 'object',
            required: ['task_id', 'update_type', 'payload'],
            properties: {
              task_id: {
                type: 'string',
                description: 'The TaskMaster task ID'
              },
              update_type: {
                type: 'string',
                enum: ['create', 'update', 'complete', 'delete'],
                description: 'The type of update to perform'
              },
              payload: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    description: 'The task status'
                  },
                  title: {
                    type: 'string',
                    description: 'The task title'
                  },
                  description: {
                    type: 'string',
                    description: 'The task description'
                  },
                  priority: {
                    type: 'string',
                    description: 'The task priority'
                  },
                  metadata: {
                    type: 'object',
                    description: 'Additional task metadata'
                  }
                }
              }
            }
          },
          handler: async (params) => {
            try {
              logger.debug('Received sync_taskmaster_to_dart request:', params);
              
              // Create the message
              const message = {
                source: 'TaskMaster',
                task_id: params.task_id,
                update_type: params.update_type,
                timestamp: new Date().toISOString(),
                payload: params.payload
              };
              
              // Send the message to Dart
              const result = await mcpConnector.sendTaskMasterToDart(message);
              
              return {
                success: true,
                result
              };
            } catch (error) {
              logger.error('Error in sync_taskmaster_to_dart:', error);
              return {
                success: false,
                error: error.message
              };
            }
          }
        },
        {
          name: 'get_config',
          description: 'Get the current configuration of the MCP connector',
          parameters: {
            type: 'object',
            properties: {}
          },
          handler: async () => {
            try {
              return {
                success: true,
                config: {
                  ...mcpConnector.config,
                  // Don't expose sensitive information
                  dart: {
                    ...mcpConnector.config.dart,
                    apiKey: mcpConnector.config.dart.apiKey ? '***' : undefined
                  }
                }
              };
            } catch (error) {
              logger.error('Error in get_config:', error);
              return {
                success: false,
                error: error.message
              };
            }
          }
        }
      ]
    });
    
    // Start the server
    await server.listen(config.port, config.host);
    
    logger.info(`MCP Server listening on ${config.host}:${config.port}`);
    
    return server;
  } catch (error) {
    logger.error('Error starting MCP Server:', error);
    throw error;
  }
}

/**
 * Stop the MCP server
 * @param {Object} server - The MCP server instance
 */
export async function stopMCPServer(server) {
  try {
    logger.info('Stopping MCP Server');
    await server.close();
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
