import fs from "fs";
import path from "path";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { safePath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("network");

export const downloadFile: ToolDefinition = {
  name: "download_file",
  description: "Download a file from a URL and save it to the local filesystem.",
  schema: {
    url: z.string(),
    dest: z.string().describe("Destination path (relative to FS_ROOT)"),
  },
  handler: async ({ url, dest }) => {
    const dp = safePath(dest);
    log.info("Downloading file", { url, dest: dp });
    fs.mkdirSync(path.dirname(dp), { recursive: true });

    const res = await fetch(url);
    if (!res.ok) {
      log.error("Download failed — bad HTTP response", { url, status: res.status, statusText: res.statusText });
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const buf = await res.arrayBuffer();
    fs.writeFileSync(dp, Buffer.from(buf));
    log.info("File downloaded", { url, dest: dp, sizeKB: (buf.byteLength / 1024).toFixed(1) });
    return ok(`Downloaded ${url} → ${dp} (${(buf.byteLength / 1024).toFixed(1)} KB)`);
  },
};
