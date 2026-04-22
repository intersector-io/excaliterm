# Terminal Sessions

## Description
Open, interact with, and manage terminal sessions within an Excaliterm workspace.

## Endpoints

### List Terminals
- **GET** `/api/w/:workspaceId/terminals`
- Returns all terminal sessions in the workspace

### Create Terminal
- **POST** `/api/w/:workspaceId/terminals`
- Creates a new terminal session

## Real-time Communication
Terminal I/O uses SignalR WebSocket connections at `/hubs/terminal` for real-time bidirectional communication.

## Usage
1. Create or list terminals via the REST API
2. Connect to the SignalR hub for real-time terminal interaction
3. Send input and receive output through the WebSocket connection
