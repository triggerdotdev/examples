# Trigger.dev + Python headless web crawler example

This demo showcases how to use Trigger.dev with Python to build a web crawler that uses a headless browser to navigate websites and extract content.

## Features

- [Trigger.dev](https://trigger.dev) for background task orchestration
- [Trigger.dev Python build extension](https://trigger.dev/docs/config/extensions/pythonExtension) to install the dependencies and run the Python script
- [Crawl4AI](https://github.com/unclecode/crawl4ai), an open source LLM friendly web crawler
- [Playwright](https://playwright.dev/) to create a headless chromium browser
- Proxy support

## Using Proxies

_When web scraping, you MUST use a proxy to comply with the Trigger.dev terms of service. Direct scraping of third-party websites without the site owner’s permission using Trigger.dev Cloud is prohibited and will result in account suspension._

Some popular proxy services are:

- [Smartproxy](https://smartproxy.com/)
- [Bright Data](https://brightdata.com/)
- [Browserbase](https://browserbase.com/)
- [Oxylabs](https://oxylabs.io/)
- [ScrapingBee](https://scrapingbee.com/)

Once you have a proxy service, set the following environment variables in your Trigger.dev .env file, and add them to the Trigger.dev dashboard:

- `PROXY_URL`: The URL of your proxy server (e.g., `http://proxy.example.com:8080`)
- `PROXY_USERNAME`: Username for authenticated proxies (optional)
- `PROXY_PASSWORD`: Password for authenticated proxies (optional)

## Getting Started

1. After cloning the repo, run `npm install` to install the dependencies.
2. Create a virtual environment `python -m venv venv`
3. Activate the virtual environment, depending on your OS: On Mac/Linux: `source venv/bin/activate`, on Windows: `venv\Scripts\activate`
4. Install the Python dependencies `pip install -r requirements.txt`
5. Copy the project ref from your [Trigger.dev dashboard](https://cloud.trigger.dev) and and add it to the `trigger.config.ts` file.
6. Run the Trigger.dev [CLI dev command](https://trigger.dev/docs/cli-dev-commands#cli-dev-command) (it may ask you to authorize the CLI if you haven't already).
7. Test the task in the dashboard
8. Deploy the task to production using the Trigger.dev [CLI deploy command](https://trigger.dev/docs/cli-deploy-commands#cli-deploy-command).

## Relevant code

- [pythonTasks.ts](./src/trigger/pythonTasks.ts) triggers the Python script and returns the result
- [trigger.config.ts](./trigger.config.ts) uses the Trigger.dev Python extension to install the dependencies and run the script, as well as `installPlaywrightChromium()` to create a headless chromium browser
- [crawl-url.py](./src/python/crawl-url.py) is the main Python script that takes a URL and returns the markdown content of the page
