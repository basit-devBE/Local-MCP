import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("system");

export const open: ToolDefinition = {
  name: "open",
  description: "Open a file or URL with the default system application.",
  schema: {
    target: z.string().describe("File path or URL to open"),
  },
  handler: async ({ target }) => {
    const cmd = process.platform === "darwin" ? `open "${target}"`
      : process.platform === "win32" ? `start "" "${target}"`
        : `xdg-open "${target}" 2>/dev/null`;
    log.info("Opening target", { target, platform: process.platform });
    try {
      await execAsync(cmd);
      log.info("Target opened successfully", { target });
      return ok(`Opened: ${target}`);
    } catch (e) {
      log.warn("Failed to open target", { target, error: (e as Error).message });
      return ok(`Failed to open: ${(e as Error).message}`);
    }
  },
};
