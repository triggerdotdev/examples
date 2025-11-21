## Using Claude Agent SDK with Trigger.dev

This is a secure example of how to use the [Claude Agent SDK](https://docs.claude.com/en/docs/agent-sdk/overview) with [Trigger.dev](https://trigger.dev).

**Two example implementations:**

- `code.ts` - Basic safe code generation (recommended starting point)
- `code-advanced.ts` - Advanced with bash execution and approval system

### Setup

Create a new project in Trigger.dev and copy the project ref.

```bash
npm install
```

Copy the `.env.example` file to `.env` and fill in the values:

```bash
cp .env.example .env
```

```bash
TRIGGER_PROJECT_REF="<your trigger.dev project ref here, starts with proj_>"
ANTHROPIC_API_KEY="sk-ant-api03-1234"
```

The Claude Agent SDK will automatically use the `ANTHROPIC_API_KEY` environment variable for authentication. Model configuration and other settings are configured directly in the task code at `src/trigger/code.ts`.

Authenticate the `trigger.dev` CLI with your Trigger.dev account:

```bash
npm run trigger:login
```

### Run

Run the dev command to register your tasks and test/run them locally.

```bash
npm run dev
```

### View code

**Basic example** (`src/trigger/code.ts`):

- Safe code generation without bash execution
- Isolated workspace with automatic cleanup
- Permission mode: `acceptEdits` (auto-approves file operations)
- Good for: generating code, analyzing files, data transformation

**Advanced example** (`src/trigger/code-advanced.ts`):

- Full development workflow with bash execution capability
- Isolated workspace with automatic cleanup
- Permission mode: `acceptEdits` (auto-approves file edits)
- Bash tool enabled in allowedTools list
- Good for: npm install, running tests, build commands
- **Warning:** Only use with trusted users - enables command execution

### Test

You can trigger the `claude-code` task by sending a POST request:

```bash
curl -X POST "https://api.trigger.dev/api/v1/tasks/claude-code/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your trigger.dev DEVELOPMENT API key here, starts with tr_dev_>" \
  -d '{
        "payload": {
          "prompt": "Write a simple hello world program in JavaScript.",
          "maxTurns": 3,
          "maxIterations": 10
        },
      }'
```

Or you could visit the Trigger.dev Dashboard and use the "Test" page to trigger the task

<img width="3680" height="2382" alt="CleanShot 2025-07-15 at 22 16 19@2x" src="https://github.com/user-attachments/assets/fe06c1dc-c49c-4cfb-89f7-bd8f69a77e90" />
