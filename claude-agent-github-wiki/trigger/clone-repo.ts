import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { randomBytes } from "crypto";

const execAsync = promisify(exec);

// Generate a unique session ID
function generateSessionId(): string {
  return `session_${randomBytes(8).toString("hex")}`;
}

export const cloneRepo = schemaTask({
  id: "clone-repo",
  schema: z.object({
    githubUrl: z.string().url(),
  }),
  run: async ({ githubUrl }, { signal }) => {
    const abortController = new AbortController();

    signal.addEventListener("abort", () => {
      abortController.abort();
    });

    // Create temp directory for repo clone
    const tempDir = await mkdtemp(join(tmpdir(), "repo-"));
    console.log(`Created temp directory: ${tempDir}`);

    try {
      // Extract repo name from URL for logging
      const repoName = githubUrl.split("/").slice(-2).join("/").replace(
        ".git",
        "",
      );
      console.log(`Cloning repository: ${repoName}`);

      // Shallow clone repo (depth=1, single branch)
      const cloneCmd =
        `git clone --depth=1 --single-branch "${githubUrl}" "${tempDir}/repo"`;

      try {
        await execAsync(cloneCmd, {
          timeout: 120000, // 2 minute timeout for clone
          signal: abortController.signal,
        });
        console.log(`Successfully cloned ${repoName}`);
      } catch (cloneError: any) {
        // Cleanup temp dir on clone failure
        await rm(tempDir, { recursive: true, force: true });

        if (
          cloneError.code === 128 || cloneError.stderr?.includes("not found")
        ) {
          throw new Error(
            `Failed to clone repository. It may be private, not exist, or the URL is invalid.`,
          );
        }
        throw new Error(`Clone failed: ${cloneError.message}`);
      }

      const clonedAt = new Date();
      const sessionId = generateSessionId();

      // No cleanup task - repo-chat-session will handle cleanup
      console.log(`Cloned repo to ${tempDir} with session ${sessionId}`);

      return {
        tempDir: join(tempDir, "repo"),
        repoName,
        sessionId,
        clonedAt: clonedAt.toISOString(),
      };
    } catch (error: any) {
      console.error(`Clone task failed:`, error);
      throw error;
    }
  },
});
