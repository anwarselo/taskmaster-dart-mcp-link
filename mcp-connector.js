/**
 * Dart-TaskMaster MCP Connector
 * 
 * This module provides bidirectional integration between Dart AI and TaskMaster
 * using the Model Context Protocol (MCP) with standardized JSON schema.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cache for processed messages to prevent duplicates
const processedMessages = new Set();

// Configuration
const config = {
  // Default timeout in milliseconds
  timeout: 5000,
  // Maximum number of retries
  maxRetries: 1,
  // Path to the TaskMaster tasks.json file
  tasksPath: process.env.TASKS_PATH || path.resolve(process.cwd(), 'tasks', 'tasks.json'),
  // Dart API configuration
  dart: {
    apiKey: process.env.DART_API_KEY,
    baseUrl: process.env.DART_API_URL || 'https://api.itsdart.com/api',
  },
  // Log level
  logLevel: process.env.LOG_LEVEL || 'info',
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
  },
};

/**
 * Validate a message against the schema
 * @param {Object} message - The message to validate
 * @returns {boolean} - Whether the message is valid
 */
function validateMessage(message) {
  try {
    // Basic validation
    if (!message) return false;
    if (!message.source || !['Dart', 'TaskMaster'].includes(message.source)) return false;
    if (!message.task_id) return false;
    if (!message.update_type || !['create', 'update', 'complete', 'delete'].includes(message.update_type)) return false;
    if (!message.timestamp) return false;
    if (!message.payload || !message.payload.status) return false;
    
    return true;
  } catch (error) {
    logger.error('Error validating message:', error);
    return false;
  }
}

/**
 * Check if a message has already been processed
 * @param {Object} message - The message to check
 * @returns {boolean} - Whether the message has been processed
 */
function isMessageProcessed(message) {
  const messageId = `${message.source}-${message.task_id}-${message.timestamp}`;
  if (processedMessages.has(messageId)) {
    return true;
  }
  
  // Add to processed messages
  processedMessages.add(messageId);
  
  // Limit cache size to prevent memory leaks
  if (processedMessages.size > 1000) {
    const iterator = processedMessages.values();
    processedMessages.delete(iterator.next().value);
  }
  
  return false;
}

/**
 * Send a message from Dart to TaskMaster
 * @param {Object} message - The message to send
 * @returns {Promise<Object>} - The result of the operation
 */
