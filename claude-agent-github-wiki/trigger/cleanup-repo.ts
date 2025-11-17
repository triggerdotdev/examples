import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { rm } from "fs/promises";
import { dirname } from "path";

export const cleanupRepo = schemaTask({
  id: "cleanup-repo",
  schema: z.object({
    tempDir: z.string(),
    repoName: z.string().optional(),
  }),
  run: async ({ tempDir, repoName }) => {
    console.log(`Starting cleanup for ${repoName || tempDir}`);

    try {
      // tempDir points to the /repo subdirectory, we need to clean up the parent
      const parentDir = dirname(tempDir);

      await rm(parentDir, { recursive: true, force: true });
      console.log(`Successfully cleaned up ${parentDir}`);

      return {
        success: true,
        cleanedPath: parentDir,
        repoName,
      };
    } catch (error: any) {
      console.error(`Cleanup failed for ${tempDir}:`, error);

      // Don't throw - cleanup failures shouldn't break the system
      return {
        success: false,
        error: error.message,
        repoName,
      };
    }
  },
});
