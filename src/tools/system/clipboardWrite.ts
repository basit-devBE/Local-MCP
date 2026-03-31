import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("system");

export const clipboardWrite: ToolDefinition = {
  name: "clipboard_write",
  description: "Write text to the system clipboard.",
  schema: {
    text: z.string(),
  },
  handler: async ({ text }) => {
    log.info("Writing to clipboard", { textLength: text.length, platform: process.platform });
    const escaped = text.replace(/"/g, '\\"');
    let cmd: string;
    if (process.platform === "darwin") {
      cmd = `echo "${escaped}" | pbcopy`;
    } else if (process.platform === "win32") {
      cmd = `echo "${text}" | clip`;
    } else {
      cmd = `echo "${escaped}" | xclip -selection clipboard 2>/dev/null || echo "${escaped}" | xsel --clipboard 2>/dev/null`;
    }
    try {
      await execAsync(cmd);
      log.info("Clipboard write successful");
      return ok("Written to clipboard.");
    } catch (e) {
      log.warn("Clipboard write failed", { error: (e as Error).message });
      return ok(`Clipboard write failed: ${(e as Error).message}`);
    }
  },
};
