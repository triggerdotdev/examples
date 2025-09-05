# AI Product Image Generator

Transform product photos into professional marketing materials using AI-powered image generation.

Upload a product image and automatically generate three marketing variations: isolated table shots, lifestyle scenes, and hero presentations. Built with Next.js, Trigger.dev, and OpenAI's DALL-E 3.

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
├── Handles user image uploads to R2 storage
├── 4-step progress tracking

generateAndUploadImage
├── Generates AI image using DALL-E 3
├── Uploads result to R2 storage
├── 5-step progress tracking

batchGenerateAndUploadImages
├── Triggers 3x generateAndUploadImage tasks in parallel
├── Returns individual run IDs for UI subscription
```

### Component Architecture

```
UploadCard (aspect-square)
├── Drag & drop image upload
├── Progress tracking via run subscription
├── Triggers batch generation on completion

GeneratedCard (aspect-[3/4])
├── Individual task progress tracking
├── Real-time image display via subscription
├── Download and retry functionality

Main Page
├── Grid layout: 1 upload + 3 generated cards
├── State management for run IDs and access tokens
├── Individual generation triggering and retry handling
```

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Trigger.dev account and project
- OpenAI API key with DALL-E 3 access
- Cloudflare R2 bucket for image storage

### Environment Variables

```env
# Trigger.dev
TRIGGER_SECRET_KEY=tr_dev_your_secret_key_here

# OpenAI
OPENAI_API_KEY=sk-your_openai_api_key_here

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

## Usage

1. Upload a product image via drag & drop or file selection
2. Upload task runs with 4-step progress tracking
3. On completion, batch task triggers 3 parallel generation tasks
4. Each GeneratedCard subscribes to its individual task progress
5. Generated images display with download functionality
6. Failed generations can be retried individually

## Technical Implementation

### AI Prompt Engineering

Each generation uses prompts that emphasize:

- Product consistency: "EXACT same product from reference image"
- Material preservation: "Identical colors, textures, materials, and design details"
- Context adaptation: Only backgrounds and lighting change

### Progress Tracking Implementation

- Upload Task: 4 steps (prepare → process → upload → complete)
- Generation Tasks: 5 steps (prepare → generate → prepare upload → upload → complete)
- Real-time updates via `runs.subscribeToRun()` with public access tokens

### Image Processing

- Format: Portrait 1024x1792 for optimal display in 3:4 aspect ratio cards
- Display: `object-contain` CSS to prevent cropping
- Storage: Cloudflare R2 with automatic public URL generation
- Fallback: Base64 blob URLs if storage unavailable

## Project Structure

```
src/
├── trigger/
│   ├── image-upload.ts              # User image upload to R2
│   ├── generate-and-upload-image.ts # AI generation + upload (single task)
│   └── batch-generate-and-upload.ts # Batch processing coordinator
├── app/
│   ├── actions.ts                   # Server actions for task triggering
│   ├── components/
│   │   ├── UploadCard.tsx          # Image upload with progress
│   │   ├── GeneratedCard.tsx       # Generated image display with subscription
│   │   └── ui/                     # shadcn/ui components
│   └── page.tsx                    # Main application interface
└── trigger.config.ts               # Trigger.dev configuration
```

## Task Flow Details

### Upload Flow

1. `UploadCard` triggers `uploadImageToR2` task
2. Task converts file to base64, uploads to R2, returns public URL
3. `UploadCard` subscribes to run progress, displays completion
4. On completion, triggers `batchGenerateAndUploadImages`

### Generation Flow

1. `batchGenerateAndUploadImages` triggers 3x `generateAndUploadImage` tasks
2. Each task: generates image → uploads to R2 → returns public URL
3. `GeneratedCard` components subscribe to individual task progress
4. Images display automatically when tasks complete

### Error Handling

- Individual task failures don't affect other generations
- Retry functionality re-triggers specific failed tasks
- Comprehensive error logging and user feedback

## Customization

### Adding Generation Styles

Edit prompts in `src/trigger/batch-generate-and-upload.ts`:

```typescript
const prompts = [
  {
    id: "your-style-id",
    prompt: "Your detailed prompt here...",
  },
];
```

### Modifying Image Dimensions

Change size parameter in actions:

```typescript
size: "1024x1792", // Portrait
size: "1792x1024", // Landscape
size: "1024x1024", // Square
```

### Custom Progress Messages

Update metadata in task files:

```typescript
metadata.set("progress", {
  step: 2,
  total: 5,
  message: "Custom progress message",
});
```

## Deployment

### Production Deployment

```bash
# Deploy tasks to Trigger.dev
pnpm dlx trigger.dev@latest deploy

# Deploy frontend (Vercel recommended)
vercel deploy
```

### Environment Configuration

- Add all environment variables to deployment platform
- Configure R2 bucket CORS for production domain
- Update `R2_PUBLIC_URL` for production storage access
- Ensure OpenAI API key has sufficient credits and rate limits

## Development Notes

### Key Implementation Details

- Uses `triggerAndWait()` for sequential task dependencies
- Public access tokens enable client-side run subscriptions
- `aspect-[3/4]` Tailwind class for portrait card layout
- Error boundaries and timeout handling for stuck tasks

### Performance Considerations

- Parallel task execution for multiple image generations
- Efficient base64 to blob conversion for image display
- Proper cleanup of blob URLs and timeouts
- Rate limiting considerations for OpenAI API calls

## License

MIT License - see LICENSE file for details.
