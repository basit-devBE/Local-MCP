import { simpleGit } from "simple-git";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { repoPath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("git");

export const gitPull: ToolDefinition = {
  name: "git_pull",
  description: "Pull latest changes from a remote.",
  schema: {
    repo: z.string(),
    remote: z.string().optional().default("origin"),
    branch: z.string().optional(),
    rebase: z.boolean().optional().default(false),
  },
  handler: async ({ repo, remote, branch, rebase }) => {
    const rp = repoPath(repo);
    log.info("Pulling from remote", { repo: rp, remote, branch, rebase });
    const result = await simpleGit(rp).pull(remote, branch, rebase ? { "--rebase": null } : {});
    log.info("Pull complete", {
      repo: rp,
      remote,
      changes: result.summary.changes,
      insertions: result.summary.insertions,
      deletions: result.summary.deletions,
    });
    return ok(
      `Pulled: ${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`
    );
  },
};
