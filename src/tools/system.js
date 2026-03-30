import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod";

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
      try {
        const { stdout } = await execAsync("crontab -l 2>/dev/null");
        return ok(stdout || "(no crontab for this user)");
      } catch {
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
      try {
        const { stdout } = await execAsync(`du -h --max-depth=${depth} "${path}" 2>/dev/null | sort -rh | head -30`, { timeout: 15000 });
        return ok(stdout);
      } catch (e) {
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
      try {
        await execAsync(cmd);
        return ok(`Opened: ${target}`);
      } catch (e) {
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
        return ok(`Notification sent: ${title}`);
      } catch (e) {
        return ok(`Notification attempted: ${e.message}`);
      }
    }
  );

  server.tool(
    "clipboard_write",
    "Write text to the system clipboard.",
    { text: z.string() },
    async ({ text }) => {
      let cmd;
      if (process.platform === "darwin") cmd = `echo "${text.replace(/"/g, '\\"')}" | pbcopy`;
      else if (process.platform === "win32") cmd = `echo "${text}" | clip`;
      else cmd = `echo "${text.replace(/"/g, '\\"')}" | xclip -selection clipboard 2>/dev/null || echo "${text}" | xsel --clipboard 2>/dev/null`;
      try {
        await execAsync(cmd);
        return ok("Written to clipboard.");
      } catch (e) {
        return ok(`Clipboard write failed: ${e.message}`);
      }
    }
  );

  server.tool(
    "clipboard_read",
    "Read current clipboard content.",
    {},
    async () => {
      let cmd;
      if (process.platform === "darwin") cmd = "pbpaste";
      else if (process.platform === "win32") cmd = "powershell Get-Clipboard";
      else cmd = "xclip -selection clipboard -o 2>/dev/null || xsel --clipboard 2>/dev/null";
      try {
        const { stdout } = await execAsync(cmd);
        return ok(stdout);
      } catch (e) {
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
        return ok(`Screenshot saved to ${fp}`);
      } catch (e) {
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
      const cmds = {
        npm: "npm list -g --depth=0 2>/dev/null",
        pip: "pip list 2>/dev/null",
        brew: "brew list 2>/dev/null",
        apt: "dpkg -l 2>/dev/null",
        cargo: "cargo install --list 2>/dev/null",
      };
      try {
        const { stdout } = await execAsync(cmds[manager], { timeout: 15000 });
        if (filter) {
          const lines = stdout.split("\n").filter(l => l.toLowerCase().includes(filter.toLowerCase()));
          return ok(lines.join("\n") || "(none matching)");
        }
        return ok(stdout);
      } catch (e) {
        return ok(e.stdout || e.message);
      }
    }
  );
}
