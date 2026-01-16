# Realtime Streams v2 Interactive Examples

> Interactive split-screen code viewer showcasing Trigger.dev Realtime Streams v2 patterns for developers learning the SDK.

## Deadline

**Ship date:** 2026-01-23 (7 days from today)
**Scope rule:** If it won't ship by this date, cut features.

## User

**Who:** Developer evaluating or learning Trigger.dev
**Problem:** Hard to understand Realtime Streams patterns from docs alone
**Outcome:** See working examples with highlighted code that updates as they interact

## Core Flow

1. User visits homepage, sees list of example patterns
2. User clicks example (e.g., "Progress Tracking")
3. User sees split-screen: working demo (left) + annotated code (right)
4. User clicks "Start Task" button in demo
5. Code panel highlights the relevant lines (task trigger code)
6. Progress streams in, code panel switches to show streaming code
7. User hovers different UI elements → code highlights update

## Architecture

```
src/
├── app/
│   ├── page.tsx                    # Landing/example selector
│   └── examples/
│       └── progress-tracking/
│           ├── page.tsx            # Split viewer for this example
│           └── progress-demo.tsx   # Live demo component
├── components/
│   ├── split-viewer.tsx            # Main split-screen layout + context
│   ├── code-panel.tsx              # Tabs + Shiki highlighting
│   └── app-panel.tsx               # Card wrapper for demos
├── trigger/
│   ├── streams.ts                  # Stream definitions
│   └── tasks.ts                    # Example tasks
└── lib/
    ├── shiki.ts                    # Syntax highlighting setup
    └── code-mappings.ts            # UI element → code line mappings
```

## Data Model

No database needed. This is a demo/documentation site.

## Routes

| Route | Purpose | Auth |
|-------|---------|------|
| `/` | Example selector | None |
| `/examples/progress-tracking` | Progress streaming demo | None |
| `/examples/frontend-trigger` | Frontend trigger demo (stretch) | None |
| `/examples/ai-streaming` | AI streaming demo (stretch) | None |

## Tech Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Syntax highlighting | Shiki | Server-side, lightweight, beautiful themes |
| UI components | shadcn/ui | Consistent, customizable, follows design rules |
| Line highlighting | Custom CSS | Yellow background on active lines |
| Mobile | Desktop-only message | Split-screen doesn't work on mobile |
| Auth | None | Public demo site |

## Existing Architecture

**Routes:** `/`, `/examples/progress-tracking`
**Packages:** Next.js 16, Trigger.dev SDK 4.3, Shiki, shadcn/ui
**Components:** split-viewer, code-panel, app-panel, button, card, tabs
