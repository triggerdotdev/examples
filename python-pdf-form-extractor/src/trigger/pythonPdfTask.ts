import { task } from "@trigger.dev/sdk/v3";
import { python } from "@trigger.dev/python";

export const processPdfForm = task({
  id: "process-pdf-form",
  run: async (payload: { pdfUrl: string }, io: any) => {
    const { pdfUrl } = payload;
    const args = [pdfUrl];

    const result = await python.runScript(
      "./src/python/extract-pdf-form.py",
      args,
    );

    // Parse the JSON output from the script
    let formData;
    try {
      formData = JSON.parse(result.stdout);
    } catch (error) {
      throw new Error(`Failed to parse JSON output: ${result.stdout}`);
    }

    return {
      formData,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  },
});
