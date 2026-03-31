import fs from "fs";
import path from "path";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { safePath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("filesystem");

export const writeFile: ToolDefinition = {
  name: "write_file",
  description: "Write content to a file. Creates parent directories if needed.",
  schema: {
    path: z.string().describe("Destination file path"),
    content: z.string().describe("Text content to write"),
    append: z.boolean().optional().default(false).describe("Append instead of overwrite"),
  },
  handler: async ({ path: p, content, append }) => {
    const fp = safePath(p);
    fs.mkdirSync(path.dirname(fp), { recursive: true });

    if (append) {
      fs.appendFileSync(fp, content, "utf-8");
      log.info("Appended to file", { path: fp, bytesWritten: content.length });
      return ok(`Appended ${content.length} chars to ${fp}`);
    }

    fs.writeFileSync(fp, content, "utf-8");
    log.info("Wrote file", { path: fp, bytesWritten: content.length });
    return ok(`Written ${content.length} chars to ${fp}`);
  },
};
