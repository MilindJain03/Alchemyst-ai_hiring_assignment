# Agent Console Architecture

This document provides an overview of the Agent Console architecture and design decisions.

**For detailed architectural decisions, see [DECISIONS.md](../DECISIONS.md)**

## Quick Summary

The Agent Console is a Next.js 14 application providing a real-time interface to monitor and interact with an AI agent backend via WebSocket.

### Key Components

- **WebSocket Manager** (`lib/ws/manager.ts`) - Handles connection lifecycle and message routing
- **Sequence Buffer** (`lib/ws/sequenceBuffer.ts`) - Ensures in-order message processing even with chaos mode
- **Zustand Store** (`lib/store/agentStore.ts`) - Manages application state with Immer for immutability
- **Chat Panel** (`components/ChatPanel.tsx`) - Main UI for streaming agent responses
- **Trace Timeline** (`components/TraceTimeline.tsx`) - Visualization of agent execution events

### Data Flow

1. User sends a message via ChatPanel
2. WebSocket sends USER_MESSAGE to backend
3. Backend streams TOKEN events, optionally sends TOOL_CALL
4. SequenceBuffer orders messages and pushes to Zustand store
5. React components subscribe to store and render updates

## Features

- **Out-of-order Message Handling** - Min-heap based reordering for chaos mode testing
- **Reconnection Recovery** - Automatic reconnection with exponential backoff
- **Tool Call Interruption** - Tool results don't cause layout reflow of preceding text
- **Context Inspection** - Visual diff of context updates
- **Stream Virtualization** - Handles large responses efficiently

See [DECISIONS.md](../DECISIONS.md) for technical deep-dives on each feature.
