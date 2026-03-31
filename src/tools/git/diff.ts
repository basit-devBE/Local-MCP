import { simpleGit } from "simple-git";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { repoPath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("git");

export const gitDiff: ToolDefinition = {
  name: "git_diff",
  description: "Show diff of working tree, staged changes, or between commits.",
  schema: {
    repo: z.string(),
    staged: z.boolean().optional().default(false).describe("Show staged (index) diff"),
    file: z.string().optional().describe("Limit diff to this file"),
    from: z.string().optional().describe("From commit/branch"),
    to: z.string().optional().describe("To commit/branch"),
  },
  handler: async ({ repo, staged, file, from, to }) => {
    const rp = repoPath(repo);
    log.info("Getting git diff", { repo: rp, staged, file, from, to });
    const g = simpleGit(rp);

    let diff: string;
    if (from && to) {
      diff = await g.diff([from, to, ...(file ? ["--", file] : [])]);
    } else if (staged) {
      diff = await g.diff(["--cached", ...(file ? ["--", file] : [])]);
    } else {
      diff = await g.diff(file ? ["--", file] : []);
    }

    log.debug("Diff computed", { repo: rp, diffLength: diff?.length ?? 0 });
    return ok(diff || "(no changes)");
  },
};
