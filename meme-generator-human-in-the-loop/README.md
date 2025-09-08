# Meme generator with human-in-the-loop approval

> **ℹ️ Note:** This is a v4 project. If you are using v3 and want to upgrade, please refer to our [v4 upgrade guide](https://trigger.dev/docs/migrating-from-v3).

This example reference project demonstrates using a human-in-the-loop workflow to approve memes generated using OpenAI's DALL-E 3.

## Features

- A [Next.js](https://nextjs.org/) app, with an [endpoint](src/app/endpoints/[slug]/page.tsx) for approving the generated memes
- [Trigger.dev](https://trigger.dev) tasks to generate the images and orchestrate the waitpoint workflow
- [OpenAI DALL-E 3](https://platform.openai.com/docs/guides/images) for generating the images
- A [Slack app](https://api.slack.com/quickstart) for the human-in-the-loop step, with the approval buttons linked to the endpoint

![slack-meme-approval](https://github.com/user-attachments/assets/a953211a-d23a-44a0-a466-dde94be10d70)

## Getting started

1. After cloning the repo, run `npm install` to install the dependencies.
2. Copy the `.env.example` file to `.env` and fill in the required environment variables:
   - You'll need an OpenAI API key for DALL-E 3. Create a free account at [OpenAI](https://platform.openai.com/signup).
   - Sign up for a free Trigger.dev account [here](https://cloud.trigger.dev/login) and create a new project.
   - Create a Slack incoming webhook URL for notifications. You will need to create and install your own [Slack app](https://api.slack.com/quickstart) to a specific channel in your workspace. Make sure the app has the relevant permissions to send messages to the channel, the incoming webhook URL details can be found in the Slack app settings.
   - Set your app's public URL for approval callbacks.
3. Copy the project ref from the Trigger.dev dashboard and add it to the `trigger.config.ts` file.
4. Run the Next.js server with `npm run dev`.
5. In a separate terminal, run the Trigger.dev dev CLI command with `npx trigger@v4-beta dev` (it may ask you to authorize the CLI if you haven't already).
6. To test your workflow, go to the [Trigger.dev dashboard](https://cloud.trigger.dev/dashboard) test page and trigger the workflow.

Example payload:

```json
{
  "prompt": "A meme with a cat and a dog"
}
```

## Relevant code

- **Meme generator task**: View the Trigger.dev task code in the [src/trigger/memegenerator.ts](src/trigger/memegenerator.ts) file, which:

  - Generates two meme variants using DALL-E 3
  - Uses [batchTriggerAndWait](https://trigger.dev/docs/triggering#yourtask-batchtriggerandwait) to generate multiple meme variants simultaneously (this is because you can only generate 1 image at a time with DALL-E 3)
  - Creates a [waitpoint](https://trigger.dev/docs/upgrade-to-v4) token for human approval
  - Sends the generated images with approval buttons to Slack for review
  - Handles the approval workflow

- **Approval Endpoint**: The waitpoint approval handling is in [src/app/endpoints/[slug]/page.tsx](src/app/endpoints/[slug]/page.tsx), which processes:
  - User selections from Slack buttons
  - Waitpoint completion with the chosen meme variant
  - Success/failure feedback to the approver

## Learn More

To learn more about the technologies used in this project, check out the following resources:

- [Trigger.dev Documentation](https://trigger.dev/docs) - learn about Trigger.dev and its features
- [Trigger.dev wait tokens](https://trigger.dev/docs/upgrade-to-v4) - learn about using wait points in workflows
- [OpenAI DALL-E API](https://platform.openai.com/docs/guides/images) - learn about the DALL-E image generation API
- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks) - learn about integrating with Slack
