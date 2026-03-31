import { simpleGit } from "simple-git";
import path from "path";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { config } from "../../config.js";
import { childLogger } from "../../logger.js";

const log = childLogger("git");

export const gitClone: ToolDefinition = {
  name: "git_clone",
  description: "Clone a remote git repository.",
  schema: {
    url: z.string().describe("Repository URL"),
    dest: z.string().describe("Local destination path"),
    depth: z.number().optional().describe("Shallow clone depth"),
  },
  handler: async ({ url, dest, depth }) => {
    const dp = path.resolve(config.fsRoot, dest);
    log.info("Cloning repository", { url, dest: dp, depth });
    const options = depth ? ["--depth", String(depth)] : [];
    await simpleGit().clone(url, dp, options);
    log.info("Clone complete", { url, dest: dp });
    return ok(`Cloned ${url} → ${dp}`);
  },
};
