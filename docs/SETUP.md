# Setup Guide

## Prerequisites

- Node.js 18.x or 20.x
- npm or yarn
- Git

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd June-2026FullStackAI
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Copy the example environment file and update as needed:
```bash
cp .env.example .env.local
```

Edit `.env.local` to set your WebSocket server URL:
```
NEXT_PUBLIC_WS_URL=ws://localhost:4747
```

## Running the Application

### Development Mode
```bash
npm run dev
```
The app will start at `http://localhost:5000`

### Production Build
```bash
npm run build
npm start
```

## Testing Keywords

Use these keywords in the chat to test different features:

| Keyword | Feature |
|---------|---------|
| `hello` | Basic streaming, no tool calls |
| `report` / `q3` | One tool call mid-stream + context update |
| `analyze` / `compare` | Two sequential tool calls |
| `search` / `find` | Tool call before tokens |
| `schema` / `large` | 500KB+ context + tree rendering |
| `long` / `document` | High token count stream |

## Troubleshooting

### Connection Fails
- Verify the WebSocket server is running on the correct port
- Check `NEXT_PUBLIC_WS_URL` in `.env.local`
- Review browser console for connection errors

### Build Errors
- Clear `.next/` directory: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Verify Node.js version: `node --version`

### Performance Issues
- Check Timeline virtualization is working (see [ARCHITECTURE.md](./ARCHITECTURE.md))
- Monitor token throughput and adjust batch sizes if needed

## Backend Server

If running a local agent server:

```bash
# See your backend server documentation for setup
# Typically listens on ws://localhost:4747
```

## More Information

- [Architecture Overview](./ARCHITECTURE.md)
- [Architectural Decisions](../DECISIONS.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
