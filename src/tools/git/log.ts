import { simpleGit } from "simple-git";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { repoPath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("git");

export const gitLog: ToolDefinition = {
  name: "git_log",
  description: "Show commit history for a repository.",
  schema: {
    repo: z.string(),
    max_count: z.number().optional().default(20),
    branch: z.string().optional(),
    file: z.string().optional(),
  },
  handler: async ({ repo, max_count, branch, file }) => {
    const rp = repoPath(repo);
    log.info("Getting git log", { repo: rp, max_count, branch, file });
    const result = await simpleGit(rp).log({
      maxCount: max_count,
      ...(branch ? { from: branch } : {}),
      ...(file ? { file } : {}),
    });
    log.debug("Git log fetched", { repo: rp, commitCount: result.all.length });
    const lines = result.all.map(
      (c) => `${c.hash.slice(0, 8)}  ${c.date.slice(0, 10)}  ${c.author_name.padEnd(20)}  ${c.message}`
    );
    return ok(lines.join("\n") || "(no commits)");
  },
};
