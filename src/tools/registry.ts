import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDefinition } from "../types/index.js";
import type { ProcessManager } from "../services/processManager.js";
import { filesystemTools } from "./filesystem/index.js";
import { gitTools } from "./git/index.js";
import { networkTools } from "./network/index.js";
import { createShellTools } from "./shell/index.js";
import { systemTools } from "./system/index.js";
import { getPostgresTools } from "./postgres/index.js";
import { childLogger } from "../logger.js";

const log = childLogger("registry");

export function registerAllTools(server: McpServer, processManager: ProcessManager): number {
  const allTools: ToolDefinition[] = [
    ...filesystemTools,
    ...gitTools,
    ...networkTools,
    ...createShellTools(processManager),
    ...systemTools,
    ...getPostgresTools(),
  ];

  for (const tool of allTools) {
    server.tool(tool.name, tool.description, tool.schema, tool.handler);
  }

  log.info("All tools registered", { count: allTools.length });
  return allTools.length;
}
