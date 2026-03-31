import fs from "fs";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { safePath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("filesystem");

export const deletePath: ToolDefinition = {
  name: "delete_path",
  description: "Delete a file or directory (recursive for directories).",
  schema: {
    path: z.string(),
    recursive: z.boolean().optional().default(false),
  },
  handler: async ({ path: p, recursive }) => {
    const fp = safePath(p);
    const stat = fs.statSync(fp);
    const isDir = stat.isDirectory();
    log.warn("Deleting path", { path: fp, type: isDir ? "directory" : "file", recursive });

    if (isDir) {
      fs.rmSync(fp, { recursive });
    } else {
      fs.unlinkSync(fp);
    }

    log.info("Deleted path", { path: fp });
    return ok(`Deleted: ${fp}`);
  },
};
