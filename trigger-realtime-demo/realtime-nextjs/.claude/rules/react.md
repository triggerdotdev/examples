# React Patterns

Auto-read when writing React components.

## Core Rules

### Server Components Default
Only add `"use client"` when you need: event handlers, useState/useEffect/useRef, browser APIs.

### No useEffect for Data or Derived State
```tsx
// ❌ BAD
const [fullName, setFullName] = useState('')
useEffect(() => setFullName(`${first} ${last}`), [first, last])

// ✅ GOOD  
const fullName = `${first} ${last}`
```

### URL State for Shareable State
Search, filters, pagination, tabs — use nuqs:
```tsx
import { useQueryState } from 'nuqs'
const [search, setSearch] = useQueryState('q')
```

### Composition Over Props
```tsx
// ❌ Prop overload
<Card title="X" icon={<Y/>} actions={<Z/>} />

// ✅ Composition
<Card>
  <Card.Header><Icon /><Title /></Card.Header>
  <Card.Content>...</Card.Content>
</Card>
```

### Reset State with Key
```tsx
<ProfileForm key={userId} user={user} />
```

### Server Actions for Forms
```tsx
// app/actions.ts
'use server'
export async function createPost(formData: FormData) {
  await db.posts.create(...)
  revalidatePath('/posts')
}
```

## useEffect is Only For
- External system sync (DOM APIs, WebSockets)
- Subscriptions with cleanup
- Nothing else
