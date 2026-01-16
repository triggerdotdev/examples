# Debugging

Auto-read when fixing bugs. Be methodical, not guessing.

## Process

1. **Understand** — What's expected? What happened? Exact error?
2. **Check obvious** — Server running? TS errors? Console? Network tab?
3. **Trace flow** — Where does it start? What calls what? Where does it fail?
4. **Add logs** — `console.log('[DEBUG] step:', value)`
5. **Find root cause** — Our code? Library? Data? Environment?
6. **Smallest fix** — Fix it, verify, remove debug logs

## Common Issues

### Supabase
| Symptom | Likely Cause |
|---------|--------------|
| Data is null | RLS blocking (not empty table) |
| Auth not working | Wrong client (browser vs server) |
| "Not authorized" | Check RLS policies, check user ID |

### Next.js
| Symptom | Likely Cause |
|---------|--------------|
| Hooks error | Need "use client" directive |
| Stale data | revalidatePath not called |
| Hydration mismatch | Server/client rendering different content |

### Trigger.dev
| Symptom | Likely Cause |
|---------|--------------|
| Task not running | Check dashboard, check environment |
| Streams not working | SDK < 4.1.0, or using old API |
| Wrong data | Dev vs prod environment mismatch |

### Stripe
| Symptom | Likely Cause |
|---------|--------------|
| Webhook 400 | Signature verification failed |
| "No such product" | Test vs prod key mismatch |

## When Stuck in a Loop

If you and Claude keep making mistakes:
1. Stop
2. Run `/clear`
3. Describe the problem fresh in one sentence
4. Start debugging from scratch
