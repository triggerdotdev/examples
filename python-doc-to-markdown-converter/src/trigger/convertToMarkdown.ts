import { task } from "@trigger.dev/sdk/v3";
import { python } from "@trigger.dev/python";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as https from "https";
import * as http from "http";

export const convertToMarkdown = task({
  id: "convert-to-markdown",
  run: async (payload: { url: string }) => {
    try {
      const { url } = payload;

      // STEP 1: Create temporary file with unique name
      const tempDir = os.tmpdir();
      const fileName = `doc-${Date.now()}-${
        Math.random().toString(36).substring(2, 7)
      }`;
      const urlPath = new URL(url).pathname;
      // Detect file extension from URL or default to .docx
      const extension = path.extname(urlPath) || ".docx";
      const tempFilePath = path.join(tempDir, `${fileName}${extension}`);

      // STEP 2: Download file from URL
      await new Promise<void>((resolve, reject) => {
        const protocol = url.startsWith("https") ? https : http;
        const file = fs.createWriteStream(tempFilePath);

        protocol.get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(`Download failed with status ${response.statusCode}`),
            );
            return;
          }

          response.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
        }).on("error", (err) => {
          // Clean up on error
          fs.unlink(tempFilePath, () => {});
          reject(err);
        });
      });

      // STEP 3: Run Python script to convert document to markdown
      const pythonResult = await python.runScript(
        "./src/python/markdown-converter.py",
        [JSON.stringify({ file_path: tempFilePath })],
      );

      // STEP 4: Clean up temporary file
      fs.unlink(tempFilePath, () => {});

      // STEP 5: Process result - handle possible warnings
      // Only treat stderr as error if we don't have stdout data
      // This handles cases where non-critical warnings appear in stderr
      if (
        pythonResult.stderr &&
        !pythonResult.stderr.includes("Couldn't find ffmpeg") &&
        !pythonResult.stdout
      ) {
        throw new Error(`Python error: ${pythonResult.stderr}`);
      }

      // If we got valid stdout data, parse and use it regardless of stderr warnings
      // This ensures harmless warnings don't break the conversion
      if (pythonResult.stdout) {
        const result = JSON.parse(pythonResult.stdout);

        return {
          url,
          markdown: result.status === "success" ? result.markdown : null,
          error: result.status === "error" ? result.error : null,
          success: result.status === "success",
        };
      }

      return {
        url,
        markdown: null,
        error: "No output from Python script",
        success: false,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          url: payload.url,
          markdown: null,
          error: "Invalid URL format: " + error.errors[0].message,
          success: false,
        };
      }

      return {
        url: payload.url,
        markdown: null,
        error: error instanceof Error ? error.message : String(error),
        success: false,
      };
    }
  },
});
