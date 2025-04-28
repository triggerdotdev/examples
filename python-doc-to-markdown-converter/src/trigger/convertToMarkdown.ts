import { task } from "@trigger.dev/sdk/v3";
import { python } from "@trigger.dev/python";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export const convertToMarkdown = task({
  id: "convert-to-markdown",
  run: async (payload: { url: string }) => {
    const { url } = payload;

    // STEP 1: Create temporary file with unique name
    const tempDir = os.tmpdir();
    const fileName = `doc-${Date.now()}-${
      Math.random().toString(36).substring(2, 7)
    }`;
    const urlPath = new URL(url).pathname;
    const extension = path.extname(urlPath) || ".docx";
    const tempFilePath = path.join(tempDir, `${fileName}${extension}`);

    // STEP 2: Download file from URL
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    await fs.promises.writeFile(tempFilePath, Buffer.from(buffer));

    // STEP 3: Run Python script to convert document to markdown
    const pythonResult = await python.runScript(
      "./src/python/markdown-converter.py",
      [JSON.stringify({ file_path: tempFilePath })],
    );

    // STEP 4: Clean up temporary file
    fs.unlink(tempFilePath, () => {});

    // STEP 5: Process result
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
  },
});
