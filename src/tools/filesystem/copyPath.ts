import fs from "fs";
import path from "path";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { safePath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("filesystem");

export const copyPath: ToolDefinition = {
  name: "copy_path",
  description: "Copy a file or directory to a destination.",
  schema: {
    src: z.string(),
    dest: z.string(),
  },
  handler: async ({ src, dest }) => {
    const sp = safePath(src);
    const dp = safePath(dest);
    log.debug("Copying path", { src: sp, dest: dp });
    fs.mkdirSync(path.dirname(dp), { recursive: true });
    fs.cpSync(sp, dp, { recursive: true });
    log.info("Copied path", { src: sp, dest: dp });
    return ok(`Copied ${sp} → ${dp}`);
  },
};
