import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import type { ProcessManager } from "../../services/processManager.js";
import { childLogger } from "../../logger.js";

const log = childLogger("shell");

export function createKillProcessTool(processManager: ProcessManager): ToolDefinition {
  return {
    name: "kill_process",
    description: "Kill a background process by its ID (from spawn_process) or by PID.",
    schema: {
      process_id: z.number().optional(),
      pid: z.number().optional(),
      signal: z.enum(["SIGTERM", "SIGKILL", "SIGHUP"]).optional().default("SIGTERM"),
    },
    handler: async ({ process_id, pid, signal }) => {
      if (process_id !== undefined) {
        const killed = processManager.kill(process_id, signal as NodeJS.Signals);
        if (!killed) {
          log.warn("Kill requested for unknown process ID", { process_id });
          return ok(`No process with ID #${process_id}`);
        }
        return ok(`Killed process #${process_id} with ${signal}`);
      }

      if (pid !== undefined) {
        processManager.killByPid(pid, signal as NodeJS.Signals);
        return ok(`Sent ${signal} to PID ${pid}`);
      }

      throw new Error("Provide either process_id or pid");
    },
  };
}
