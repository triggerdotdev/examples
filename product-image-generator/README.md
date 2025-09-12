# AI Product Image Generator

Transform product photos into professional marketing materials using AI-powered image generation.

Upload a product image and automatically generate three marketing variations: isolated table shots, lifestyle scenes, and hero presentations. Built with Next.js, Trigger.dev, and OpenAI's DALL-E 3.
Upload a product image and automatically generate three marketing variations: isolated table shots, lifestyle scenes, and hero presentations. Built with Next.js, Trigger.dev, and the AI SDK (Replicate Flux for image generation, OpenAI for analysis).

## Features

- Real-time progress tracking with WebSocket subscriptions
- Product-focused AI prompts that maintain identical product appearance
- Responsive design with portrait-oriented image cards
- Automatic upload to Cloudflare R2 with public URLs
- Individual retry mechanisms for failed generations
- One-click download functionality
- Parallel processing for multiple image generations

## Architecture

### Task Structure

```
uploadImageToR2
├── Handles user image uploads to Cloudflare R2 storage
├── Analyzes the product with OpenAI (structured JSON)
├── 5-step progress tracking via metadata

generateAndUploadImage
├── Generates an image using Replicate Flux (img2img)
├── Uploads result to R2 storage
├── 4-step progress tracking via metadata
```

### Component Architecture

```
UploadCard (aspect-[3/4])
├── Drag & drop image upload
├── Progress tracking via run subscription
├── On completion, parent triggers 3 individual generations

GeneratedCard (aspect-[3/4])
├── Individual task progress tracking
├── Real-time image display via subscription
├── Download and retry functionality

CustomPromptCard (aspect-[3/4])
├── Lets user enter a freeform scene prompt
├── Triggers a single generation reusing the product analysis

Main Page
├── Grid layout: 1 upload + 3 generated cards (top) + 4 custom slots (bottom)
├── State for run IDs/access tokens for each card
├── Triggers generations and handles retries
```

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Trigger.dev account and project
- OpenAI API key (for product analysis)
- Replicate API token (for Flux image generation)
- Cloudflare R2 bucket for image storage

### Environment Variables

```env
# Trigger.dev
TRIGGER_SECRET_KEY=tr_dev_your_secret_key_here

# OpenAI
OPENAI_API_KEY=sk-your_openai_api_key_here

# Replicate
REPLICATE_API_TOKEN=your_replicate_api_token

# Cloudflare R2 Storage
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET=your-bucket-name
R2_PUBLIC_URL=https://your-public-domain.com
```

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Start Trigger.dev dev server (separate terminal)
pnpm dlx trigger.dev@latest dev
```

### Quickstart (happy path)

```bash
cp .env.example .env # if provided, otherwise create .env with the vars above
pnpm install
pnpm dev &
pnpm dlx trigger.dev@latest dev
```

## Usage

1. Upload a product image via drag & drop or file selection
2. The upload task runs with 5-step progress and returns a public URL + analysis
3. The page triggers three `generateAndUploadImage` tasks (table, lifestyle, hero)
4. Each `GeneratedCard` subscribes to its run and shows progress
5. When a run completes, the image auto-appears, with expand/download actions
6. You can retry any failed generation individually
7. After the top row completes, use custom cards to generate extra scenes

## Technical Implementation

### AI Prompt Engineering

Each generation builds an enhanced prompt from the structured product analysis. It enforces:

- Product consistency: EXACT same product as the reference (brand, model, colors, text)
- Preservation: shape/proportions/materials/logos must be unchanged
- Variation: only background, lighting, and camera angle may change

### Progress Tracking Implementation

- Upload Task: 5 steps (prepare → process → upload → analyze → complete)
- Generation Task: 4 steps (prepare → prompt → generate → upload/complete)
- Real-time updates via `useRealtimeRun()` or `runs.subscribeToRun()` using public access tokens

### Image Processing

- Size: Defaults to 1024x1024 (configurable)
- Display: `object-cover` in generated cards
- Storage: Cloudflare R2 with automatic public URL generation

## Project Structure

```
src/
├── trigger/
│   ├── image-upload.ts              # Upload to R2 + structured product analysis (OpenAI)
│   └── generate-image-and-upload.ts # Flux generation (Replicate) + R2 upload
├── app/
│   ├── actions.ts                   # Server actions: trigger tasks + public tokens
│   ├── components/
│   │   ├── UploadCard.tsx           # Upload with realtime progress
│   │   ├── GeneratedCard.tsx        # Generated image display + progress
│   │   └── CustomPromptCard.tsx     # Freeform prompt generation (post-upload)
│   └── page.tsx                     # Main application interface
└── trigger.config.ts                # Trigger.dev configuration
```

## Task Flow Details

### Upload Flow

1. `UploadCard` calls `uploadImageToR2Action` (server action)
2. Server action triggers `uploadImageToR2` task and creates a public token
3. Client subscribes to the run using the token; task uploads to R2
4. Task performs structured product analysis (OpenAI GPT-4o)
5. On completion, the page receives `publicUrl` and `productAnalysis`

### Generation Flow

1. The page calls `generateSingleImageAction` three times (table/lifestyle/hero)
2. Each task builds an enhanced prompt from `productAnalysis`
3. Flux (Replicate) generates an img2img output referencing the base image URL
4. The task uploads the result to R2 and sets `metadata.result.publicUrl`
5. `GeneratedCard` subscribes and renders the image on completion

### Error Handling

- Individual task failures don't affect other generations
- Retry triggers only that specific style
- Errors are surfaced via run metadata and UI messages

## Customization

### Adding Generation Styles

Add a new style key in `generate-image-and-upload.ts` inside `stylePrompts` and wire a corresponding button/card in `app/page.tsx`.

### Modifying Image Dimensions

Pass a different `size` when triggering `generateAndUploadImage` via the server action (e.g., `"1792x1024"` or `"1024x1792"`).

### Custom Progress Messages

Update `metadata.set("progress", ...)` in the respective task to change UX copy.

## Deployment

### Production Deployment

```bash
# Deploy tasks to Trigger.dev
pnpm dlx trigger.dev@latest deploy

# Deploy frontend (e.g., Vercel)
vercel deploy
```

### Environment Configuration

- Add all environment variables to deployment platform
- Configure R2 bucket CORS for production domain
- Update `R2_PUBLIC_URL` for production storage access
- Ensure OpenAI API key has sufficient credits and rate limits

## Development Notes

### Key Implementation Details

- Uses public access tokens to enable client-side run subscriptions
- `aspect-[3/4]` Tailwind class for portrait card layout
- Metadata carries progress + final result for robust UI updates

### Performance Considerations

- Parallel task execution for multiple image generations
- Cloud storage with aggressive cache headers for assets
- Consider API quotas for Replicate/OpenAI

## License

MIT License - see LICENSE file for details.
