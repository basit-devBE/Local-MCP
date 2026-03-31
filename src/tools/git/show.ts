import { simpleGit } from "simple-git";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { repoPath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("git");

export const gitShow: ToolDefinition = {
  name: "git_show",
  description: "Show the content and diff of a specific commit.",
  schema: {
    repo: z.string(),
    commit: z.string().default("HEAD"),
  },
  handler: async ({ repo, commit }) => {
    const rp = repoPath(repo);
    log.info("Showing commit", { repo: rp, commit });
    const result = await simpleGit(rp).show([commit, "--stat"]);
    return ok(result);
  },
};
