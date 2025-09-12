import { randomUUID } from "crypto";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import type { generateImages } from "@/trigger/generate-images";
import { auth, tasks } from "@trigger.dev/sdk/v3";

const f = createUploadthing();

const mockAuth = (req: Request) => ({ id: randomUUID() }); // Fake auth function

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  imageUploader: f({ image: { maxFileSize: "4MB" } })
    // Set permissions and file types for this FileRoute
    .middleware(async ({ req }) => {
      // This code runs on your server before upload
      const user = await mockAuth(req);

      // If you throw, the user will not be able to upload
      if (!user) throw new UploadThingError("Unauthorized");

      // Whatever is returned here is accessible in onUploadComplete as `metadata`
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // This code RUNS ON YOUR SERVER after upload

      const { id, publicAccessToken } = await tasks.trigger<
        typeof generateImages
      >("generate-images", {
        images: [
          {
            id: "isolated-table",
            baseImageUrl: file.ufsUrl,
            promptStyle: "isolated-table",
          },
          {
            id: "lifestyle-scene",
            baseImageUrl: file.ufsUrl,
            promptStyle: "lifestyle-scene",
          },
          {
            id: "hero-shot",
            baseImageUrl: file.ufsUrl,
            promptStyle: "hero-shot",
          },
        ],
      });

      const triggerToken = await auth.createTriggerPublicToken(
        "generate-image"
      );

      // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
      return {
        uploadedBy: metadata.userId,
        publicAccessToken,
        triggerToken,
        runId: id,
        fileId: file.key,
        fileUrl: file.ufsUrl,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
