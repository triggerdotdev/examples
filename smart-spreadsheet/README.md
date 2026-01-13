# Smart Spreadsheet

AI-powered company enrichment tool. Enter a company name or URL, get verified data with source links.

## Video 

https://github.com/user-attachments/assets/92668bd4-6cbc-4356-abd5-c45c52005778

## Features

- Enter company name or website URL
- AI enriches: website, description, industry, headcount, funding stage, last round
- Every data point includes source link
- Real-time streaming updates via Trigger.dev
- Google Sheets-like interface

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router)
- [Supabase](https://supabase.com) (PostgreSQL + Auth)
- [Trigger.dev v4](https://trigger.dev) (Background tasks + Realtime Streams)
- [Exa](https://exa.ai) (Web search API)
- [Claude](https://anthropic.com) (AI extraction via [Vercel AI SDK](https://sdk.vercel.ai))
- [Tailwind](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd smart-spreadsheet
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=

# Trigger.dev
TRIGGER_SECRET_KEY=
TRIGGER_PROJECT_REF=

# Exa
EXA_API_KEY=

# Anthropic
ANTHROPIC_API_KEY=
```

### 3. Supabase setup

1. Create a new Supabase project
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL Editor

> **Note:** The schema runs in dev mode (no auth) by default. For production, enable a Supabase auth provider and follow the RLS instructions in the schema file.

### 4. Trigger.dev setup

```bash
npx trigger.dev@latest init
npx trigger.dev@latest dev
```

## Run locally

```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: Trigger.dev
npx trigger.dev@latest dev
```

Open [http://localhost:3000](http://localhost:3000)

## How it works

1. User enters company name or URL
2. API triggers `enrich-company` task
3. Task runs 4 parallel subtasks:
   - `get-basic-info` - website, description
   - `get-industry` - industry classification
   - `get-employee-count` - headcount estimate
   - `get-funding-round` - stage + last round amount
4. Each subtask uses Exa search + Claude extraction
5. Results stream to UI via Trigger.dev Realtime
6. Data saved to Supabase with source URLs
