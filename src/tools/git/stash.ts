import { simpleGit } from "simple-git";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { repoPath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("git");

export const gitStash: ToolDefinition = {
  name: "git_stash",
  description: "Stash or pop working changes.",
  schema: {
    repo: z.string(),
    action: z.enum(["save", "pop", "list", "drop"]).default("save"),
    message: z.string().optional(),
  },
  handler: async ({ repo, action, message }) => {
    const rp = repoPath(repo);
    log.info("Git stash operation", { repo: rp, action, message });
    const g = simpleGit(rp);

    if (action === "save") {
      await g.stash(message ? ["push", "-m", message] : []);
      log.info("Changes stashed", { repo: rp, message });
      return ok("Stashed changes");
    }

    if (action === "pop") {
      await g.stash(["pop"]);
      log.info("Stash popped", { repo: rp });
      return ok("Popped stash");
    }

    if (action === "list") {
      const list = await g.stashList();
      log.debug("Stash list fetched", { repo: rp, count: list.all.length });
      return ok(list.all.map((s) => s.message).join("\n") || "(empty stash)");
    }

    if (action === "drop") {
      await g.stash(["drop"]);
      log.info("Top stash dropped", { repo: rp });
      return ok("Dropped top stash");
    }

    return ok("Unknown stash action");
  },
};
