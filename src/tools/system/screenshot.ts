import fs from "fs";
import path from "path";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { safePath } from "../../utils/paths.js";
import { execAsync } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("system");

export const screenshot: ToolDefinition = {
  name: "screenshot",
  description: "Take a screenshot and save it to the filesystem.",
  schema: {
    output_path: z.string().describe("Where to save the screenshot"),
    delay_secs: z.number().optional().default(0),
  },
  handler: async ({ output_path, delay_secs }) => {
    const fp = safePath(output_path);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    log.info("Taking screenshot", { outputPath: fp, delay_secs, platform: process.platform });

    let cmd: string;
    if (process.platform === "darwin") {
      cmd = `screencapture -T ${delay_secs} "${fp}"`;
    } else if (process.platform === "win32") {
      cmd = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen | Out-Null; $bmp = New-Object System.Drawing.Bitmap([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen(0,0,0,0,$bmp.Size); $bmp.Save('${fp}')"`;
    } else {
      cmd = `import -window root "${fp}" 2>/dev/null || scrot "${fp}" 2>/dev/null`;
    }

    try {
      await execAsync(cmd, { timeout: 10000 });
      log.info("Screenshot saved", { outputPath: fp });
      return ok(`Screenshot saved to ${fp}`);
    } catch (e) {
      log.error("Screenshot failed", { outputPath: fp, error: (e as Error).message });
      return ok(`Screenshot failed: ${(e as Error).message}`);
    }
  },
};
