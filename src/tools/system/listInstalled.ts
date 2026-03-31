import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync, type ExecError } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("system");

const PACKAGE_COMMANDS: Record<string, string> = {
  npm: "npm list -g --depth=0 2>/dev/null",
  pip: "pip list 2>/dev/null",
  brew: "brew list 2>/dev/null",
  apt: "dpkg -l 2>/dev/null",
  cargo: "cargo install --list 2>/dev/null",
};

export const listInstalled: ToolDefinition = {
  name: "list_installed",
  description: "List installed packages for a package manager.",
  schema: {
    manager: z.enum(["npm", "pip", "brew", "apt", "cargo"]).describe("Package manager to query"),
    filter: z.string().optional(),
  },
  handler: async ({ manager, filter }) => {
    log.info("Listing installed packages", { manager, filter });
    try {
      const { stdout } = await execAsync(PACKAGE_COMMANDS[manager], { timeout: 15000 });
      if (filter) {
        const lines = stdout.split("\n").filter((l) => l.toLowerCase().includes(filter.toLowerCase()));
        log.debug("Package list filtered", { manager, filter, matchCount: lines.length });
        return ok(lines.join("\n") || "(none matching)");
      }
      log.info("Package list retrieved", { manager });
      return ok(stdout);
    } catch (err) {
      const e = err as ExecError;
      log.error("Failed to list packages", { manager, error: e.message });
      return ok(e.stdout || e.message);
    }
  },
};
