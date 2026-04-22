# Excaliterm

Excaliterm is a collaborative terminal canvas workspace. Create shared workspaces where multiple users can interact with terminal sessions, edit code, take notes, and chat in real-time.

## Features

- **Collaborative Terminal Sessions** — Share terminal sessions in real-time with your team
- **Canvas Workspace** — Arrange terminals, notes, and editors on an infinite canvas
- **Code Editor** — Built-in Monaco editor with syntax highlighting
- **Sticky Notes** — Add notes and annotations to your workspace
- **Real-time Chat** — Communicate with collaborators within the workspace
- **Terminal Agent** — Connect headless terminal agents via CLI

## Getting Started

1. Visit the homepage to create a new workspace automatically
2. Share the workspace URL with collaborators
3. Optionally connect a terminal agent using the Excaliterm CLI

## API

- **Health Check**: `GET /api/health`
- **Create Workspace**: `POST /api/workspaces`
- **Get Workspace**: `GET /api/workspaces/:id`
- **Terminals**: `GET|POST /api/w/:workspaceId/terminals`
- **Canvas**: `GET|POST /api/w/:workspaceId/canvas`
- **Chat**: `GET|POST /api/w/:workspaceId/chat`
- **Notes**: `GET|POST /api/w/:workspaceId/notes`
- **Files**: `GET|POST /api/w/:workspaceId/files`
- **Services**: `GET /api/w/:workspaceId/services`

## Discovery

- [API Catalog](/.well-known/api-catalog)
- [MCP Server Card](/.well-known/mcp/server-card.json)
- [Agent Skills](/.well-known/agent-skills/index.json)
