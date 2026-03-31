import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("system");

export const notify: ToolDefinition = {
  name: "notify",
  description: "Send a desktop notification.",
  schema: {
    title: z.string(),
    message: z.string(),
  },
  handler: async ({ title, message }) => {
    log.info("Sending desktop notification", { title, platform: process.platform });
    let cmd: string;
    if (process.platform === "darwin") {
      cmd = `osascript -e 'display notification "${message}" with title "${title}"'`;
    } else if (process.platform === "win32") {
      cmd = `msg * /TIME:5 "${title}: ${message}" 2>/dev/null`;
    } else {
      cmd = `notify-send "${title}" "${message}" 2>/dev/null || echo "notify-send not available"`;
    }
    try {
      await execAsync(cmd);
      log.info("Desktop notification sent", { title });
      return ok(`Notification sent: ${title}`);
    } catch (e) {
      log.warn("Notification attempt failed", { title, error: (e as Error).message });
      return ok(`Notification attempted: ${(e as Error).message}`);
    }
  },
};
