import { simpleGit } from "simple-git";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { repoPath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("git");

export const gitPush: ToolDefinition = {
  name: "git_push",
  description: "Push commits to a remote.",
  schema: {
    repo: z.string(),
    remote: z.string().optional().default("origin"),
    branch: z.string().optional(),
    force: z.boolean().optional().default(false),
  },
  handler: async ({ repo, remote, branch, force }) => {
    const rp = repoPath(repo);
    log.info("Pushing to remote", { repo: rp, remote, branch, force });
    const args = force ? ["--force"] : [];
    await simpleGit(rp).push(remote, branch, args);
    log.info("Push complete", { repo: rp, remote, branch });
    return ok(`Pushed to ${remote}${branch ? "/" + branch : ""}`);
  },
};
