import { task } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { python } from "@trigger.dev/python";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as https from "https";
import * as http from "http";

// Define the payload schema for type safety
const urlPayloadSchema = z.object({
  url: z.string().url(),
});

export const convertToMarkdown = task({
  id: "convert-to-markdown",
  run: async (payload: z.infer<typeof urlPayloadSchema>, { ctx }) => {
    try {
      // Validate payload
      const validatedPayload = urlPayloadSchema.parse(payload);
      const url = validatedPayload.url;

      // Create a temporary file path
      const tempDir = os.tmpdir();
      const fileName = `download-${Date.now()}-${
        Math.random().toString(36).slice(2, 7)
      }`;
      const urlPath = new URL(url).pathname;
      const extension = path.extname(urlPath) || ".docx";
      const tempFilePath = path.join(tempDir, `${fileName}${extension}`);

      // Download the file
      await downloadFile(url, tempFilePath);

      // Create config for Python script
      const config = {
        file_path: tempFilePath,
      };

      // Execute the Python script
      const result = await python.runScript(
        "./src/python/markdown-converter.py",
        [JSON.stringify(config)],
      );

      // Clean up temporary file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      if (result.stderr) {
        throw new Error(`Error running Python script: ${result.stderr}`);
      }

      // Parse the JSON output
      const parsedResult = JSON.parse(result.stdout);

      if (parsedResult.status === "success") {
        return {
          success: true,
          markdown: parsedResult.markdown,
          url,
        };
      } else {
        return {
          success: false,
          error: parsedResult.error ||
            "Unknown error occurred during conversion",
          url,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        url: payload.url,
      };
    }
  },
});

// Helper function to download a file
async function downloadFile(url: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    const fileStream = fs.createWriteStream(filePath);
    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        fs.unlinkSync(filePath);
        reject(new Error(`Failed to download file: ${response.statusCode}`));
        return;
      }

      response.pipe(fileStream);
      fileStream.on("finish", () => {
        fileStream.close();
        resolve();
      });
    });

    request.on("error", (err) => {
      fs.unlinkSync(filePath);
      reject(err);
    });
  });
}
