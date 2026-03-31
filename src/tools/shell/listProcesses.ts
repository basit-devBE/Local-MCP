import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import type { ProcessManager } from "../../services/processManager.js";
import { childLogger } from "../../logger.js";

const log = childLogger("shell");

export function createListProcessesTool(processManager: ProcessManager): ToolDefinition {
  return {
    name: "list_processes",
    description: "List all background processes started by spawn_process.",
    schema: {},
    handler: async () => {
      const all = processManager.list();
      log.debug("Listing background processes", { count: all.length });
      if (!all.length) return ok("No background processes running.");
      const lines = all.map(
        (p) => `#${p.id}  PID:${p.child.pid}  ${p.command} ${p.args.join(" ")}  cwd:${p.cwd}  started:${p.started.toISOString()}`
      );
      return ok(lines.join("\n"));
    },
  };
}
