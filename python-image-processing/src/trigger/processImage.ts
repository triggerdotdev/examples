import { task } from "@trigger.dev/sdk/v3";
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

export const processImage = task({
  id: "process-image",
  run: async (payload: {
    imageUrl: string;
    height?: number;
    width?: number;
    quality?: number;
    maintainAspectRatio?: boolean;
    outputFormat?: "jpeg" | "png" | "webp" | "gif" | "avif";
    brightness?: number;
    contrast?: number;
    sharpness?: number;
    grayscale?: boolean;
  }, io: any) => {
    const {
      imageUrl,
      height = 800,
      width = 600,
      quality = 85,
      maintainAspectRatio = true,
      outputFormat = "jpeg",
      brightness,
      contrast,
      sharpness,
      grayscale = false,
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
