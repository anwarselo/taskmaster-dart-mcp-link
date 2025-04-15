/**
 * TaskMaster Event Listener
 * 
 * This module listens for changes to TaskMaster tasks and sends updates to Dart
 * via the MCP connector.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initMCPConnector } from './mcp-connector.js';

// Load environment variables
dotenv.config();

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize the MCP connector
const mcpConnector = initMCPConnector();

// Configuration
const config = {
  // Path to the TaskMaster tasks.json file
  tasksPath: process.env.TASKS_PATH || path.resolve(process.cwd(), 'tasks', 'tasks.json'),
  // How often to check for changes (in milliseconds)
  pollInterval: parseInt(process.env.POLL_INTERVAL, 10) || 5000,
  // Log level
  logLevel: process.env.LOG_LEVEL || 'info'
};

/**
 * Logger utility
 */
const logger = {
  debug: (...args) => {
    if (config.logLevel === 'debug') console.debug('[TaskMaster Listener]', ...args);
  },
  info: (...args) => {
    if (['debug', 'info'].includes(config.logLevel)) console.info('[TaskMaster Listener]', ...args);
  },
  warn: (...args) => {
    if (['debug', 'info', 'warn'].includes(config.logLevel)) console.warn('[TaskMaster Listener]', ...args);
  },
  error: (...args) => {
    console.error('[TaskMaster Listener]', ...args);
  }
};

// Store the last known state of tasks
let lastKnownTasks = null;

/**
 * Start listening for TaskMaster task changes
 * @returns {Object} - The listener instance
 */
export function startTaskMasterListener() {
  logger.info('Starting TaskMaster listener');
  
  // Check if the tasks file exists
  if (!fs.existsSync(config.tasksPath)) {
    logger.warn(`TaskMaster tasks file not found at ${config.tasksPath}`);
    logger.info('Waiting for tasks file to be created...');
  }
  
  // Start polling for changes
  const intervalId = setInterval(checkForChanges, config.pollInterval);
  
  // Return the listener instance
  return {
    stop: () => {
      clearInterval(intervalId);
      logger.info('TaskMaster listener stopped');
    }
  };
}

/**
 * Check for changes to TaskMaster tasks
 */
async function checkForChanges() {
  try {
    // Check if the tasks file exists
    if (!fs.existsSync(config.tasksPath)) {
      return;
    }
    
    // Read the tasks file
    const tasksJson = await fs.promises.readFile(config.tasksPath, 'utf8');
    const currentTasks = JSON.parse(tasksJson);
    
    // If this is the first time, just store the current state
    if (lastKnownTasks === null) {
      lastKnownTasks = currentTasks;
      logger.debug('Initial tasks loaded');
      return;
    }
    
    // Compare the current tasks with the last known tasks
    const changes = detectChanges(lastKnownTasks, currentTasks);
    
    // Process any changes
    if (changes.length > 0) {
      logger.info(`Detected ${changes.length} changes to TaskMaster tasks`);
      
      // Process each change
      for (const change of changes) {
        await processChange(change);
      }
    }
    
    // Update the last known tasks
    lastKnownTasks = currentTasks;
  } catch (error) {
    logger.error('Error checking for changes:', error);
  }
}

/**
 * Detect changes between two sets of tasks
 * @param {Object} oldTasks - The old tasks
 * @param {Object} newTasks - The new tasks
 * @returns {Array} - The detected changes
 */
function detectChanges(oldTasks, newTasks) {
  const changes = [];
  
  // Check for new or updated tasks
  for (const newTask of newTasks.tasks) {
    const oldTask = oldTasks.tasks.find(task => task.id === newTask.id);
    
    if (!oldTask) {
      // New task
      changes.push({
        type: 'create',
        task: newTask
      });
    } else if (JSON.stringify(oldTask) !== JSON.stringify(newTask)) {
      // Updated task
      if (oldTask.status !== newTask.status && newTask.status === 'done') {
        // Task completed
        changes.push({
          type: 'complete',
          task: newTask,
          oldTask
        });
      } else {
        // Task updated
        changes.push({
          type: 'update',
          task: newTask,
          oldTask
        });
      }
    }
  }
  
  // Check for deleted tasks
  for (const oldTask of oldTasks.tasks) {
    const taskExists = newTasks.tasks.some(task => task.id === oldTask.id);
    
    if (!taskExists) {
      // Deleted task
      changes.push({
        type: 'delete',
        task: oldTask
      });
    }
  }
  
  return changes;
}

/**
 * Process a detected change
 * @param {Object} change - The change to process
 */
async function processChange(change) {
  try {
    logger.debug(`Processing ${change.type} for task ${change.task.id}`);
    
    // Skip tasks that don't have a Dart ID in metadata
    // (unless it's a new task that we want to create in Dart)
    if (change.type !== 'create' && 
        (!change.task.metadata || !change.task.metadata.dartId)) {
      logger.debug(`Skipping task ${change.task.id} - no Dart ID in metadata`);
      return;
    }
    
    // Create the message
    const message = {
      source: 'TaskMaster',
      task_id: change.task.id.toString(),
      update_type: change.type,
      timestamp: new Date().toISOString(),
      payload: {
        status: change.task.status,
        title: change.task.title,
        description: change.task.description,
        priority: change.task.priority,
        metadata: {
          ...change.task.metadata,
          taskMasterId: change.task.id
        }
      }
    };
    
    // Send the message to Dart
    await mcpConnector.sendTaskMasterToDart(message);
    
    logger.info(`Sent ${change.type} update to Dart for task ${change.task.id}`);
  } catch (error) {
    logger.error(`Error processing ${change.type} for task ${change.task.id}:`, error);
  }
}

// Start the listener if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startTaskMasterListener();
}

export default {
  startTaskMasterListener
};
