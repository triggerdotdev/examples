# Trigger.dev + Python Image Processing Example

This demo showcases how to use Trigger.dev with Python to process images from URLs and upload them to S3-compatible storage.

## Features

- A [Trigger.dev](https://trigger.dev) task to trigger the image processing Python script, and to then upload the processed image to S3-compatible storage
- The [Trigger.dev Python build extension](https://trigger.dev/docs/config/extensions/pythonExtension) to install dependencies and run Python scripts
- [Pillow (PIL)](https://pillow.readthedocs.io/) for powerful image processing capabilities
- [AWS SDK v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/) for S3 uploads
- S3-compatible storage support (AWS S3, Cloudflare R2, etc.)

## Image Processing Capabilities

- Resize images with customizable dimensions
- Maintain aspect ratio
- Convert between formats (JPEG, PNG, WebP, GIF, AVIF)
- Adjust quality for optimized file sizes
- Apply filters (brightness, contrast, sharpness)
- Convert to grayscale
- Detailed metadata about the processed image

## Getting Started

1. After cloning the repo, run `npm install` to install the dependencies.
2. Create a virtual environment `python -m venv venv`
3. Activate the virtual environment, depending on your OS: On Mac/Linux: `source venv/bin/activate`, on Windows: `venv\Scripts\activate`
4. Install the Python dependencies `pip install -r requirements.txt`
5. Set up your S3-compatible storage credentials in your environment variables, in .env for local development, or in the Trigger.dev dashboard for production:
   ```
   S3_ENDPOINT=https://your-endpoint.com
   S3_ACCESS_KEY_ID=your-access-key
   S3_SECRET_ACCESS_KEY=your-secret-key
   S3_BUCKET=your-bucket-name
   S3_PUBLIC_URL=https://your-public-url.com
   ```
6. Copy the project ref from your [Trigger.dev dashboard](https://cloud.trigger.dev) and add it to the `trigger.config.ts` file.
7. Run the Trigger.dev dev CLI command with `npx trigger dev@latest dev` (it may ask you to authorize the CLI if you haven't already).
8. Test the task in the dashboard by providing a valid image URL and processing options.
9. Deploy the task to production using the CLI command `npx trigger.dev@latest deploy`

## Example Payload

These are all optional parameters that can be passed to the `image-processing.py` Python script from the `processImage.ts` task.

```json
{
  "imageUrl": "<your-image-url>",
  "height": 1200,
  "width": 900,
  "quality": 90,
  "maintainAspectRatio": true,
  "outputFormat": "webp",
  "brightness": 1.2,
  "contrast": 1.1,
  "sharpness": 1.3,
  "grayscale": false
}
```

## Relevant code

- [processImage.ts](./src/trigger/processImage.ts) orchestrates the image processing workflow, handles S3 uploads, and returns metadata
- [trigger.config.ts](./trigger.config.ts) uses the Trigger.dev Python extension to install the dependencies and run the script
- [image-processing.py](./src/python/image-processing.py) contains the Python image processing logic with a comprehensive ImageProcessor class
