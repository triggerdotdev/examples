# Product image generator using Trigger.dev and Replicate

AI-powered product image generator that transforms basic product photos into professional marketing shots using Replicate's image generation models and Trigger.dev for task orchestration.

## Tech stack

- [**Next.js**](https://nextjs.org/) – frontend React framework
- [**Replicate**](https://replicate.com/docs) – AI image generation
- [**Trigger.dev**](https://trigger.dev/docs) – background task orchestration
- [**UploadThing**](https://uploadthing.com/) – file upload handling
- [**Cloudflare R2**](https://developers.cloudflare.com/r2/) – image storage

## Video 

https://github.com/user-attachments/assets/53e0a8f4-98ee-4bf0-a5ac-f1ec0c5708e2

## Setup & Running locally

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd product-image-generator
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Copy environment variables and configure**

   ```bash
   cp env.example .env
   ```

   Fill in the required variables:

   - `TRIGGER_SECRET_KEY` – Get from [Trigger.dev dashboard](https://cloud.trigger.dev/)
   - `REPLICATE_API_TOKEN` – Get from [Replicate](https://replicate.com/account/api-tokens)
   - `UPLOADTHING_TOKEN` – Get from [UploadThing](https://uploadthing.com/)
   - `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL` – Configure Cloudflare R2 storage

4. **Add Trigger.dev project reference**

   Update `trigger.config.ts` with your project ref:

   ```typescript
   project: "your_project_ref_here";
   ```

5. **Start development servers**

   ```bash
   # Terminal 1: Start Next.js dev server
   pnpm dev

   # Terminal 2: Start Trigger.dev CLI
   npx trigger.dev@latest dev
   ```

## How it works

Trigger.dev orchestrates the image generation workflow through two main tasks:

1. **`generateImages`** – Batch coordinator that triggers multiple individual image generations ([`app/trigger/generate-images.ts`](app/trigger/generate-images.ts))
2. **`generateImage`** – Individual image processor that:
   - Enhances prompts with style-specific instructions
   - Calls Replicate's `google/nano-banana` model
   - Creates waitpoint tokens for async webhook handling
   - Waits for Replicate completion via webhook callbacks
   - Uploads generated images to Cloudflare R2
   - Returns public URLs for display

**Process flow:**

1. User selects and uploads product image to the website
2. Image is uploaded to UploadThing cloud storage
3. UploadThing's `onUploadComplete` callback triggers batch generation for 3 preset styles
4. Each style runs as separate Trigger.dev task with waitpoints for Replicate webhooks
5. Frontend receives real-time progress updates via Trigger.dev React hooks
6. Generated images are stored in Cloudflare R2 and displayed with download options

**Style presets:**

- **Clean Product Shot** – Professional white background with studio lighting
- **Lifestyle Scene** – Person holding product with natural lighting
- **Hero Shot** – Elegant hands presenting product with dramatic lighting

## Relevant code

- **Image generation tasks** – Batch processing with waitpoints for Replicate webhook callbacks ([`app/trigger/generate-images.ts`](app/trigger/generate-images.ts))
- **Upload handler** – UploadThing integration that triggers batch generation for 3 preset styles ([`app/api/uploadthing/core.ts`](app/api/uploadthing/core.ts))
- **Real-time progress UI** – Live task updates using Trigger.dev React hooks ([`app/components/GeneratedCard.tsx`](app/components/GeneratedCard.tsx))
- **Custom prompt interface** – User-defined style generation with custom prompts ([`app/components/CustomPromptCard.tsx`](app/components/CustomPromptCard.tsx))
- **Main app component** – Layout and state management with professional style presets ([`app/ProductImageGenerator.tsx`](app/ProductImageGenerator.tsx))
- **Trigger.dev configuration** – Project settings and task directories ([`trigger.config.ts`](trigger.config.ts))

## Learn more

- [**Trigger.dev waitpoints**](https://trigger.dev/docs/wait-for-token) – pause tasks for async webhook callbacks
- [**Trigger.dev React hooks**](https://trigger.dev/docs/realtime/react-hooks/overview) – real-time task updates and frontend integration
- [**Trigger.dev batch operations**](https://trigger.dev/docs//triggering#tasks-batchtrigger) – parallel task execution patterns
- [**Replicate API**](https://replicate.com/docs/get-started/nextjs) – AI model integration and webhook handling
- [**UploadThing**](https://docs.uploadthing.com/) – file upload handling and server callbacks
