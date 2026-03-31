import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAllTools } from "../tools/registry.js";
import { ProcessManager } from "./processManager.js";
import { childLogger } from "../logger.js";

const log = childLogger("sessionManager");

export interface McpSession {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

const sessions = new Map<string, McpSession>();
const processManager = new ProcessManager();

export function createMcpServer(): McpServer {
  log.debug("Creating new McpServer instance");
  const server = new McpServer({ name: "local-env-mcp", version: "2.0.0" });
  registerAllTools(server, processManager);
  return server;
}

export function getSession(sessionId: string): McpSession | undefined {
  return sessions.get(sessionId);
}

export function setSession(sessionId: string, session: McpSession): void {
  sessions.set(sessionId, session);
  log.info(`Session stored: ${sessionId}`, { totalSessions: sessions.size });
}

export function deleteSession(sessionId: string): boolean {
  const deleted = sessions.delete(sessionId);
  if (deleted) {
    log.info(`Session removed: ${sessionId}`, { totalSessions: sessions.size });
  }
  return deleted;
}

export function sessionCount(): number {
  return sessions.size;
}
