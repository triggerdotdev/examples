# Repo Wiki Chat

A Next.js 14 demo application that showcases how to chat with GitHub repositories using AI. Users can paste a GitHub URL, ask questions about the codebase, and see AI's reasoning and tool usage stream live.

## Features

- **Landing Page**: Clean, modern interface with GitHub URL input and example repositories
- **Chat Interface**: Real-time conversation with AI about repository code
- **Tool Usage Visualization**: View AI's tool calls (Read, Grep, Bash) with expandable results
- **Responsive Design**: Works seamlessly across desktop and mobile devices
- **Mock Data**: Demo includes sample conversations showing typical AI analysis

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- React Markdown for message formatting

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
app/
  ├── page.tsx              # Landing page with repo input
  ├── chat/[runId]/         # Chat interface
  └── globals.css           # Global styles

components/
  ├── chat/
  │   ├── user-message.tsx  # User message bubble
  │   ├── ai-message.tsx    # AI response bubble with markdown
  │   └── tool-card.tsx     # Tool call visualization
  └── ui/                   # shadcn/ui components
```

## Usage

1. Visit the landing page
2. Enter a GitHub repository URL or click one of the example repos
3. Ask questions about the repository's code, features, or architecture
4. Watch as the AI analyzes the codebase and provides insights

## Note

This is a demo application with mock data. In a production implementation, it would integrate with an actual AI service and GitHub API to provide real repository analysis.
