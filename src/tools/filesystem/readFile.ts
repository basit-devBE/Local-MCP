import fs from "fs";
import mime from "mime-types";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { safePath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("filesystem");

export const readFile: ToolDefinition = {
  name: "read_file",
  description: "Read the contents of a file. Returns text for text files, base64 for binary.",
  schema: {
    path: z.string().describe("File path relative to FS_ROOT or absolute"),
  },
  handler: async ({ path: p }) => {
    const fp = safePath(p);
    log.debug("Reading file", { path: fp });

    const mimeType = mime.lookup(fp) || "application/octet-stream";
    const isBinary = !mimeType.startsWith("text/")
      && !mimeType.includes("json")
      && !mimeType.includes("xml")
      && !mimeType.includes("javascript");

    if (isBinary) {
      const data = fs.readFileSync(fp).toString("base64");
      log.info("Read binary file (base64)", { path: fp, mimeType, sizeBytes: data.length });
      return ok(`[Binary file — base64]\n${data}`);
    }

    const content = fs.readFileSync(fp, "utf-8");
    log.info("Read text file", { path: fp, mimeType, lines: content.split("\n").length });
    return ok(content);
  },
};
