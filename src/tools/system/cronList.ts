import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("system");

export const cronList: ToolDefinition = {
  name: "cron_list",
  description: "List current user's crontab entries.",
  schema: {},
  handler: async () => {
    log.debug("Listing crontab entries");
    try {
      const { stdout } = await execAsync("crontab -l 2>/dev/null");
      log.info("Crontab retrieved", { hasEntries: Boolean(stdout.trim()) });
      return ok(stdout || "(no crontab for this user)");
    } catch (e) {
      log.warn("Could not read crontab", { error: (e as Error).message });
      return ok("(no crontab)");
    }
  },
};
