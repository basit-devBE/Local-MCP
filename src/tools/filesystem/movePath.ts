import fs from "fs";
import path from "path";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { safePath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("filesystem");

export const movePath: ToolDefinition = {
  name: "move_path",
  description: "Move or rename a file or directory.",
  schema: {
    src: z.string(),
    dest: z.string(),
  },
  handler: async ({ src, dest }) => {
    const sp = safePath(src);
    const dp = safePath(dest);
    log.debug("Moving path", { src: sp, dest: dp });
    fs.mkdirSync(path.dirname(dp), { recursive: true });
    fs.renameSync(sp, dp);
    log.info("Moved path", { src: sp, dest: dp });
    return ok(`Moved ${sp} → ${dp}`);
  },
};
