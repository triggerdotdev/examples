# GitHub Repository Chat with AI

A production-ready Next.js application that enables real-time conversations with GitHub repositories using Claude AI. Built with Trigger.dev for background processing, Supabase for realtime messaging, and Claude Agent SDK for intelligent code analysis.

## Architecture Overview

This application uses a hybrid architecture combining:

- **Trigger.dev Realtime Streams v2** for streaming AI responses (main data pipeline)
- **Supabase Broadcast** for sending questions to the AI (lightweight control plane)
- **Claude Agent SDK** for repository analysis with tool usage
- **Build Extensions** for containerized git operations

## Key Features

- **Two-Task System**:
  - Task 1: Clones repository with git build extension
  - Task 2: Long-running chat session that maintains repo in memory
- **No Re-cloning**: Repository stays in memory for entire chat session (up to 60 minutes)
- **Real-time Streaming**: AI responses stream live via Trigger.dev Streams v2
- **Tool Usage Visualization**: See Claude using Bash, Grep, Read, and other tools
- **Session Management**: Unique session IDs link clone and chat operations

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Trigger.dev v4 for task orchestration
- **AI**: Claude Agent SDK with extended thinking
- **Realtime**: Trigger.dev Streams v2 + Supabase Broadcast
- **Build**: Trigger.dev build extensions with apt-get for git

## Getting Started

### Prerequisites

1. Create accounts and get API keys:
   - [Trigger.dev](https://cloud.trigger.dev) - Project ref and secret key
   - [Anthropic](https://console.anthropic.com) - Claude API key
   - [Supabase](https://app.supabase.com) - Project URL and anon key

### Environment Setup

1. Copy the example environment file:

```bash
cp .env.example .env.local
```

2. Add your API keys to `.env.local`:

```env
# Trigger.dev
TRIGGER_PROJECT_REF=your_project_ref
TRIGGER_SECRET_KEY=your_secret_key

# Claude API
ANTHROPIC_API_KEY=your_anthropic_api_key

# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation

```bash
npm install
```

### Development

Run both the Next.js app and Trigger.dev dev server:

```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: Trigger.dev
npx trigger.dev@latest dev
```

Open [http://localhost:3000](http://localhost:3000)

### Deployment

Deploy to Trigger.dev:

```bash
npx trigger.dev@latest deploy
```

Deploy Next.js to Vercel:

```bash
vercel deploy
```

## How It Works

### Flow Diagram

```
User enters GitHub URL
    ↓
Task 1: clone-repo (with git build extension)
    ↓
Returns { tempDir, sessionId, repoName }
    ↓
Task 2: repo-chat-session (long-running, 60 min timeout)
    ↓
Subscribes to Supabase channel for questions
    ↓
User sends questions → Supabase → Task 2
    ↓
Claude analyzes repo with tools
    ↓
Responses stream via Trigger.dev Streams v2 → Frontend
```

### Key Components

1. **Build Extension** (`trigger.config.ts`):

   - Installs git via apt-get in container
   - Enables shallow cloning without local git dependency

2. **Clone Task** (`trigger/clone-repo.ts`):

   - Performs shallow clone (`--depth=1`)
   - Generates unique session ID
   - Returns temp directory path

3. **Chat Session Task** (`trigger/repo-chat-session.ts`):

   - Maintains repo in memory for 60 minutes
   - Listens for questions via Supabase Broadcast
   - Streams responses via Trigger.dev Streams v2
   - Cleans up temp directory on exit

4. **Frontend** (`app/chat/[runId]/page.tsx`):
   - Sends questions via Supabase
   - Receives responses via Trigger.dev Streams
   - Displays tool usage and AI reasoning

## Project Structure

```
app/
├── page.tsx                    # Landing page
├── chat/[runId]/page.tsx      # Chat interface
└── api/
    ├── analyze-repo/           # Triggers both tasks
    └── chat/                   # Sends questions via Supabase

trigger/
├── clone-repo.ts              # Task 1: Git clone
├── repo-chat-session.ts       # Task 2: Long-running chat
└── agent-stream.ts            # Shared stream definition

components/
├── chat/
│   ├── user-message.tsx      # User message display
│   ├── ai-message.tsx        # AI response with markdown
│   └── tool-card.tsx         # Tool usage visualization
└── ui/                        # shadcn/ui components
```

## Advanced Features

- **60-minute sessions**: Extended timeout for complex analysis
- **Abort handling**: Graceful cleanup on cancellation
- **Error recovery**: Fallback to Trigger.dev streams if Supabase fails
- **Progress tracking**: Real-time status updates
- **Tool visualization**: Collapsible tool results over 50 lines

## Limitations

- Public repositories only (no auth for private repos)
- Maximum session duration: 60 minutes
- Shallow clone only (no full git history)
- One active question at a time per session

## Development Notes

This demo showcases:

- Trigger.dev Realtime Streams v2 for data streaming
- Build extensions for containerized dependencies
- Hybrid architecture pattern (control + data plane separation)
- Long-running task management
- Claude Agent SDK integration
