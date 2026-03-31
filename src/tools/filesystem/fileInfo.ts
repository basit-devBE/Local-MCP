import fs from "fs";
import mime from "mime-types";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { safePath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("filesystem");

export const fileInfo: ToolDefinition = {
  name: "file_info",
  description: "Get metadata about a file or directory.",
  schema: {
    path: z.string(),
  },
  handler: async ({ path: p }) => {
    const fp = safePath(p);
    log.debug("Fetching file info", { path: fp });
    const stat = fs.statSync(fp);
    const type = stat.isDirectory() ? "directory" : "file";
    log.info("File info retrieved", { path: fp, type, sizeKB: (stat.size / 1024).toFixed(2) });

    return ok([
      `Path:     ${fp}`,
      `Type:     ${type}`,
      `Size:     ${(stat.size / 1024).toFixed(2)} KB`,
      `MIME:     ${mime.lookup(fp) || "unknown"}`,
      `Modified: ${stat.mtime.toISOString()}`,
      `Created:  ${stat.birthtime.toISOString()}`,
      `Mode:     ${(stat.mode & 0o777).toString(8)}`,
    ].join("\n"));
  },
};
