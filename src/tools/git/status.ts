import { simpleGit } from "simple-git";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { repoPath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("git");

export const gitStatus: ToolDefinition = {
  name: "git_status",
  description: "Get the current status of a git repository.",
  schema: {
    repo: z.string().describe("Path to the git repository"),
  },
  handler: async ({ repo }) => {
    const rp = repoPath(repo);
    log.info("Getting git status", { repo: rp });
    const status = await simpleGit(rp).status();
    log.debug("Git status fetched", {
      repo: rp,
      branch: status.current,
      ahead: status.ahead,
      behind: status.behind,
      staged: status.staged.length,
      modified: status.modified.length,
      untracked: status.not_added.length,
    });
    const lines = [
      `Branch:   ${status.current}`,
      `Ahead:    ${status.ahead} | Behind: ${status.behind}`,
      `Staged:   ${status.staged.join(", ") || "none"}`,
      `Modified: ${status.modified.join(", ") || "none"}`,
      `Untracked:${status.not_added.join(", ") || "none"}`,
      `Deleted:  ${status.deleted.join(", ") || "none"}`,
      `Conflicts:${status.conflicted.join(", ") || "none"}`,
    ];
    return ok(lines.join("\n"));
  },
};
