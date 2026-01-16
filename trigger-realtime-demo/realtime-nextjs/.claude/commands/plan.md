# /plan — Start or Extend a Project

## Usage

**Quick start:**
```
/plan "build a company enrichment tool"
```

**Existing project or no description:**
```
/plan
```

When run without a description, first check if there's actual application code (see "Determine if Project is New or Existing" below). Don't treat starter kit files as "existing project".

---

## Entry Point

When user runs `/plan`, ask:

```
Two options:

1. **Quick start** — Describe in a sentence, I'll ask a few questions
2. **Rich context** — Paste your planning notes, I'll digest into clean SPEC.md

Which approach? (or just paste your notes)
```

If user pastes text (planning notes, conversation excerpts, requirements), treat as rich context.

---

## Quick Start Flow

### Step 1: Ask Architecture Questions

Ask these questions ONE AT A TIME. Wait for answer before next question. Give specific options where relevant.

1. **What are we building?** (one sentence)

2. **Who's the user?** (persona — be specific)

3. **What's the core flow?** (user does X → system does Y → user sees Z)

4. **Auth?**
   - No auth needed
   - Magic link (email only, no password)
   - Email + password
   - OAuth (which providers: Google, GitHub, etc?)
   - Anonymous → upgrade to account later

5. **What data do we store?** (list the main tables/entities and key fields)

6. **Background jobs?**
   - No
   - Yes → What triggers them? (user action, webhook, schedule?)
   - Yes → What do they do? (AI processing, email, sync, etc?)
   - Yes → Need realtime progress updates to frontend?

7. **External APIs?**
   - Stripe → Checkout only? Subscriptions? Usage-based?
   - AI → Claude? OpenAI? What model? Streaming?
   - Email → Transactional only? Marketing?
   - Other → Which ones? What endpoints?

8. **What's the ONE thing it must do in 7 days?** (ruthlessly specific)

### Step 2: Generate Specific Stories

Stories must include implementation details, not just outcomes:

```json
// ❌ Too vague
{"title": "User can sign up"}

// ✅ Specific
{"title": "User can sign up with magic link", "acceptance": [
  "Email input with validation",
  "Calls Supabase signInWithOtp",
  "Shows 'check your email' message",
  "Magic link redirects to /dashboard"
]}
```

```json
// ❌ Too vague
{"title": "Process company data"}

// ✅ Specific  
{"title": "Trigger task enriches company with Exa API", "acceptance": [
  "Task receives company URL",
  "Calls Exa search endpoint with URL",
  "Extracts: name, description, employee count, funding",
  "Saves to companies table",
  "Streams progress via Realtime"
]}
```

### Step 3: Challenge Scope

If it sounds too big for 7 days, push back:
```
That's ambitious for 7 days. Let's cut to MVP:
- Keep: [core feature]
- Cut: [nice-to-haves]
- Later: [v2 features]

Does this work?
```

---

## Rich Context Flow

### Step 1: Digest the Input

Read everything the user pasted. Extract:
- Core idea and value prop
- Target user
- Key features discussed
- Technical decisions made
- Scope boundaries mentioned

### Step 2: Confirm Understanding

```
Here's what I extracted:

**Core idea:** [one sentence]
**User:** [who]
**Key features:** [list]
**Tech decisions:** [if any]

Anything wrong or missing before I generate the plan?
```

### Step 3: Generate Clean Files

Don't dump the conversation into SPEC.md. Synthesize into clean, focused docs.

### Step 3: Generate SPEC.md

```markdown
# [Project Name]

> One sentence: what, who, why.

## Deadline

**Ship date:** YYYY-MM-DD (7 days from today)
**Scope rule:** If it won't ship by this date, cut features.

## User

**Who:** [persona]
**Problem:** [pain point]  
**Outcome:** [what they get]

## Core Flow

1. User does X
2. System does Y
3. User sees Z

## Architecture

[Simple diagram or description]

## Data Model

### [table_name]
| Column | Type | Description |
|--------|------|-------------|

## Routes

| Route | Purpose | Auth |
|-------|---------|------|

## Tech Decisions

| Decision | Choice | Why |
|----------|--------|-----|
```

