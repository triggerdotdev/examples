# OpenAI Agent SDK guardrails examples with Trigger.dev

This project demonstrates how to implement different types of guardrails using the [OpenAI Agent SDK](https://openai.github.io/openai-agents-python/) with [Trigger.dev](https://trigger.dev) for execution.

https://github.com/user-attachments/assets/9b1e55c7-467d-4aca-8b4a-a018014c0827

It serves as both:

- **A practical guide** for integrating the OpenAI Agent SDK with Trigger.dev for production AI workflows
- **Educational examples** of implementing three different types of guardrails for AI safety and control

## What are Guardrails?

Guardrails are safety mechanisms that run alongside AI agents to:

- Validate input before processing
- Check output before returning responses
- Monitor streaming content in real-time
- Prevent unwanted or harmful behavior

## Examples Included

This project includes three different guardrail implementations:

### 1. Input Guardrails ([input-guardrails.py](./src/python/input-guardrails.py))

**Purpose**: Validates user input before the agent processes it.

**Example**: A math tutor agent that only responds to mathematics-related questions. If you ask about anything else (like "What's the weather?"), the guardrail triggers and returns a refusal message.

**How it works**:

- Uses an agent-based guardrail to check if input is math-related
- Throws `InputGuardrailTripwireTriggered` exception when non-math topics are detected
- Returns a polite refusal instead of processing the request

### 2. Output Guardrails ([output-guardrails.py](./src/python/output-guardrails.py))

**Purpose**: Validates the agent's response before returning it to the user.

**Example**: Ensures that a "Math Assistant" actually provides mathematical content in its responses. If the response doesn't contain sufficient math content, the guardrail triggers.

**How it works**:

- Agent generates a response first
- Guardrail agent evaluates if the response contains actual mathematical content
- Throws `OutputGuardrailTripwireTriggered` if response lacks math content
- Can either retry or return an error message

### 3. Streaming Guardrails ([streaming-guardrails.py](./src/python/streaming-guardrails.py))

**Purpose**: Monitors content as it streams in real-time, allowing early termination.

**Example**: Checks if streaming responses use language too complex for a 10-year-old. If complex terms are detected while streaming, it immediately stops generation.

**How it works**:

- Streams response text to stdout in real-time
- Runs guardrail checks every N characters (configurable interval)
- Immediately stops streaming if guardrail triggers
- Provides detailed metrics about where/when the guardrail activated

## Getting Started

1. Clone the repo and run `npm install` to install the dependencies
2. Create a virtual environment `python -m venv venv`
3. Activate the virtual environment:
   - On Mac/Linux: `source venv/bin/activate`
   - On Windows: `venv\Scripts\activate`
4. Install the Python dependencies `pip install -r requirements.txt`
5. Copy the project ref from your [Trigger.dev dashboard](https://cloud.trigger.dev) and add it to the `trigger.config.ts` file
6. Run the Trigger.dev [CLI dev command](https://trigger.dev/docs/cli-dev-commands#cli-dev-command)
7. Test the guardrail tasks in the dashboard
8. Deploy the tasks to production using the Trigger.dev [CLI deploy command](https://trigger.dev/docs/cli-deploy-commands#cli-deploy-command)

## Relevant Code

- **Trigger Tasks**:

  - [inputGuardrails.ts](./src/trigger/inputGuardrails.ts) - Passes user prompts to Python script and handles InputGuardrailTripwireTriggered exceptions
  - [outputGuardrails.ts](./src/trigger/outputGuardrails.ts) - Runs agent generation and catches OutputGuardrailTripwireTriggered exceptions with detailed error info
  - [streamingGuardrails.ts](./src/trigger/streamingGuardrails.ts) - Executes streaming Python script and parses JSON output containing guardrail metrics

- **Python Implementations**:

  - [input-guardrails.py](./src/python/input-guardrails.py) - Agent with @input_guardrail decorator that throws exceptions before main agent runs
  - [output-guardrails.py](./src/python/output-guardrails.py) - Agent with @output_guardrail decorator that validates generated responses using a separate guardrail agent
  - [streaming-guardrails.py](./src/python/streaming-guardrails.py) - Processes ResponseTextDeltaEvent streams with async guardrail checks at configurable intervals

- **Configuration**: [trigger.config.ts](./trigger.config.ts) - Uses the Trigger.dev Python extension

### Learn more

- [OpenAI Agent SDK documentation](https://openai.github.io/openai-agents-python/)
- [OpenAI Agent SDK guardrails](https://openai.github.io/openai-agents-python/guardrails/)
- [Trigger.dev documentation](https://trigger.dev/docs)
- [Trigger.dev Python extension](https://trigger.dev/docs/config/extensions/pythonExtension#python)
