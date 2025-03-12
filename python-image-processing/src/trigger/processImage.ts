import { schemaTask } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { python } from "@trigger.dev/python";
import { promises as fs } from "fs";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

// Initialize S3 client
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
});

// Define the input schema with Zod
const imageProcessingSchema = z.object({
  imageUrl: z.string().url(),
  height: z.number().positive().optional().default(800),
  width: z.number().positive().optional().default(600),
  quality: z.number().min(1).max(100).optional().default(85),
  maintainAspectRatio: z.boolean().optional().default(true),
  outputFormat: z.enum(["jpeg", "png", "webp", "gif", "avif"]).optional()
    .default("jpeg"),
  brightness: z.number().optional(),
  contrast: z.number().optional(),
  sharpness: z.number().optional(),
  grayscale: z.boolean().optional().default(false),
});

// Define the output schema
const outputSchema = z.object({
  url: z.string().url(),
  key: z.string(),
  format: z.string(),
  originalSize: z.object({
    width: z.number(),
    height: z.number(),
  }),
  newSize: z.object({
    width: z.number(),
    height: z.number(),
  }),
  fileSizeBytes: z.number(),
  exitCode: z.number(),
});

export const processImage = schemaTask({
  id: "process-image",
  schema: imageProcessingSchema,
  run: async (payload, io) => {
    const {
      imageUrl,
      height,
      width,
      quality,
      maintainAspectRatio,
      outputFormat,
      brightness,
      contrast,
      sharpness,
      grayscale,
    } = payload;

    try {
      // Run the Python script
      const result = await python.runScript(
        "./src/python/image-processing.py",
        [
          imageUrl,
          height.toString(),
          width.toString(),
          quality.toString(),
          maintainAspectRatio.toString(),
          outputFormat,
          brightness?.toString() || "null",
          contrast?.toString() || "null",
          sharpness?.toString() || "null",
          grayscale.toString(),
        ],
      );

      const { outputPath, format, originalSize, newSize, fileSizeBytes } = JSON
        .parse(result.stdout);

      // Read file once
      const fileContent = await fs.readFile(outputPath);

      try {
        // Upload to S3
        const key = `processed-images/${Date.now()}-${
          outputPath.split("/").pop()
        }`;
        await new Upload({
          client: s3Client,
          params: {
            Bucket: process.env.S3_BUCKET!,
            Key: key,
            Body: fileContent,
            ContentType: `image/${format}`,
          },
        }).done();

        return {
          url: `${process.env.S3_PUBLIC_URL}/${key}`,
          key,
          format,
          originalSize,
          newSize,
          fileSizeBytes,
          exitCode: result.exitCode,
        };
      } finally {
        // Always clean up the temp file
        await fs.unlink(outputPath).catch(console.error);
      }
    } catch (error) {
      throw new Error(
        `Processing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  },
});
