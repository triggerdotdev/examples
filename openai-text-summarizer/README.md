# Text Summarizer example Job

This folder contains an example Job using [Trigger.dev](https://trigger.dev), [OpenAI](https://openai.com) and [Slack](https://slack.com). You can use this Job as a starting point for creating your own Jobs.

The Job is located in `src/jobs/textSummarizer.ts`.

## **Step 1.** Create accounts for Trigger.dev and Open AI

Create accounts for [Trigger.dev](https://trigger.dev) and [OpenAI](https://openai.com) before moving to the next step. You'll also need a [Slack](https://slack.com) account.

## **Step 2.** Setup your Project

Create or select an Organization and Project on Trigger.dev. Then copy your API key from the "Environments & API Keys" page in your Project.

## **Step 3.** Create an `.env.local` file

```bash
cp .env.local.example .env.local
```

## **Step 4.** Fill in your environment variables

In the `.env.local` file you should enter all the required keys.

## **Step 5.** Get your Slack channel ID

Open up Slack in the browser (http://[yourteam].slack.com) and create a new channel or open up an existing one you want to use. The channel ID is displayed in the browser URL beginning with the letter 'C'.

Paste your channel ID in the textSummarizer.ts file on line 56.

## **Step 6.** Install the dependencies

```bash
npm install
```

## **Step 7.** Run the Next.js project

```bash
npm run dev
```

## **Step 8.** Run the CLI `dev` command

In a separate terminal window, leaving the site running. Run this command:

```bash
npx @trigger.dev/cli@latest dev
```

## **Step 9.** Trigger the Job

To trigger the "Text Summarizer" Job, open your Next.js project in the browser:

```bash
http://localhost:3000
```

You can paste any text into the text field on the page and click Summarize or use the Paul Graham essay link provided.

When you click the Summarize button, view the Job live in your Trigger.dev dashboard then head over to your Slack channel to view the result.
