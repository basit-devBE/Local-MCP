import { Router } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  createMcpServer,
  getSession,
  setSession,
  deleteSession,
  sessionCount,
} from "../services/sessionManager.js";
import { childLogger } from "../logger.js";

const log = childLogger("mcp");
const router = Router();

router.post("/", async (req, res) => {
  log.info("New MCP session request received");
  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      onsessioninitialized: (sessionId: string) => {
        setSession(sessionId, { server, transport });
        log.info(`Session opened: ${sessionId}`, { totalSessions: sessionCount() });
      },
    });

    transport.onclose = () => {
      const sessionId = transport.sessionId;
      if (sessionId) {
        deleteSession(sessionId);
        log.info(`Session closed: ${sessionId}`, { totalSessions: sessionCount() });
      }
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    const error = err as Error;
    log.error("Unhandled error in POST /mcp", { error: error.message, stack: error.stack });
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const session = sessionId ? getSession(sessionId) : undefined;
  if (session) {
    await session.transport.handleRequest(req, res);
  } else {
    log.warn("GET /mcp — unknown session ID", { sessionId });
    res.status(400).json({ error: "Unknown session ID" });
  }
});

router.delete("/", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  log.info("DELETE /mcp — tearing down session", { sessionId });
  const session = sessionId ? getSession(sessionId) : undefined;
  if (session) {
    await session.transport.handleRequest(req, res);
    deleteSession(sessionId!);
    log.info("Session torn down via DELETE", { sessionId, totalSessions: sessionCount() });
  } else {
    log.warn("DELETE /mcp — unknown session ID", { sessionId });
    res.status(400).json({ error: "Unknown session ID" });
  }
});

export default router;
