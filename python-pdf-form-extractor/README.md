# Trigger.dev + Python PDF Form Extractor Example

This demo showcases how to use Trigger.dev with Python to extract structured form data from a PDF file available at a URL.

## Features

- [Trigger.dev](https://trigger.dev) to orchestrate background tasks
- [Trigger.dev Python build extension](https://trigger.dev/docs/config/extensions/pythonExtension) to install the dependencies and run the Python script
- [PyMuPDF](https://pymupdf.readthedocs.io/en/latest/) to extract form data from PDF files
- [Requests](https://docs.python-requests.org/en/master/) to download PDF files from URLs

## Getting Started

1. After cloning the repo, run `npm install` to install the dependencies.
2. Create a virtual environment `python -m venv venv`
3. Activate the virtual environment, depending on your OS: On Mac/Linux: `source venv/bin/activate`, on Windows: `venv\Scripts\activate`
4. Install the Python dependencies `pip install -r requirements.txt`
5. Copy the project ref from your [Trigger.dev dashboard](https://cloud.trigger.dev) and add it to the `trigger.config.ts` file.
6. Run the Trigger.dev dev CLI command with `npx trigger dev@latest dev` (it may ask you to authorize the CLI if you haven't already).
7. Test the task in the dashboard by providing a valid PDF URL.
8. Deploy the task to production using the CLI command `npx trigger.dev@latest deploy`

## Relevant code

- [pythonPdfTask.ts](./src/trigger/pythonPdfTask.ts) triggers the Python script and returns the structured form data as JSON
- [trigger.config.ts](./trigger.config.ts) uses the Trigger.dev Python extension to install the dependencies and run the script
- [extract-pdf-form.py](./src/python/extract-pdf-form.py) is the main Python script that takes a URL and returns the form data from the PDF in JSON format
