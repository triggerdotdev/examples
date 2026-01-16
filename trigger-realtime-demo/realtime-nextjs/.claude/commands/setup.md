# /setup — Install Dependencies

Run once per project after `/plan`.

## Process

### Step 1: Read SPEC.md to Know What's Needed

Check SPEC.md for:
- Does it need Supabase? (auth, database)
- Does it need Trigger.dev? (background jobs)
- Does it need Stripe? (payments)
- Does it need AI? (Claude API, Vercel AI SDK)
- What UI library? (shadcn already init?)

**Only install what the project actually needs.** Don't install everything.

### Step 2: Check package.json

Read `package.json` carefully:
- What's already installed?
- What version of Next.js?
- Is shadcn already initialized? (check for @radix-ui packages)

**List what's missing before installing anything:**

```
Based on SPEC.md, this project needs:
- Supabase (auth + database) — not installed
- Trigger.dev (background jobs) — not installed  
- shadcn/ui — not initialized

Already have:
- Next.js 14.2.0 ✓
- React 18 ✓
- Tailwind ✓

Install these missing packages? (y/n)
```

Wait for confirmation before running npm install.

### Step 3: Install Only What's Missing

```bash
# Only run the ones needed:
npm install @supabase/supabase-js @supabase/ssr
npm install @trigger.dev/sdk@latest @trigger.dev/react-hooks@latest
npx shadcn@latest init
```

### Step 4: Verify Versions

After install, check:
- `@trigger.dev/sdk` >= 4.1.0 (need Realtime Streams v2)
- `next` >= 14.0.0 (need App Router)
- `@supabase/ssr` present if using Supabase (not just supabase-js)

### Step 5: Summary

```
## Setup Complete

Installed: @supabase/ssr, @trigger.dev/sdk@4.1.0
Skipped (not needed): stripe, ai
Already had: next, react, tailwindcss

Ready for first story. Say "next story" to begin.
```

---

## Don't

- Don't install packages not mentioned in SPEC.md
- Don't reinstall what's already in package.json
- Don't auto-upgrade existing packages
- Don't run shadcn init if @radix-ui packages already exist
