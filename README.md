# Dart-TaskMaster MCP Integration

A bidirectional integration between [Dart AI](https://itsdart.com) and [TaskMaster AI](https://github.com/eyaltoledano/claude-task-master) using the Model Context Protocol (MCP) with standardized inputs.

## Overview

This integration connects Dart AI's high-level project management capabilities with TaskMaster's code-specific task orchestration, creating a seamless workflow between the two systems. It uses a standardized JSON schema for communication and provides bidirectional updates to keep both systems in sync.

## Features

- **Bidirectional Synchronization**: Changes in either system are automatically reflected in the other
- **Standardized Communication**: All messages follow a consistent JSON schema
- **MCP Integration**: Uses the Model Context Protocol for efficient, structured data exchange
- **Webhook Support**: Receives real-time updates from Dart via webhooks
- **Task Mapping**: Intelligently maps between Dart and TaskMaster task structures
- **Error Handling**: Includes retry mechanisms and comprehensive error logging
- **Idempotency**: Prevents duplicate processing and update loops

## Architecture

The integration consists of several components:

1. **MCP Connector** (`mcp-connector.js`): Core module that handles bidirectional communication
2. **MCP Server** (`mcp-server.js`): Exposes MCP tools for integration with other systems
3. **TaskMaster Listener** (`taskmaster-listener.js`): Monitors TaskMaster tasks for changes
4. **Dart Webhook Handler** (`dart-webhook.js`): Receives webhooks from Dart when tasks change
5. **Main Integration Module** (`index.js`): Provides a simple API to start and stop all components

## Installation

### Prerequisites

- Node.js 14.0.0 or higher
- TaskMaster AI installed and configured
- Dart AI account with API access
- Ability to receive webhooks (for production use)

### Setup

1. Create a configuration file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your Dart API key, webhook secret, and other settings.

## Usage

### Starting the Integration

#### Manual Start

```bash
node integrations/dart-taskmaster/index.js
```

This will start:
- The MCP server on port 3100 (configurable)
- The webhook server on port 3101 (configurable)
- The TaskMaster listener that monitors for task changes

#### Automatic Startup (Recommended)

The integration can be configured to start automatically on system boot:

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Start the integration with PM2:
   ```bash
   cd integrations/dart-taskmaster
   pm2 start index.js --name "dart-taskmaster-integration" --time
   pm2 save
   ```

3. Set up PM2 to start on system boot:
   ```bash
   # For macOS
   pm2 startup launchd

   # For Linux
   pm2 startup

   # For Windows
   pm2 startup windows
   ```

4. Follow the instructions provided by the startup command

#### Managing the Integration with PM2

- Check status: `pm2 status`
- View logs: `pm2 logs dart-taskmaster-integration`
- Restart: `pm2 restart dart-taskmaster-integration`
- Stop: `pm2 stop dart-taskmaster-integration`
- Start: `pm2 start dart-taskmaster-integration`

### Using as a Module

You can also import and use the integration in your own code:

```javascript
import { start, stop } from './integrations/dart-taskmaster/index.js';

// Start the integration
const services = await start();

// Stop the integration when done
await stop();
```

### Configuring Dart Webhooks

To receive real-time updates from Dart:

1. Go to your Dart AI settings
2. Configure a webhook endpoint pointing to `http://your-server:3101/webhook`
3. Set the webhook secret in your `.env` file

## Configuration Options

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `MCP_PORT` | Port for the MCP server | 3100 |
| `MCP_HOST` | Host for the MCP server | localhost |
| `WEBHOOK_PORT` | Port for the webhook server | 3101 |
| `WEBHOOK_HOST` | Host for the webhook server | localhost |
| `DART_WEBHOOK_SECRET` | Secret for validating Dart webhooks | - |
| `DART_API_KEY` | Your Dart API key | - |
| `DART_API_URL` | Dart API URL | https://api.itsdart.com/api |
| `TASKS_PATH` | Path to TaskMaster tasks.json | ./tasks/tasks.json |
| `POLL_INTERVAL` | How often to check for TaskMaster changes (ms) | 5000 |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | info |

## Message Schema

All communication between Dart and TaskMaster follows this standardized schema:

```json
{
  "source": "Dart" | "TaskMaster",
  "task_id": "unique-task-identifier",
  "update_type": "create" | "update" | "complete" | "delete",
  "timestamp": "ISO-8601 timestamp",
  "payload": {
    "status": "task-status",
    "title": "task-title",
    "description": "task-description",
    "priority": "task-priority",
    "metadata": {
      // Additional system-specific metadata
    }
  }
}
```

## Development

### Project Structure

```
integrations/dart-taskmaster/
├── index.js              # Main entry point
├── mcp-connector.js      # Core connector module
├── mcp-server.js         # MCP server implementation
├── taskmaster-listener.js # TaskMaster change listener
├── dart-webhook.js       # Dart webhook handler
└── schema.json           # JSON schema definition
```

## Troubleshooting

### Common Issues

1. **Webhook not receiving updates**
   - Check that your server is publicly accessible
   - Verify the webhook secret is correctly configured
   - Check Dart webhook settings

2. **Tasks not syncing**
   - Ensure TaskMaster tasks.json exists and is readable
   - Check the LOG_LEVEL is set to debug for more information
   - Verify Dart API key has sufficient permissions

### Logs

Set `LOG_LEVEL=debug` in your `.env` file for detailed logging information.

## License

This project is licensed under the MIT License.

## Acknowledgements

- [Dart AI](https://itsdart.com) for their excellent project management platform
- [TaskMaster AI](https://github.com/eyaltoledano/claude-task-master) for the code-specific task management system
- [Eyal Toledano](https://x.com/eyaltoledano) for creating TaskMaster
