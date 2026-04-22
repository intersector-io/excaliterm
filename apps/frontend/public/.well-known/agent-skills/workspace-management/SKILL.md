# Workspace Management

## Description
Create and manage collaborative terminal canvas workspaces in Excaliterm.

## Endpoints

### Create Workspace
- **POST** `/api/workspaces`
- Returns a new workspace with `id` and `apiKey`

### Get Workspace
- **GET** `/api/workspaces/:workspaceId`
- Returns workspace details

## Usage
1. Create a workspace via the API
2. Share the workspace URL `/w/:workspaceId` for browser-based collaboration
3. Connect terminal agents using the workspace API key