export async function sendDartToTaskMaster(message) {
  try {
    // Validate the message
    if (!validateMessage(message)) {
      throw new Error('Invalid message format');
    }
    
    // Check if already processed to prevent loops
    if (isMessageProcessed(message)) {
      logger.debug('Message already processed, skipping:', message.task_id);
      return { success: true, skipped: true };
    }
    
    logger.info(`Processing Dart -> TaskMaster: ${message.update_type} for task ${message.task_id}`);
    
    // Load the TaskMaster tasks
    const tasksData = await loadTaskMasterTasks();
    
    // Process based on update type
    switch (message.update_type) {
      case 'create':
        await createTaskInTaskMaster(message, tasksData);
        break;
      case 'update':
        await updateTaskInTaskMaster(message, tasksData);
        break;
      case 'complete':
        await completeTaskInTaskMaster(message, tasksData);
        break;
      case 'delete':
        await deleteTaskInTaskMaster(message, tasksData);
        break;
      default:
        throw new Error(`Unsupported update type: ${message.update_type}`);
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Error sending message from Dart to TaskMaster:', error);
    throw error;
  }
}

/**
 * Send a message from TaskMaster to Dart
 * @param {Object} message - The message to send
 * @returns {Promise<Object>} - The result of the operation
 */
export async function sendTaskMasterToDart(message) {
  try {
    // Validate the message
    if (!validateMessage(message)) {
      throw new Error('Invalid message format');
    }
    
    // Check if already processed to prevent loops
    if (isMessageProcessed(message)) {
      logger.debug('Message already processed, skipping:', message.task_id);
      return { success: true, skipped: true };
    }
    
    logger.info(`Processing TaskMaster -> Dart: ${message.update_type} for task ${message.task_id}`);
    
    // Process based on update type
    switch (message.update_type) {
      case 'create':
        await createTaskInDart(message);
        break;
      case 'update':
        await updateTaskInDart(message);
        break;
      case 'complete':
        await completeTaskInDart(message);
        break;
      case 'delete':
        await deleteTaskInDart(message);
        break;
      default:
        throw new Error(`Unsupported update type: ${message.update_type}`);
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Error sending message from TaskMaster to Dart:', error);
    throw error;
  }
}

/**
 * Load TaskMaster tasks from the tasks.json file
 * @returns {Promise<Object>} - The tasks data
 */
async function loadTaskMasterTasks() {
  try {
    const tasksJson = await fs.promises.readFile(config.tasksPath, 'utf8');
    return JSON.parse(tasksJson);
  } catch (error) {
    logger.error('Error loading TaskMaster tasks:', error);
    throw new Error(`Failed to load TaskMaster tasks: ${error.message}`);
  }
}

/**
 * Save TaskMaster tasks to the tasks.json file
 * @param {Object} tasksData - The tasks data to save
 * @returns {Promise<void>}
 */
async function saveTaskMasterTasks(tasksData) {
  try {
    await fs.promises.writeFile(
      config.tasksPath,
      JSON.stringify(tasksData, null, 2),
      'utf8'
    );
  } catch (error) {
    logger.error('Error saving TaskMaster tasks:', error);
    throw new Error(`Failed to save TaskMaster tasks: ${error.message}`);
  }
}

/**
 * Create a task in TaskMaster
 * @param {Object} message - The message with task data
 * @param {Object} tasksData - The current TaskMaster tasks
 * @returns {Promise<void>}
 */
async function createTaskInTaskMaster(message, tasksData) {
  try {
    // Generate a new task ID if not using an existing one
    const newTaskId = tasksData.tasks.length + 1;
    
    // Create the new task
    const newTask = {
      id: newTaskId,
      title: message.payload.title || `Task from Dart: ${message.task_id}`,
      description: message.payload.description || '',
      status: mapDartStatusToTaskMaster(message.payload.status),
      priority: message.payload.priority || 'medium',
      dependencies: [],
      details: '',
      testStrategy: '',
      subtasks: [],
      metadata: {
        dartId: message.task_id,
        ...message.payload.metadata
      }
    };
    
    // Add the task to the tasks array
    tasksData.tasks.push(newTask);
    
    // Save the updated tasks
    await saveTaskMasterTasks(tasksData);
    
    logger.info(`Created task in TaskMaster: ${newTaskId}`);
  } catch (error) {
    logger.error('Error creating task in TaskMaster:', error);
    throw error;
  }
}

/**
 * Update a task in TaskMaster
 * @param {Object} message - The message with task data
 * @param {Object} tasksData - The current TaskMaster tasks
 * @returns {Promise<void>}
 */
async function updateTaskInTaskMaster(message, tasksData) {
  try {
    // Find the task by Dart ID in metadata
    const taskIndex = tasksData.tasks.findIndex(
      task => task.metadata && task.metadata.dartId === message.task_id
    );
    
    if (taskIndex === -1) {
      logger.warn(`Task not found in TaskMaster: ${message.task_id}`);
      // Create the task if it doesn't exist
      await createTaskInTaskMaster(message, tasksData);
      return;
    }
    
    // Update the task
    const task = tasksData.tasks[taskIndex];
    
    if (message.payload.title) task.title = message.payload.title;
    if (message.payload.description) task.description = message.payload.description;
    if (message.payload.status) task.status = mapDartStatusToTaskMaster(message.payload.status);
    if (message.payload.priority) task.priority = message.payload.priority;
    
    // Update metadata
    task.metadata = {
      ...task.metadata,
      ...message.payload.metadata,
      lastUpdated: message.timestamp
    };
    
    // Save the updated tasks
    await saveTaskMasterTasks(tasksData);
    
    logger.info(`Updated task in TaskMaster: ${task.id}`);
  } catch (error) {
    logger.error('Error updating task in TaskMaster:', error);
    throw error;
  }
}

/**
 * Complete a task in TaskMaster
 * @param {Object} message - The message with task data
 * @param {Object} tasksData - The current TaskMaster tasks
 * @returns {Promise<void>}
 */
async function completeTaskInTaskMaster(message, tasksData) {
  try {
    // Find the task by Dart ID in metadata
    const taskIndex = tasksData.tasks.findIndex(
      task => task.metadata && task.metadata.dartId === message.task_id
    );
    
    if (taskIndex === -1) {
      logger.warn(`Task not found in TaskMaster: ${message.task_id}`);
      return;
    }
    
    // Update the task status to done
    tasksData.tasks[taskIndex].status = 'done';
    
    // Update metadata
    tasksData.tasks[taskIndex].metadata = {
      ...tasksData.tasks[taskIndex].metadata,
      completedAt: message.timestamp,
      lastUpdated: message.timestamp
    };
    
    // Save the updated tasks
    await saveTaskMasterTasks(tasksData);
    
    logger.info(`Completed task in TaskMaster: ${tasksData.tasks[taskIndex].id}`);
  } catch (error) {
    logger.error('Error completing task in TaskMaster:', error);
    throw error;
  }
}

/**
 * Delete a task in TaskMaster
 * @param {Object} message - The message with task data
 * @param {Object} tasksData - The current TaskMaster tasks
 * @returns {Promise<void>}
 */
async function deleteTaskInTaskMaster(message, tasksData) {
  try {
    // Find the task by Dart ID in metadata
    const taskIndex = tasksData.tasks.findIndex(
      task => task.metadata && task.metadata.dartId === message.task_id
    );
    
    if (taskIndex === -1) {
      logger.warn(`Task not found in TaskMaster: ${message.task_id}`);
      return;
    }
    
    // Remove the task
    tasksData.tasks.splice(taskIndex, 1);
    
    // Save the updated tasks
    await saveTaskMasterTasks(tasksData);
    
    logger.info(`Deleted task in TaskMaster: ${message.task_id}`);
  } catch (error) {
    logger.error('Error deleting task in TaskMaster:', error);
    throw error;
  }
}

/**
 * Create a task in Dart
 * @param {Object} message - The message with task data
 * @returns {Promise<void>}
 */
async function createTaskInDart(message) {
  try {
    // Prepare the task data for Dart API
    const taskData = {
      title: message.payload.title,
      description: message.payload.description,
      status: mapTaskMasterStatusToDart(message.payload.status),
      priority: message.payload.priority,
      // Add other fields as needed
    };
    
    // Call Dart API to create the task
    const response = await fetch(`${config.dart.baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.dart.apiKey}`
      },
      body: JSON.stringify(taskData)
    });
    
    if (!response.ok) {
      throw new Error(`Dart API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    logger.info(`Created task in Dart: ${result.id}`);
    
    return result;
  } catch (error) {
    logger.error('Error creating task in Dart:', error);
    throw error;
  }
}

/**
 * Update a task in Dart
 * @param {Object} message - The message with task data
 * @returns {Promise<void>}
 */
async function updateTaskInDart(message) {
  try {
    // Extract the Dart task ID from the message
    const dartTaskId = message.payload.metadata?.dartId;
    
    if (!dartTaskId) {
      logger.warn('No Dart task ID found in message metadata');
      // Create the task if it doesn't exist
      await createTaskInDart(message);
      return;
    }
    
    // Prepare the task data for Dart API
    const taskData = {};
    if (message.payload.title) taskData.title = message.payload.title;
    if (message.payload.description) taskData.description = message.payload.description;
    if (message.payload.status) taskData.status = mapTaskMasterStatusToDart(message.payload.status);
    if (message.payload.priority) taskData.priority = message.payload.priority;
    
    // Call Dart API to update the task
    const response = await fetch(`${config.dart.baseUrl}/tasks/${dartTaskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.dart.apiKey}`
      },
      body: JSON.stringify(taskData)
    });
    
    if (!response.ok) {
      throw new Error(`Dart API error: ${response.status} ${response.statusText}`);
    }
    
    logger.info(`Updated task in Dart: ${dartTaskId}`);
  } catch (error) {
    logger.error('Error updating task in Dart:', error);
    throw error;
  }
}

/**
 * Complete a task in Dart
 * @param {Object} message - The message with task data
 * @returns {Promise<void>}
 */
async function completeTaskInDart(message) {
  try {
    // Extract the Dart task ID from the message
    const dartTaskId = message.payload.metadata?.dartId;
    
    if (!dartTaskId) {
      logger.warn('No Dart task ID found in message metadata');
      return;
    }
    
    // Prepare the task data for Dart API
    const taskData = {
      status: 'Done' // Use the appropriate status value for Dart
    };
    
    // Call Dart API to update the task
    const response = await fetch(`${config.dart.baseUrl}/tasks/${dartTaskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.dart.apiKey}`
      },
      body: JSON.stringify(taskData)
    });
    
    if (!response.ok) {
      throw new Error(`Dart API error: ${response.status} ${response.statusText}`);
    }
    
    logger.info(`Completed task in Dart: ${dartTaskId}`);
  } catch (error) {
    logger.error('Error completing task in Dart:', error);
    throw error;
  }
}

/**
 * Delete a task in Dart
 * @param {Object} message - The message with task data
 * @returns {Promise<void>}
 */
async function deleteTaskInDart(message) {
  try {
    // Extract the Dart task ID from the message
    const dartTaskId = message.payload.metadata?.dartId;
    
    if (!dartTaskId) {
      logger.warn('No Dart task ID found in message metadata');
      return;
    }
    
    // Call Dart API to delete the task
    const response = await fetch(`${config.dart.baseUrl}/tasks/${dartTaskId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${config.dart.apiKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Dart API error: ${response.status} ${response.statusText}`);
    }
    
    logger.info(`Deleted task in Dart: ${dartTaskId}`);
  } catch (error) {
    logger.error('Error deleting task in Dart:', error);
    throw error;
  }
}

/**
 * Map Dart status to TaskMaster status
 * @param {string} dartStatus - The status from Dart
 * @returns {string} - The equivalent TaskMaster status
 */
function mapDartStatusToTaskMaster(dartStatus) {
  const statusMap = {
    'To-do': 'pending',
    'Doing': 'in-progress',
    'Done': 'done'
  };
  
  return statusMap[dartStatus] || 'pending';
}

/**
 * Map TaskMaster status to Dart status
 * @param {string} taskMasterStatus - The status from TaskMaster
 * @returns {string} - The equivalent Dart status
 */
function mapTaskMasterStatusToDart(taskMasterStatus) {
  const statusMap = {
    'pending': 'To-do',
    'in-progress': 'Doing',
    'done': 'Done'
  };
  
  return statusMap[taskMasterStatus] || 'To-do';
}

/**
 * Initialize the MCP connector
 * @returns {Object} - The connector API
 */
export function initMCPConnector() {
  logger.info('Initializing Dart-TaskMaster MCP Connector');
  
  return {
    sendDartToTaskMaster,
    sendTaskMasterToDart,
    config
  };
}

export default {
  initMCPConnector,
  sendDartToTaskMaster,
  sendTaskMasterToDart
};
