import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("system");

export const clipboardRead: ToolDefinition = {
  name: "clipboard_read",
  description: "Read current clipboard content.",
  schema: {},
  handler: async () => {
    log.debug("Reading clipboard", { platform: process.platform });
    let cmd: string;
    if (process.platform === "darwin") cmd = "pbpaste";
    else if (process.platform === "win32") cmd = "powershell Get-Clipboard";
    else cmd = "xclip -selection clipboard -o 2>/dev/null || xsel --clipboard 2>/dev/null";
    try {
      const { stdout } = await execAsync(cmd);
      log.info("Clipboard read successful", { contentLength: stdout.length });
      return ok(stdout);
    } catch (e) {
      log.warn("Clipboard read failed", { error: (e as Error).message });
      return ok(`Clipboard read failed: ${(e as Error).message}`);
    }
  },
};
