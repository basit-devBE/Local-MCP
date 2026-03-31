import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { config } from "../../config.js";
import type { ProcessManager } from "../../services/processManager.js";
import { childLogger } from "../../logger.js";

const log = childLogger("shell");

export function createSpawnProcessTool(processManager: ProcessManager): ToolDefinition {
  return {
    name: "spawn_process",
    description: "Start a long-running process in the background (e.g. a dev server). Returns a process ID.",
    schema: {
      command: z.string(),
      args: z.array(z.string()).optional().default([]),
      cwd: z.string().optional(),
      env: z.record(z.string()).optional(),
    },
    handler: async ({ command, args, cwd, env }) => {
      const workdir = cwd || config.fsRoot;
      log.info("Spawning background process", { command, args, cwd: workdir });
      const managed = processManager.spawn({ command, args, cwd: workdir, env });
      return ok(`Started process #${managed.id}: ${command} ${args.join(" ")}\nPID: ${managed.child.pid}`);
    },
  };
}
