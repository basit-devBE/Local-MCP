import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync, type ExecError } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("system");

export const diskUsage: ToolDefinition = {
  name: "disk_usage",
  description: "Show disk usage for a path (like `du -sh`).",
  schema: {
    path: z.string().default("/").describe("Path to check"),
    depth: z.number().optional().default(1).describe("Depth of subdirectory report"),
  },
  handler: async ({ path: p, depth }) => {
    log.info("Checking disk usage", { path: p, depth });
    try {
      const { stdout } = await execAsync(
        `du -h --max-depth=${depth} "${p}" 2>/dev/null | sort -rh | head -30`,
        { timeout: 15000 }
      );
      log.debug("Disk usage retrieved", { path: p, depth });
      return ok(stdout);
    } catch (err) {
      const e = err as ExecError;
      log.warn("Disk usage command failed", { path: p, error: e.message });
      return ok(e.stdout || e.message);
    }
  },
};
