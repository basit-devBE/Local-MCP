import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("shell");

export const which: ToolDefinition = {
  name: "which",
  description: "Find the path of an executable on the system.",
  schema: {
    command: z.string(),
  },
  handler: async ({ command }) => {
    log.debug("Looking up binary path", { command });
    try {
      const { stdout } = await execAsync(`which ${command} 2>/dev/null || where ${command} 2>/dev/null`);
      const resolved = stdout.trim();
      log.info("Binary found", { command, path: resolved });
      return ok(resolved);
    } catch {
      log.warn("Binary not found", { command });
      return ok(`${command}: not found`);
    }
  },
};
