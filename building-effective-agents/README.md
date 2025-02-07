## Building Effective Agents with Trigger.dev

This Node.js project shows 5 different patterns for building effective agents with Trigger.dev.

- Prompt chaining
- Routing
- Parallelization
- Orchestrator-workers
- Evaluator-optimizer

All of these examples focus on performing specific tasks, rather than do-it-all agents.

## About the project

- This is a basic Node.js project, so doesn't include any UI.
- Each of the different AI agent patterns is implemented as a [Trigger.dev](https://cloud.trigger.dev) task.
- The [AI SDK](https://sdk.vercel.ai/docs/introduction) is used to work with OpenAI models.

## AI agent patterns in this project

### Prompt chaining

![prompt-chaining](https://github.com/user-attachments/assets/498e8482-5cbb-4f60-a03f-5728c38a9cc3)

Breaking down a task into a series of steps, guided through a pre-determined sequence.

#### Prompt chaining task

1. Generate marketing copy on a subject you provide. (LLM call 1)
2. Check the word count fits a target range. (Gate)
3. Take the output and translate it into a target language. (LLM call 2)

View the Trigger.dev prompt chaining task code: [src/trigger/trigger/translate-copy.ts](./src/trigger/trigger/translate-copy.ts).

### Routing

![routing](https://github.com/user-attachments/assets/6d94c5b8-b9ae-4b56-ad64-007ff7ea30a0)


You can think of routing as an AI traffic controller. Instead of forcing one LLM to handle everything, you first figure out what type of task you're dealing with, then send it to the right specialist.

#### Routing task

1. User asks a question.
2. Determine if the question is simple or complex.
3. Use the appropriate model to answer the question.
4. Return the answer, model used, and reasoning.

View the Trigger.dev routing task code: [src/trigger/trigger/routing-questions.ts](./src/trigger/trigger/routing-questions.ts).

### Parallelization

![parallelization](https://github.com/user-attachments/assets/d4c51caa-ebfe-4893-85b0-10825649681d)

Sometimes you need to do multiple things at once – that's where parallelization comes in. Rather than working through tasks one by one, you split them up and run them simultaneously. This is where batch.triggerByTaskAndWait shines, allowing you to execute multiple tasks in parallel and efficiently coordinate their responses.

#### Parallelization task

This example responds to customer questions by simultaneously generating a response and checking for inappropriate content.

3 tasks handle this:

1. The first generates a response to the user's question.
2. The second task checks for innapropriate content.
3. The third, main task coordinates the responses by using batch.`triggerByTaskAndWait` to run the two tasks in parallel. If the content is inappropriate, this task returns a message saying it can't process the request, otherwise it returns the generated response.

View the Trigger.dev parallelization task code: [src/trigger/trigger/parallel-llm-calls.ts](./src/trigger/trigger/parallel-llm-calls.ts).

### Orchestrator-workers

![orchestrator-workers](https://github.com/user-attachments/assets/46ef2a06-fb8e-4843-a95a-7f251cc9fd20)

This pattern is like having a project manager (the orchestrator) who breaks down a big job into smaller tasks and assigns them to specialists (the workers). The orchestrator keeps track of everything and puts all the pieces back together at the end. Using batch.triggerByTaskAndWait, it efficiently coordinates multiple tasks while maintaining clear control over the entire workflow.

#### Orchestrator-workers task

1. Extracts distinct factual claims from a news article.
2. Verifies each claim by considering recent news sources and official statements.
3. Analyzes the historical context of each claim in the context of past announcements and technological feasibility.
4. Returns the claims, verifications, and historical analyses.

View the Trigger.dev orchestrator-workers task code: [src/trigger/trigger/orchestrator-workers.ts](./src/trigger/trigger/orchestrator-workers.ts).

### Evaluator-optimizer

![evaluator-optimizer](https://github.com/user-attachments/assets/ddddd1ff-1aef-4e4f-901b-47c69f992826)

Here's where you add quality control to your AI system. The evaluator checks the output, and if it's not quite right, the optimizer suggests improvements. Think of it as having a friendly editor who reviews your work and helps make it better.

#### Evaluator-optimizer task

1. Generates a translation of the text.
2. Evaluates the translation.
3. If the translation is good, returns the final result.
4. If the translation is not good, recursively calls the task with the translation and feedback.

View the Trigger.dev evaluator-optimizer task code: [src/trigger/trigger/evaluator-optimizer.ts](./src/trigger/trigger/evaluator-optimizer.ts).

## Blog post

Read the blog post: [Building Effective Agents with Trigger.dev](https://trigger.dev/blog/ai-agents-with-trigger).

## Learn more about Trigger.dev

To learn more about Trigger.dev, take a look at the following resources:

- [Trigger.dev Documentation](https://trigger.dev/docs) - learn about Trigger.dev and its features.
- [Batch Trigger docs](https://trigger.dev/docs/triggering) - learn about the Batch Trigger feature of Trigger.dev.
- [Realtime docs](https://trigger.dev/docs/realtime) - learn about the Realtime feature of Trigger.dev.
- [React hooks](https://trigger.dev/docs/frontend/react-hooks) - learn about the React hooks provided by Trigger.dev.
