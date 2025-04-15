#!/bin/bash

# Change to the integration directory
cd /Users/anwarselo/Desktop/Development/test/integrations/dart-taskmaster

# Start the integration with PM2
pm2 start index.js --name "dart-taskmaster-integration" --time

# Save the PM2 process list
pm2 save

echo "Dart-TaskMaster integration started successfully!"
