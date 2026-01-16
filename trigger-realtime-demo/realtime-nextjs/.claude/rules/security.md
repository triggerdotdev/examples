# Security

Auto-read before deploy or when touching auth/payments.

## Supabase

### RLS Required
Every table needs Row Level Security:
```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users see own data" ON my_table
  FOR SELECT USING (auth.uid() = user_id);
```

### Use getUser(), Not getSession()
```ts
// ❌ Can be spoofed
const { data: { session } } = await supabase.auth.getSession()

// ✅ Verified with Supabase Auth server
const { data: { user } } = await supabase.auth.getUser()
```

### Server-Side Auth
Always verify auth on server, never trust client claims.

## Environment Variables

### Never Expose
```
SUPABASE_SERVICE_ROLE_KEY  // Server only
STRIPE_SECRET_KEY          // Server only  
ANTHROPIC_API_KEY          // Server only
```

### Safe for Client
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

## Stripe

### Verify Webhooks
```ts
const sig = request.headers.get('stripe-signature')
const event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
```

### Check Ownership
Before any action on a subscription/customer, verify it belongs to the authenticated user.

## Input Validation

- Validate all user input server-side
- Use Zod schemas for type-safe validation
- Never trust client-side validation alone

## Checklist Before Deploy

- [ ] RLS enabled on all tables
- [ ] Policies tested (try accessing as wrong user)
- [ ] No secrets in NEXT_PUBLIC_ variables
- [ ] getUser() not getSession()
- [ ] Stripe webhooks verify signature
- [ ] All forms validate server-side
