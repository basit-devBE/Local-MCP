import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import { childLogger } from "../logger.js";

const log = childLogger("system");
const execAsync = promisify(exec);

function ok(text) {
  return { content: [{ type: "text", text: String(text) }] };
}

export function registerSystemTools(server) {

  server.tool(
    "cron_list",
    "List current user's crontab entries.",
    {},
    async () => {
      log.debug("Listing crontab entries");
      try {
        const { stdout } = await execAsync("crontab -l 2>/dev/null");
        log.info("Crontab retrieved", { hasEntries: Boolean(stdout.trim()) });
        return ok(stdout || "(no crontab for this user)");
      } catch (e) {
        log.warn("Could not read crontab", { error: e.message });
        return ok("(no crontab)");
      }
    }
  );

  server.tool(
    "disk_usage",
    "Show disk usage for a path (like `du -sh`).",
    {
      path: z.string().default("/").describe("Path to check"),
      depth: z.number().optional().default(1).describe("Depth of subdirectory report"),
    },
    async ({ path, depth }) => {
      log.info("Checking disk usage", { path, depth });
      try {
        const { stdout } = await execAsync(
          `du -h --max-depth=${depth} "${path}" 2>/dev/null | sort -rh | head -30`,
          { timeout: 15000 }
        );
        log.debug("Disk usage retrieved", { path, depth });
        return ok(stdout);
      } catch (e) {
        log.warn("Disk usage command failed", { path, error: e.message });
        return ok(e.stdout || e.message);
      }
    }
  );

  server.tool(
    "open",
    "Open a file or URL with the default system application.",
    { target: z.string().describe("File path or URL to open") },
    async ({ target }) => {
      const cmd = process.platform === "darwin" ? `open "${target}"` :
                  process.platform === "win32"  ? `start "" "${target}"` :
                  `xdg-open "${target}" 2>/dev/null`;
      log.info("Opening target", { target, platform: process.platform });
      try {
        await execAsync(cmd);
        log.info("Target opened successfully", { target });
        return ok(`Opened: ${target}`);
      } catch (e) {
        log.warn("Failed to open target", { target, error: e.message });
        return ok(`Failed to open: ${e.message}`);
      }
    }
  );

  server.tool(
    "notify",
    "Send a desktop notification.",
    {
      title: z.string(),
      message: z.string(),
    },
    async ({ title, message }) => {
      log.info("Sending desktop notification", { title, platform: process.platform });
      let cmd;
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
        log.warn("Notification attempt failed", { title, error: e.message });
        return ok(`Notification attempted: ${e.message}`);
      }
    }
  );

  server.tool(
    "clipboard_write",
    "Write text to the system clipboard.",
    { text: z.string() },
    async ({ text }) => {
      log.info("Writing to clipboard", { textLength: text.length, platform: process.platform });
      let cmd;
      if (process.platform === "darwin") cmd = `echo "${text.replace(/"/g, '\\"')}" | pbcopy`;
      else if (process.platform === "win32") cmd = `echo "${text}" | clip`;
      else cmd = `echo "${text.replace(/"/g, '\\"')}" | xclip -selection clipboard 2>/dev/null || echo "${text}" | xsel --clipboard 2>/dev/null`;
      try {
        await execAsync(cmd);
        log.info("Clipboard write successful");
        return ok("Written to clipboard.");
      } catch (e) {
        log.warn("Clipboard write failed", { error: e.message });
        return ok(`Clipboard write failed: ${e.message}`);
      }
    }
  );

  server.tool(
    "clipboard_read",
    "Read current clipboard content.",
    {},
    async () => {
      log.debug("Reading clipboard", { platform: process.platform });
      let cmd;
      if (process.platform === "darwin") cmd = "pbpaste";
      else if (process.platform === "win32") cmd = "powershell Get-Clipboard";
      else cmd = "xclip -selection clipboard -o 2>/dev/null || xsel --clipboard 2>/dev/null";
      try {
        const { stdout } = await execAsync(cmd);
        log.info("Clipboard read successful", { contentLength: stdout.length });
        return ok(stdout);
      } catch (e) {
        log.warn("Clipboard read failed", { error: e.message });
        return ok(`Clipboard read failed: ${e.message}`);
      }
    }
  );

  server.tool(
    "screenshot",
    "Take a screenshot and save it to the filesystem.",
    {
      output_path: z.string().describe("Where to save the screenshot"),
      delay_secs: z.number().optional().default(0),
    },
    async ({ output_path, delay_secs }) => {
      const fs = await import("fs");
      const path = await import("path");
      const ROOT = process.env.FS_ROOT || "/host-home";
      const fp = path.resolve(ROOT, output_path);
      fs.mkdirSync(path.dirname(fp), { recursive: true });

      log.info("Taking screenshot", { outputPath: fp, delay_secs, platform: process.platform });

      let cmd;
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
        log.error("Screenshot failed", { outputPath: fp, error: e.message });
        return ok(`Screenshot failed: ${e.message}`);
      }
    }
  );

  server.tool(
    "list_installed",
    "List installed packages for a package manager.",
    {
      manager: z.enum(["npm", "pip", "brew", "apt", "cargo"]).describe("Package manager to query"),
      filter: z.string().optional(),
    },
    async ({ manager, filter }) => {
      log.info("Listing installed packages", { manager, filter });
      const cmds = {
        npm:   "npm list -g --depth=0 2>/dev/null",
        pip:   "pip list 2>/dev/null",
        brew:  "brew list 2>/dev/null",
        apt:   "dpkg -l 2>/dev/null",
        cargo: "cargo install --list 2>/dev/null",
      };
      try {
        const { stdout } = await execAsync(cmds[manager], { timeout: 15000 });
        if (filter) {
          const lines = stdout.split("\n").filter(l => l.toLowerCase().includes(filter.toLowerCase()));
          log.debug("Package list filtered", { manager, filter, matchCount: lines.length });
          return ok(lines.join("\n") || "(none matching)");
        }
        log.info("Package list retrieved", { manager });
        return ok(stdout);
      } catch (e) {
        log.error("Failed to list packages", { manager, error: e.message });
        return ok(e.stdout || e.message);
      }
    }
  );
}
