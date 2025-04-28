# Convert documents to markdown using MarkItDown and Trigger.dev

This demo showcases how to use [Trigger.dev](https://trigger.dev) with [Python](https://www.python.org/) to convert documents to markdown using Microsoft's [MarkItDown](https://github.com/microsoft/markitdown) library. This can be especially useful when converting documents to markdown for use in AI applications.

## Prerequisites

- A [Trigger.dev](https://trigger.dev) account and project set up
- [Python](https://www.python.org/) installed on your machine. _This example requires Python 3.10 or higher._

## Features

- A [Trigger.dev](https://trigger.dev) task which downloads a document from a URL and runs the Python script to convert it to Markdown
- A Python script to convert documents to Markdown using Microsoft's [MarkItDown](https://github.com/microsoft/markitdown) library
- Uses the [Trigger.dev Python build extension](https://trigger.dev/docs/config/extensions/pythonExtension) to install dependencies and run Python scripts

## Getting Started

| This demo is using Trigger.dev v4 which is currently in beta (as of 28/04/2025), you will need to install the v4 CLI to run this project. [Upgrade v4 docs here](https://trigger.dev/docs/upgrade-to-v4#installation)

1. After cloning the repo, run `npm install` to install the dependencies.
2. Run the Trigger.dev [CLI init command](https://trigger.dev/docs/cli-init-commands#cli-init-command) to initialize the project.
3. Create a virtual environment `python -m venv venv`
4. Activate the virtual environment, depending on your OS: On Mac/Linux: `source venv/bin/activate`, on Windows: `venv\Scripts\activate`
5. Install the Python dependencies `pip install -r requirements.txt`. _Make sure you have Python 3.10 or higher installed._
6. Copy the project ref from your [Trigger.dev dashboard](https://cloud.trigger.dev) and add it to the `trigger.config.ts` file.
7. In a new terminal, run the Trigger.dev [CLI dev command](https://trigger.dev/docs/cli-dev-commands#cli-dev-command) (it may ask you to authorize the CLI if you haven't already).
8. Test the task in the dashboard by providing valid payloads.
9. Deploy the task to production using the Trigger.dev [CLI deploy command](https://trigger.dev/docs/cli-deploy-commands#cli-deploy-command).

## Relevant Code

- [convertToMarkdown.ts](./src/trigger/convertToMarkdown.ts) defines the Trigger.dev task which orchestrates the document conversion
- [markdown-converter.py](./src/python/markdown-converter.py) contains the Python code for converting documents to Markdown
- [trigger.config.ts](./trigger.config.ts) uses the Trigger.dev Python extension to install the dependencies and run the script

## Learn more

- Learn more about the [Trigger.dev Python extension](https://trigger.dev/docs/config/extensions/pythonExtension)
- Learn more about [MarkItDown](https://github.com/microsoft/markitdown)

### MarkItDown Conversion Capabilities

- Convert various file formats to Markdown:
  - Office formats (Word, PowerPoint, Excel)
  - PDFs
  - Images (with optional LLM-generated descriptions)
  - HTML, CSV, JSON, XML
  - Audio files (with optional transcription)
  - ZIP archives
  - And more
- Preserve document structure (headings, lists, tables, etc.)
- Handle multiple input methods (file paths, URLs, base64 data)
- Optional Azure Document Intelligence integration for better PDF and image conversion
