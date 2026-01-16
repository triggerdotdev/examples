# /sync — Reconcile After Time Away

Run when returning to a project or things have drifted.

## When to Use

- Coming back after days/weeks
- Built things that weren't in the plan
- prd.json statuses are wrong
- SPEC.md is outdated
- Context feels stale

## Process

### Step 1: Scan Reality

Check codebase for:
- Routes/pages that exist
- Database tables
- API endpoints
- Trigger.dev tasks
- Installed packages

### Step 2: Compare to Plan

```
## Drift Analysis

### Built but NOT in plan
| What | Location | Action |
|------|----------|--------|
| /settings page | app/settings/ | Add to SPEC.md |

### In plan but NOT built
| Story | Status says | Reality | Action |
|-------|-------------|---------|--------|
| US-005 | passes: false | Actually done | Mark true |

### prd.json wrong
| Story | Says | Reality | Fix |
|-------|------|---------|-----|
| US-003 | false | Working | Update to true |
```

### Step 3: Ask User

```
Found drift:
- 2 things built but not in plan
- 1 story marked incomplete but actually done
- SPEC.md missing /settings route

Options:
A) Update plan to match reality (drift was intentional)
B) I'll fix reality to match plan (drift was wrong)
C) Let's go through each one

Which approach?
```

### Step 4: Execute Fixes

Update prd.json:
- Fix `passes: true/false` to match reality
- Add stories for unplanned features (if keeping)

Update SPEC.md:
- Add new routes
- Update data model
- Document architectural changes

### Step 5: Summary

```
## Sync Complete

- Fixed: 3 story statuses
- Added to SPEC: /settings route
- prd.json: 8 stories, 5 passing

Next incomplete story: US-006 [title]

Say "next story" to continue, or /clear first if context feels stale.
```

---

## Fresh Start Option

If everything feels wrong:

```
This project has drifted significantly. Options:

1. **Sync** — I'll reconcile what's here with the plan
2. **Fresh plan** — Run /plan to re-scope from current state
3. **Start over** — Revert to last good commit, re-plan

What feels right?
```
