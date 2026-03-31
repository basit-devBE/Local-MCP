import fs from "fs";
import path from "path";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { safePath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("filesystem");

export const listDir: ToolDefinition = {
  name: "list_dir",
  description: "List files and directories at a given path with metadata.",
  schema: {
    path: z.string().describe("Directory path"),
    recursive: z.boolean().optional().default(false),
    show_hidden: z.boolean().optional().default(false),
  },
  handler: async ({ path: p, recursive, show_hidden }) => {
    const fp = safePath(p);
    log.debug("Listing directory", { path: fp, recursive, show_hidden });
    const entries: string[] = [];

    function walk(dir: string, depth = 0): void {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (!show_hidden && item.name.startsWith(".")) continue;
        const full = path.join(dir, item.name);
        const rel = path.relative(fp, full);
        const stat = fs.statSync(full);
        const prefix = "  ".repeat(depth);
        const icon = item.isDirectory() ? "📁" : "📄";
        const size = item.isFile() ? ` (${(stat.size / 1024).toFixed(1)}KB)` : "";
        entries.push(`${prefix}${icon} ${rel}${size}`);
        if (recursive && item.isDirectory()) walk(full, depth + 1);
      }
    }

    walk(fp);
    log.info("Listed directory", { path: fp, entryCount: entries.length, recursive });
    return ok(entries.join("\n") || "(empty directory)");
  },
};