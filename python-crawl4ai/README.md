# Trigger.dev + Python Web Crawler Example

This headless browser demo showcases how to use Trigger.dev with Python to build a web crawler.

## Features

- Trigger.dev for background task orchestration
- [Crawl4AI](https://github.com/unclecode/crawl4ai), an open source LLM friendly web crawler
- [Playwright](https://playwright.dev/) to create a headless chromium browser

## Getting Started

1. After cloning the repo, run `npm install` to install the dependencies.
2. Create a virtual environment`python -m venv venv`

3. Activate the virtual environment

**On Mac/Linux:**
`source venv/bin/activate`

**On Windows:**
`venv\Scripts\activate`

4. Install the dependencies `pip install -r requirements.txt`
5. Copy the project ref from your [Trigger.dev dashboard](https://cloud.trigger.dev) and and add it to the `trigger.config.ts` file.
6. Run the Trigger.dev dev CLI command with with `npm exec trigger dev` (it may ask you to authorize the CLI if you haven't already).
7. Test the task in the dashboard
8. Deploy the task to production using the CLI command `npx trigger.dev@latest deploy`

## Relevant code

- [pythonTasks.ts](./src/trigger/pythonTasks.ts) - Triggers the Python script and returns the result
- [trigger.config.ts](./src/trigger/trigger.config.ts) - Uses the Trigger.dev Python extension to install the dependencies and run the script, as well as Playwright to create a headless chromium browser
- [crawl-url.py](./src/python/crawl-url.py) - The main Python script that takes a URL and returns the markdown content of the page
