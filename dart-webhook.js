/**
 * Dart Webhook Handler
 * 
 * This module provides an Express server that receives webhooks from Dart
 * and forwards them to TaskMaster via the MCP connector.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initMCPConnector } from './mcp-connector.js';

// Load environment variables
dotenv.config();

// Initialize the MCP connector
const mcpConnector = initMCPConnector();

// Configuration
const config = {
  port: process.env.WEBHOOK_PORT || 3101,
  host: process.env.WEBHOOK_HOST || 'localhost',
  webhookSecret: process.env.DART_WEBHOOK_SECRET,
  logLevel: process.env.LOG_LEVEL || 'info'
};

/**
 * Logger utility
 */
const logger = {
  debug: (...args) => {
    if (config.logLevel === 'debug') console.debug('[Dart Webhook]', ...args);
  },
  info: (...args) => {
    if (['debug', 'info'].includes(config.logLevel)) console.info('[Dart Webhook]', ...args);
  },
  warn: (...args) => {
    if (['debug', 'info', 'warn'].includes(config.logLevel)) console.warn('[Dart Webhook]', ...args);
  },
  error: (...args) => {
    console.error('[Dart Webhook]', ...args);
  }
};

/**
 * Start the webhook server
 * @returns {Object} - The Express server instance
 */
export function startWebhookServer() {
  logger.info('Starting Dart webhook server');
  
  // Create the Express app
  const app = express();
  
  // Add middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  
  // Add webhook route
  app.post('/webhook', validateWebhook, async (req, res) => {
    try {
      logger.debug('Received webhook:', req.body);
      
      // Process the webhook
      const result = await processWebhook(req.body);
      
      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        result
      });
    } catch (error) {
      logger.error('Error processing webhook:', error);
      
      res.status(500).json({
        success: false,
        message: 'Error processing webhook',
        error: error.message
      });
    }
  });
  
  // Add health check route
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });
  
  // Start the server
  const server = app.listen(config.port, config.host, () => {
    logger.info(`Webhook server listening on ${config.host}:${config.port}`);
  });
  
  // Return the server instance
  return server;
}

/**
 * Validate the webhook request
 * @param {Object} req - The Express request object
 * @param {Object} res - The Express response object
 * @param {Function} next - The Express next function
 */
