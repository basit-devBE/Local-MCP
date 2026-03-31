import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import type { ProcessManager } from "../../services/processManager.js";
import { childLogger } from "../../logger.js";

const log = childLogger("shell");

export function createGetProcessLogsTool(processManager: ProcessManager): ToolDefinition {
  return {
    name: "get_process_logs",
    description: "Get stdout/stderr output from a background process.",
    schema: {
      process_id: z.number(),
      last_n: z.number().optional().default(50).describe("Return last N lines"),
    },
    handler: async ({ process_id, last_n }) => {
      log.debug("Fetching process logs", { process_id, last_n });
      const proc = processManager.get(process_id);
      if (!proc) {
        log.warn("Process not found", { process_id });
        return ok(`No process with ID #${process_id}`);
      }
      const lines = processManager.getLogs(process_id, last_n);
      log.debug("Returning process logs", { process_id, totalLogLines: proc.logs.length, returned: lines.length });
      return ok(lines.join("\n") || "(no output yet)");
    },
  };
}
