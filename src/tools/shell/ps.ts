import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("shell");

export const ps: ToolDefinition = {
  name: "ps",
  description: "List running system processes.",
  schema: {
    filter: z.string().optional().describe("Filter by process name"),
    full: z.boolean().optional().default(false),
  },
  handler: async ({ filter, full }) => {
    const cmd = process.platform === "win32"
      ? "tasklist"
      : full ? "ps aux" : "ps -eo pid,ppid,user,%cpu,%mem,comm,args --sort=-%cpu";
    log.debug("Listing system processes", { filter, full, platform: process.platform });

    try {
      const { stdout } = await execAsync(cmd, { timeout: 5000 });
      if (filter) {
        const lines = stdout.split("\n").filter((l) => l.toLowerCase().includes(filter.toLowerCase()));
        log.info("Process list filtered", { filter, matchCount: lines.length });
        return ok(lines.join("\n") || "(no matching processes)");
      }
      return ok(stdout);
    } catch (e) {
      log.error("Failed to list processes", { error: (e as Error).message });
      return ok((e as Error).message);
    }
  },
};