function validateWebhook(req, res, next) {
  try {
    // Check if webhook secret is configured
    if (!config.webhookSecret) {
      logger.warn('Webhook secret not configured, skipping validation');
      return next();
    }
    
    // Get the signature from the headers
    const signature = req.headers['x-dart-signature'];
    
    if (!signature) {
      logger.warn('No signature found in webhook request');
      return res.status(401).json({
        success: false,
        message: 'Missing signature'
      });
    }
    
    // Validate the signature
    // Note: This is a placeholder for the actual validation logic
    // You would need to implement the specific validation method used by Dart
    const isValid = validateSignature(req.body, signature, config.webhookSecret);
    
    if (!isValid) {
      logger.warn('Invalid signature in webhook request');
      return res.status(401).json({
        success: false,
        message: 'Invalid signature'
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error validating webhook:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error validating webhook',
      error: error.message
    });
  }
}

/**
 * Validate the webhook signature
 * @param {Object} payload - The webhook payload
 * @param {string} signature - The signature from the headers
 * @param {string} secret - The webhook secret
 * @returns {boolean} - Whether the signature is valid
 */
function validateSignature(payload, signature, secret) {
  // This is a placeholder for the actual validation logic
  // You would need to implement the specific validation method used by Dart
  
  // For now, we'll just return true
  return true;
}

/**
 * Process a webhook from Dart
 * @param {Object} webhook - The webhook payload
 * @returns {Object} - The result of processing the webhook
 */
async function processWebhook(webhook) {
  try {
    // Extract the event type
    const eventType = webhook.event || webhook.type;
    
    if (!eventType) {
      throw new Error('No event type found in webhook');
    }
    
    // Process based on event type
    switch (eventType) {
      case 'task.created':
        return await processTaskCreated(webhook);
      case 'task.updated':
        return await processTaskUpdated(webhook);
      case 'task.completed':
        return await processTaskCompleted(webhook);
      case 'task.deleted':
        return await processTaskDeleted(webhook);
      default:
        logger.debug(`Ignoring unsupported event type: ${eventType}`);
        return { ignored: true, reason: `Unsupported event type: ${eventType}` };
    }
  } catch (error) {
    logger.error('Error processing webhook:', error);
    throw error;
  }
}

/**
 * Process a task.created webhook
 * @param {Object} webhook - The webhook payload
 * @returns {Object} - The result of processing the webhook
 */
async function processTaskCreated(webhook) {
  try {
    // Extract the task data
    const task = webhook.data || webhook.task;
    
    if (!task || !task.id) {
      throw new Error('No task data found in webhook');
    }
    
    // Create the message
    const message = {
      source: 'Dart',
      task_id: task.id,
      update_type: 'create',
      timestamp: new Date().toISOString(),
      payload: {
        status: task.status,
        title: task.title,
        description: task.description,
        priority: task.priority,
        metadata: {
          dartId: task.id,
          dartUrl: task.url,
          dartCreatedAt: task.created_at,
          dartUpdatedAt: task.updated_at
        }
      }
    };
    
    // Send the message to TaskMaster
    const result = await mcpConnector.sendDartToTaskMaster(message);
    
    logger.info(`Processed task.created webhook for task ${task.id}`);
    
    return result;
  } catch (error) {
    logger.error('Error processing task.created webhook:', error);
    throw error;
  }
}

/**
 * Process a task.updated webhook
 * @param {Object} webhook - The webhook payload
 * @returns {Object} - The result of processing the webhook
 */
async function processTaskUpdated(webhook) {
  try {
    // Extract the task data
    const task = webhook.data || webhook.task;
    
    if (!task || !task.id) {
      throw new Error('No task data found in webhook');
    }
    
    // Create the message
    const message = {
      source: 'Dart',
      task_id: task.id,
      update_type: 'update',
      timestamp: new Date().toISOString(),
      payload: {
        status: task.status,
        title: task.title,
        description: task.description,
        priority: task.priority,
        metadata: {
          dartId: task.id,
          dartUrl: task.url,
          dartUpdatedAt: task.updated_at
        }
      }
    };
    
    // Send the message to TaskMaster
    const result = await mcpConnector.sendDartToTaskMaster(message);
    
    logger.info(`Processed task.updated webhook for task ${task.id}`);
    
    return result;
  } catch (error) {
    logger.error('Error processing task.updated webhook:', error);
    throw error;
  }
}

/**
 * Process a task.completed webhook
 * @param {Object} webhook - The webhook payload
 * @returns {Object} - The result of processing the webhook
 */
async function processTaskCompleted(webhook) {
  try {
    // Extract the task data
    const task = webhook.data || webhook.task;
    
    if (!task || !task.id) {
      throw new Error('No task data found in webhook');
    }
    
    // Create the message
    const message = {
      source: 'Dart',
      task_id: task.id,
      update_type: 'complete',
      timestamp: new Date().toISOString(),
      payload: {
        status: 'Done',
        metadata: {
          dartId: task.id,
          dartCompletedAt: task.completed_at || new Date().toISOString()
        }
      }
    };
    
    // Send the message to TaskMaster
    const result = await mcpConnector.sendDartToTaskMaster(message);
    
    logger.info(`Processed task.completed webhook for task ${task.id}`);
    
    return result;
  } catch (error) {
    logger.error('Error processing task.completed webhook:', error);
    throw error;
  }
}

/**
 * Process a task.deleted webhook
 * @param {Object} webhook - The webhook payload
 * @returns {Object} - The result of processing the webhook
 */
async function processTaskDeleted(webhook) {
  try {
    // Extract the task data
    const task = webhook.data || webhook.task;
    
    if (!task || !task.id) {
      throw new Error('No task data found in webhook');
    }
    
    // Create the message
    const message = {
      source: 'Dart',
      task_id: task.id,
      update_type: 'delete',
      timestamp: new Date().toISOString(),
      payload: {
        status: task.status,
        metadata: {
          dartId: task.id
        }
      }
    };
    
    // Send the message to TaskMaster
    const result = await mcpConnector.sendDartToTaskMaster(message);
    
    logger.info(`Processed task.deleted webhook for task ${task.id}`);
    
    return result;
  } catch (error) {
    logger.error('Error processing task.deleted webhook:', error);
    throw error;
  }
}

/**
 * Stop the webhook server
 * @param {Object} server - The Express server instance
 */
export function stopWebhookServer(server) {
  logger.info('Stopping webhook server');
  server.close();
  logger.info('Webhook server stopped');
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startWebhookServer();
}

export default {
  startWebhookServer,
  stopWebhookServer
};
