import { task } from "@trigger.dev/sdk/v3";
import { python } from "@trigger.dev/python";

export const processPdfForm = task({
  id: "process-pdf-form",
  run: async (payload: { pdfPath: string; outputDir?: string }, io: any) => {
    const { pdfPath, outputDir } = payload;
    const args = [pdfPath];

    // Add output directory as a flag if provided
    if (outputDir) {
      args.push("--output", outputDir);
    } else {
      args.push("--output", "./output");
    }

    const result = await python.runScript(
      "./src/python/extract-pdf-form.py",
      args,
    );

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  },
});
