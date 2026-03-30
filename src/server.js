import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { registerFilesystemTools } from "./tools/filesystem.js";
import { registerGitTools } from "./tools/git.js";
import { registerNetworkTools } from "./tools/network.js";
import { registerShellTools } from "./tools/shell.js";
import { registerSystemTools } from "./tools/system.js";
import { childLogger, logRequest, logStartupBanner, flushAndExit } from "./logger.js";

const log = childLogger("server");

const PORT    = parseInt(process.env.PORT || "3000");
const FS_ROOT = process.env.FS_ROOT || "/host-home";

process.on("SIGTERM", () => flushAndExit(0));
process.on("SIGINT",  () => flushAndExit(0));

function createMcpServer() {
  log.debug("Creating new McpServer instance");
  const server = new McpServer({ name: "local-env-mcp", version: "1.0.0" });
  registerFilesystemTools(server);
  registerGitTools(server);
  registerNetworkTools(server);
  registerShellTools(server);
  registerSystemTools(server);
  log.debug("All tool groups registered (filesystem, git, network, shell, system)");
  return server;
}

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(logRequest);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime().toFixed(0), fs_root: FS_ROOT });
});

app.get("/", (_req, res) => {
  res.send(`
    <h1>local-env-mcp</h1>
    <p>Model Context Protocol server for local environment access.</p>
    <p><strong>FS_ROOT:</strong> ${FS_ROOT}</p>
    <p><strong>Auth:</strong> ${process.env.MCP_AUTH_TOKEN ? "ON" : "OFF"}</p>
    <p>Endpoints:</p>
    <ul>
      <li><code>POST /mcp</code>: Start a new MCP session.</li>
      <li><code>GET /mcp</code>: Poll an existing session.</li>
      <li><code>DELETE /mcp</code>: Close an existing session.</li>
    </ul>
  `);
});

const sessionMap = new Map();

app.post("/mcp", async (req, res) => {
  log.info("New MCP session request received");
  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      onsessioninitialized: (sessionId) => {
        sessionMap.set(sessionId, { server, transport });
        log.info(`Session opened: ${sessionId}`, { totalSessions: sessionMap.size });
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        sessionMap.delete(transport.sessionId);
        log.info(`Session closed: ${transport.sessionId}`, { totalSessions: sessionMap.size });
      }
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    log.error("Unhandled error in POST /mcp", { error: err.message, stack: err.stack });
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const session   = sessionMap.get(sessionId);
  if (session) {
    await session.transport.handleRequest(req, res);
  } else {
    log.warn("GET /mcp — unknown session ID", { sessionId });
    res.status(400).json({ error: "Unknown session ID" });
  }
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  log.info("DELETE /mcp — tearing down session", { sessionId });
  const session = sessionMap.get(sessionId);
  if (session) {
    await session.transport.handleRequest(req, res);
    sessionMap.delete(sessionId);
    log.info("Session torn down via DELETE", { sessionId, totalSessions: sessionMap.size });
  } else {
    log.warn("DELETE /mcp — unknown session ID", { sessionId });
    res.status(400).json({ error: "Unknown session ID" });
  }
});

app.listen(PORT, () => {
  logStartupBanner({
    port:    PORT,
    fsRoot:  FS_ROOT,
    auth:    Boolean(process.env.MCP_AUTH_TOKEN),
    nodeEnv: process.env.NODE_ENV,
  });
});
