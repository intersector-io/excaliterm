# Collaboration (Presence & Locks)

Anyone with the workspace URL can join as a collaborator. Excaliterm shows you who is connected, what they're typing, and lets you claim exclusive access to a terminal when you need it.

## Display name

A collaborator **display name** identifies you in chat, presence, and lock indicators. Click your name in the sidebar (desktop) or workspace header (mobile) to edit it. The name is per-workspace and stored locally in your browser — other people see it in real time.

## Presence

The canvas toolbar shows:

- A count of connected collaborators
- Stacked avatars (first few names)
- Live join/leave updates as people open or close the workspace

## Typing indicators

When someone is typing into a terminal, a small "typing" indicator appears near that terminal for other viewers. It's throttled (roughly one refresh per second) so it doesn't flicker.

## Terminal locks

Terminal locks give one collaborator exclusive write access so two people don't fight over the prompt.

- Click the **lock icon** on a terminal to claim the lock.
- While you own the lock, a **cyan ring** is shown around the terminal. Others can still see output but their input is blocked.
- Click the lock again to release it.
- A terminal locked by someone else shows a disabled state; you'll see who holds the lock in the hover/tooltip.
- Locks are released automatically when the lock-holder disconnects or when the terminal exits.

## What's not collaborative

- Terminal **scroll position** and **xterm selection** are local to each viewer.
- The canvas **zoom/pan** is local — but **node positions and sizes** are shared.
- The **focused terminal** (`#focus=` hash) is local to each viewer but can be shared via the URL.
