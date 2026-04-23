# Workspaces

A **workspace** is a shared collaborative space containing hosts, terminals, notes, chat, and files. Each workspace has a unique URL that anyone can open to join instantly.

## Creating a workspace

Open the app at the root URL. A new workspace is created automatically on first visit and the browser is redirected to `/w/<workspaceId>`. The ID is a short random identifier.

## Sharing a workspace

Copy the URL from the browser and send it to anyone. They join as a collaborator with no sign-up or account. Multiple people can work in the same workspace simultaneously.

## Editable display name

The workspace header shows an editable display name. Click it to rename the workspace. The name is per-workspace and visible to all collaborators.

## Workspace API key

Each workspace has an auto-generated API key used by the terminal-agent CLI to connect a machine to the workspace. Open **Connect a Host** from the canvas toolbar to see the full connection command with the API key pre-filled. The key can be shown or hidden in the dialog.

## Persistence

Everything you create in a workspace — terminals, notes, canvas layout, chat history, command history, screenshots — is persisted server-side and available to anyone who opens the URL.