### Step 4: Generate prd.json

```json
{
  "name": "project-name",
  "description": "One sentence",
  "deadline": "YYYY-MM-DD",
  "created": "YYYY-MM-DD",
  "stories": [
    {
      "id": "US-001",
      "title": "User can sign up",
      "priority": 1,
      "dependencies": [],
      "passes": false,
      "acceptance": [
        "Email/password form renders",
        "Validation shows errors",
        "Successful signup redirects to dashboard"
      ]
    }
  ]
}
```

**Story Rules:**
- Small enough for one session
- Clear acceptance criteria (manually verifiable)
- Dependencies explicit
- Second-to-last story is always "Write README"
- Final story is always "Security review"

### Step 5: Show Summary

```
## Plan Created

Deadline: YYYY-MM-DD (7 days)
Stories: X total

First story: US-001 [title]

Run /setup to install dependencies, then "next story" to begin.
```

---

## Existing Project Flow

### Step 0: Determine if Project is New or Existing

**Ignore these when checking** (they're part of the starter kit):
- `.claude/`
- `CLAUDE.md`
- `README.md` (if it's the starter kit readme)
- `.gitignore`
- `progress.txt`
- `SPEC.md`
- `prd.json`

**Project is "existing" if it has:**
- `package.json` with dependencies beyond create-next-app defaults
- `app/` or `src/` with actual routes/components
- `supabase/` or database files
- `trigger/` with tasks
- Any substantial application code

**Project is "new" if:**
- Fresh `create-next-app` output only
- Just the starter kit files
- No application code yet

If new → use Quick Start or Rich Context flow.
If existing → scan and ask what to add.

### Step 1: Scan Codebase

Check:
- `package.json` — installed packages
- `app/` or `pages/` — routes
- `supabase/` or schema files — tables
- `trigger/` — existing tasks
- Existing patterns/conventions

### Step 2: Document What Exists

Add to SPEC.md:
```markdown
## Existing Architecture

**Routes:** /, /dashboard, /settings
**Tables:** users, profiles, companies
**Auth:** Supabase (configured)
**Packages:** Next.js 14, Supabase, Trigger.dev v4
```

### Step 3: Ask What to Add

```
I've scanned the project. You have:
- Auth: ✓ working
- Database: users, profiles tables
- Routes: /, /dashboard

What do you want to add?
```

### Step 4: Generate prd.json

Only new work. Don't rebuild what exists.

### Step 5: Show Summary

Same as new project.

---

## Story Templates

### Auth (if needed)
```json
{"id": "US-001", "title": "User can sign up", "dependencies": []},
{"id": "US-002", "title": "User can log in", "dependencies": ["US-001"]},
{"id": "US-003", "title": "User can log out", "dependencies": ["US-002"]}
```

### Core Feature
```json
{"id": "US-004", "title": "User sees dashboard", "dependencies": ["US-002"]},
{"id": "US-005", "title": "User can [CORE ACTION]", "dependencies": ["US-004"]}
```

### AI/Agent Feature
```json
{"id": "US-006", "title": "User submits [input]", "dependencies": ["US-004"]},
{"id": "US-007", "title": "Agent processes [input]", "dependencies": ["US-006"]},
{"id": "US-008", "title": "User sees real-time progress", "dependencies": ["US-007"]}
```

### Always Last (in this order)
```json
{"id": "US-XXX", "title": "Write README", "dependencies": ["all feature stories"], "acceptance": ["All 7 sections present", "Setup runnable end-to-end", "Sentence case throughout"]},
{"id": "US-XXX", "title": "Security review", "dependencies": ["US-XXX (README)"], "acceptance": ["RLS enabled", "No exposed secrets", "Auth verified server-side"]}
```
