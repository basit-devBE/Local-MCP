import { simpleGit } from "simple-git";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { repoPath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("git");

export const gitCommit: ToolDefinition = {
  name: "git_commit",
  description: "Commit staged changes.",
  schema: {
    repo: z.string(),
    message: z.string().describe("Commit message"),
    author_name: z.string().optional(),
    author_email: z.string().optional(),
  },
  handler: async ({ repo, message, author_name, author_email }) => {
    const rp = repoPath(repo);
    log.info("Creating git commit", { repo: rp, message, author: author_name });
    const opts: Record<string, string> = {};
    if (author_name && author_email) {
      opts["--author"] = `${author_name} <${author_email}>`;
    }
    const result = await simpleGit(rp).commit(message, opts);
    log.info("Commit created", {
      repo: rp,
      commitHash: result.commit,
      changes: result.summary.changes,
      insertions: result.summary.insertions,
      deletions: result.summary.deletions,
    });
    return ok(
      `Committed: ${result.commit}\nSummary: ${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`
    );
  },
};
