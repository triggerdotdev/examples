# Trigger.dev + Python Markdown Converter Example

This demo showcases how to use Trigger.dev with Python to convert various document types to Markdown using Microsoft's MarkItDown library.

## Prerequisites

- [Trigger.dev](https://trigger.dev) account
- [Python](https://www.python.org/) installed. This example requires Python 3.10 or higher.
- [Trigger.dev CLI](https://trigger.dev/docs/cli) installed

## Features

- A [Trigger.dev](https://trigger.dev) task to convert various document types to Markdown using Microsoft's [MarkItDown](https://github.com/microsoft/markitdown) library
- Support for multiple input types: file paths, URLs, and base64-encoded content
- Optional LLM enhancement for better image descriptions (using OpenAI)
- Comprehensive error handling and metadata extraction
- The [Trigger.dev Python build extension](https://trigger.dev/docs/config/extensions/pythonExtension) to install dependencies and run Python scripts
- Secure handling of API keys through environment variables

## Document-to-Markdown Conversion Capabilities

- Convert various file formats to Markdown:
  - Office formats (Word, PowerPoint, Excel)
  - PDFs
  - Images (with optional LLM-generated descriptions)
  - HTML, CSV, JSON, XML
  - Audio files (with optional transcription)
  - ZIP archives
  - And more!
- Preserve document structure (headings, lists, tables, etc.)
- Handle multiple input methods (file paths, URLs, base64 data)
- Optional Azure Document Intelligence integration for better PDF and image conversion

## Getting Started

1. After cloning the repo, run `npm install` to install the dependencies.
2. Create a virtual environment `python -m venv venv`
3. Activate the virtual environment, depending on your OS: On Mac/Linux: `source venv/bin/activate`, on Windows: `venv\Scripts\activate`
4. Install the Python dependencies `pip install -r requirements.txt`
5. Create a `.env` file based on `.env.example` and add your API keys:
   ```
   OPENAI_API_KEY=your-openai-api-key
   AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=your-azure-document-intelligence-endpoint
   ```
6. Copy the project ref from your [Trigger.dev dashboard](https://cloud.trigger.dev) and add it to the `trigger.config.ts` file.
7. Run the Trigger.dev [CLI dev command](https://trigger.dev/docs/cli-dev-commands#cli-dev-command) (it may ask you to authorize the CLI if you haven't already).
8. Test the task in the dashboard by providing valid payloads.
9. Deploy the task to production using the Trigger.dev [CLI deploy command](https://trigger.dev/docs/cli-deploy-commands#cli-deploy-command).

## Example Payloads

API keys and endpoints are handled securely through environment variables. The payloads only contain the necessary non-sensitive information:

### Convert a file from a local path:

```json
{
  "type": "file_path",
  "file_path": "/path/to/document.pdf",
  "use_llm": true,
  "llm_model": "gpt-4o"
}
```

### Convert a document from a URL:

```json
{
  "type": "url",
  "url": "https://example.com/document.docx",
  "use_llm": false
}
```

### Convert base64-encoded content:

```json
{
  "type": "base64",
  "base64_data": "JVBERi0xLjMKJcTl8uXrp...",
  "file_extension": "pdf",
  "use_llm": true
}
```

## Relevant Code

- [markdown-converter.py](./src/python/markdown-converter.py) contains the Python code for converting various documents to Markdown
- [convertToMarkdown.ts](./src/trigger/convertToMarkdown.ts) defines the Trigger.dev task for document conversion
- [trigger.config.ts](./trigger.config.ts) uses the Trigger.dev Python extension to install the dependencies and run the script

## Security

- API keys and endpoints are stored as environment variables and never included in the payloads
- Local development uses `.env` file which should never be committed to version control
- Production deployments use environment variables configured in the Trigger.dev dashboard
