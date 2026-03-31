import fs from "fs";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { safePath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("filesystem");

export const makeDir: ToolDefinition = {
  name: "make_dir",
  description: "Create a directory (and any missing parents).",
  schema: {
    path: z.string(),
  },
  handler: async ({ path: p }) => {
    const fp = safePath(p);
    fs.mkdirSync(fp, { recursive: true });
    log.info("Created directory", { path: fp });
    return ok(`Directory created: ${fp}`);
  },
};
