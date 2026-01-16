# README

Auto-read when writing project README.

## Structure (All 7 Required)

### 1. Project title
- Repo name + short descriptor
- Example: `# deep research agent using trigger.dev and vercel's ai sdk`

### 2. Overview
- 1–3 sentences max
- What it does in plain English
- Embed demo gif/video if exists

### 3. Tech stack
- Bullet list, ordered: frontend → ai/ml → trigger.dev → external apis → storage → styling
- **Name is the link** to official docs
- Short descriptor after
```markdown
- [**next.js**](https://nextjs.org/) – frontend react framework
- [**trigger.dev**](https://trigger.dev/docs) – background task orchestration
```

### 4. Setup & running locally
Complete, self-contained guide:
1. Clone repo
2. Install deps
3. Copy `.env.example` → `.env`, list each var with:
   - Name
   - What it's for
   - Link to get it (official signup/docs)
4. Add trigger.dev project ref (show file path)
5. Start dev servers (frontend + trigger cli)

**Goal:** Runnable without leaving the README.

### 5. How it works
- How trigger.dev orchestrates the tasks
- Name each task + its role + link to source file
- Describe key parameters (depth, breadth, recursion)
- Text or diagram showing flow

### 6. Relevant code
Map capabilities to files:
```markdown
- **recursive research** – ai generates queries ([`src/trigger/deepResearch.ts`](src/trigger/deepResearch.ts))
- **realtime updates** – live frontend status ([`src/components/Agent.tsx`](src/components/Agent.tsx))
```

### 7. Learn more
Links to docs/guides:
```markdown
- [**trigger.dev realtime**](https://trigger.dev/docs/realtime) – live progress streaming
- [**trigger.dev react hooks**](https://trigger.dev/docs/frontend/react-hooks) – frontend patterns
```

## Style Rules

- **Sentence case always** — never title case
- Terse, no filler or marketing speak
- Prefer lists and code fences over paragraphs
- Relative paths for repo files
- Official docs for external links
- Name itself is the link, not "click here" or "docs"

## Checklist

- [ ] All 7 sections present
- [ ] Setup runnable end-to-end from README alone
- [ ] All file links are valid relative paths
- [ ] All external links on the name itself
- [ ] All headings in sentence case
