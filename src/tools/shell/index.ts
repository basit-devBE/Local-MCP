import type { ToolDefinition } from "../../types/index.js";
import type { ProcessManager } from "../../services/processManager.js";
import { runCommand } from "./runCommand.js";
import { createSpawnProcessTool } from "./spawnProcess.js";
import { createListProcessesTool } from "./listProcesses.js";
import { createGetProcessLogsTool } from "./getProcessLogs.js";
import { createKillProcessTool } from "./killProcess.js";
import { systemInfo } from "./systemInfo.js";
import { getEnv } from "./getEnv.js";
import { which } from "./which.js";
import { ps } from "./ps.js";

export function createShellTools(processManager: ProcessManager): ToolDefinition[] {
  return [
    runCommand,
    createSpawnProcessTool(processManager),
    createListProcessesTool(processManager),
    createGetProcessLogsTool(processManager),
    createKillProcessTool(processManager),
    systemInfo,
    getEnv,
    which,
    ps,
  ];
}
