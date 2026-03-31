import { simpleGit } from "simple-git";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { repoPath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("git");

export const gitBranch: ToolDefinition = {
  name: "git_branch",
  description: "List, create, or delete branches.",
  schema: {
    repo: z.string(),
    action: z.enum(["list", "create", "delete", "checkout"]).default("list"),
    name: z.string().optional().describe("Branch name for create/delete/checkout"),
    remote: z.boolean().optional().default(false).describe("Include remote branches when listing"),
  },
  handler: async ({ repo, action, name, remote }) => {
    const rp = repoPath(repo);
    log.info("Git branch operation", { repo: rp, action, name, remote });
    const g = simpleGit(rp);

    if (action === "list") {
      const branches = await g.branch(remote ? ["-a"] : []);
      const lines = Object.values(branches.branches).map(
        (b) => `${b.current ? "* " : "  "}${b.name}`
      );
      log.debug("Branches listed", { repo: rp, count: lines.length });
      return ok(lines.join("\n"));
    }

    if (!name) throw new Error("Branch name required for this action");

    if (action === "create") {
      await g.checkoutLocalBranch(name);
      log.info("Branch created and checked out", { repo: rp, branch: name });
      return ok(`Created and checked out branch: ${name}`);
    }

    if (action === "delete") {
      await g.deleteLocalBranch(name);
      log.info("Branch deleted", { repo: rp, branch: name });
      return ok(`Deleted branch: ${name}`);
    }

    if (action === "checkout") {
      await g.checkout(name);
      log.info("Checked out branch", { repo: rp, branch: name });
      return ok(`Checked out: ${name}`);
    }

    return ok("Unknown action");
  },
};
