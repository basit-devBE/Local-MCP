import { simpleGit } from "simple-git";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { repoPath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("git");

export const gitAdd: ToolDefinition = {
  name: "git_add",
  description: "Stage files for commit.",
  schema: {
    repo: z.string(),
    files: z.array(z.string()).optional().describe("Files to stage, omit for all"),
  },
  handler: async ({ repo, files }) => {
    const rp = repoPath(repo);
    log.info("Staging files", { repo: rp, files: files ?? "all" });
    await simpleGit(rp).add(files?.length ? files : ["-A"]);
    log.debug("Files staged", { repo: rp });
    return ok(`Staged: ${files?.join(", ") || "all changes"}`);
  },
};
