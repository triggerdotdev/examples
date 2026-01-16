# /ship — Finalize and Promote

Run when all stories pass. Generates docs update and tweet thread.

## Prerequisites

- All prd.json stories have `passes: true`
- README.md is complete (should be second-to-last story)
- Security review passed (should be last story)

If not ready:
```
Not ready to ship:
- [ ] US-007: README (passes: false)
- [ ] US-008: Security review (passes: false)

Complete remaining stories first.
```

## Process

### Step 1: Verify Complete

Check prd.json — all stories must pass.

### Step 2: Generate Docs Update

Create `ship/docs-update.md`:

````markdown
# Docs update for [project-name]

## Files to create/update

### 1. Create `docs/guides/example-projects/[project-name].mdx`

```mdx
---
title: "[Project name]"
sidebarTitle: "[Short name for sidebar]"
description: "[One sentence describing what it does and the key tech used]"
---

## Overview

[1-2 sentences starting with "This demo shows how to build..."]

## Tech stack

- **[Name](link)** – [One line description of its role]
- **[Trigger.dev](https://trigger.dev/)** – workflow orchestration with real-time streaming, observability, and deployment

## Demo video

<video
  controls
  className="w-full aspect-video"
  src="[VIDEO_URL]"
></video>

## GitHub repo

<Card
  title="View the [project name] repo"
  icon="GitHub"
  href="https://github.com/triggerdotdev/examples/tree/main/[repo-name]"
>
  Click here to view the full code for this project in our examples repository on GitHub. You can
  fork it and use it as a starting point for your own project.
</Card>

## How it works

The [agent/task] workflow:

1. **[Action]** – [Brief explanation]
2. **[Action]** – [Brief explanation]
3. **[Action]** – [Brief explanation]

## Features

- **[Feature]** – [Description]
- **[Feature]** – [Description, link Trigger.dev features like [Realtime](/realtime/overview)]

## Relevant code

| File | Description |
| ---- | ----------- |
| [`trigger/task-name.ts`](https://github.com/triggerdotdev/examples/blob/main/[repo-name]/trigger/task-name.ts) | [What this file does] |
| [`app/api/route.ts`](https://github.com/triggerdotdev/examples/blob/main/[repo-name]/app/api/route.ts) | API endpoint that triggers the task |

## trigger.config.ts

[Brief intro if anything special to configure]

\`\`\`ts trigger.config.ts
[Paste ACTUAL trigger.config.ts from repo]
\`\`\`

<Note>
  Adding packages to `external` prevents them from being bundled. See the [build configuration
  docs](/config/config-file#external) for more details.
</Note>

## Learn more

- [**Trigger.dev Realtime**](/realtime/overview) – Stream task progress to your frontend
- [**Errors and retrying**](/errors-retrying) – Handle failures gracefully
```

### 2. Update `docs/docs.json`

Add to "Example projects" section (keep alphabetical):

```json
"guides/example-projects/[project-name]",
```

### 3. Update `docs/guides/introduction.mdx`

Add row to "Example projects" table:

```markdown
| [Project Name](/guides/example-projects/[project-name]) | Brief description | Framework | [View the repo](https://github.com/triggerdotdev/examples/tree/main/[repo-name]) |
```

### 4. Update `docs/guides/ai-agents/overview.mdx` (if AI-related)

Add Card to "Example projects using AI agents" section:

```mdx
<Card
  icon="icon-name"
  title="Project name"
  href="/guides/example-projects/[project-name]"
>
  Brief description of what it does.
</Card>
```

## Common Trigger.dev feature links

- Realtime: `[Realtime](/realtime/overview)`
- Waitpoints: `[waitpoints](/wait)`
- Scheduled tasks: `[Scheduled tasks](/tasks/scheduled)`
- Batch operations: `[Batch triggering](/triggering#batch-trigger)`
- Error handling: `[Errors and retrying](/errors-retrying)`
- Build config: `[build configuration docs](/config/config-file#external)`

## Checklist

- [ ] MDX file created
- [ ] docs.json updated
- [ ] introduction.mdx table updated
- [ ] ai-agents/overview.mdx updated (if AI project)
- [ ] All file links point to actual GitHub blob URLs
- [ ] trigger.config.ts copied exactly from repo
- [ ] Video URL added (if available)
````

### Step 3: Generate Tweet Thread

Create `ship/tweet-thread.md`:

```markdown
# Tweet thread for [project-name]

## Tweet 1 (Hook)
[What you built + why it's interesting — 280 chars max]

## Tweet 2 (Demo)
[Describe what the gif/video shows]
[ATTACH: screen recording of core flow]

## Tweet 3 (How it works)
[Key technical insight — what makes this possible]

## Tweet 4 (Trigger.dev angle)
[Specific feature that made this easy/possible]
[Link to relevant docs]

## Tweet 5 (CTA)
[Link to repo + invite to try/fork]

---

## Assets needed
- [ ] Screen recording of core flow (< 60 seconds)
- [ ] Screenshot of key UI
- [ ] Code snippet image (optional)
```

### Step 4: Summary

```
## Ready to ship

✓ All stories complete
✓ README done
✓ Security reviewed

Generated:
- ship/docs-update.md — PR this to trigger.dev docs
- ship/tweet-thread.md — Copy to Twitter, attach assets

Next steps:
1. Record demo video/gif
2. Submit docs PR
3. Post thread
4. Delete ship/ folder after publishing
```

## Output Files

| File | Purpose | After publishing |
|------|---------|------------------|
| `ship/docs-update.md` | Template for docs PR | Delete |
| `ship/tweet-thread.md` | Tweet copy + asset checklist | Delete |

These are temporary — delete the `ship/` folder after you've published.
