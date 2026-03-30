import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { registerFilesystemTools } from "./tools/filesystem.js";
import { registerGitTools } from "./tools/git.js";
import { registerNetworkTools } from "./tools/network.js";
import { registerShellTools } from "./tools/shell.js";
import { registerSystemTools } from "./tools/system.js";
import { childLogger } from "./logger.js";

const log = childLogger("server");

const PORT    = parseInt(process.env.PORT || "3000");
const FS_ROOT = process.env.FS_ROOT || "/host-home";

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

app.use((req, _res, next) => {
  log.debug(`Incoming ${req.method} ${req.path}`, {
    sessionId: req.headers["mcp-session-id"] || undefined,
    ip: req.ip,
  });
  next();
});

app.get("/health", (_req, res) => {
  log.debug("Health check requested");
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

const transports = new Map();

app.post("/mcp", async (req, res) => {
  log.info("New MCP session request received");
  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      onsessioninitialized: (sessionId) => {
        transports.set(sessionId, { server, transport });
        log.info(`Session opened: ${sessionId}`, { totalSessions: transports.size });
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId);
        log.info(`Session closed: ${transport.sessionId}`, { totalSessions: transports.size });
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
  log.debug(`GET /mcp — resuming session ${sessionId}`);
  const session = transports.get(sessionId);
  if (session) {
    await session.transport.handleRequest(req, res);
  } else {
    log.warn(`GET /mcp — unknown session ID: ${sessionId}`);
    res.status(400).json({ error: "Unknown session ID" });
  }
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  log.info(`DELETE /mcp — tearing down session ${sessionId}`);
  const session = transports.get(sessionId);
  if (session) {
    await session.transport.handleRequest(req, res);
    transports.delete(sessionId);
    log.info(`Session ${sessionId} torn down via DELETE`, { totalSessions: transports.size });
  } else {
    log.warn(`DELETE /mcp — unknown session ID: ${sessionId}`);
    res.status(400).json({ error: "Unknown session ID" });
  }
});

app.listen(PORT, () => {
  log.info(`local-env-mcp started`, {
    port: PORT,
    fsRoot: FS_ROOT,
    auth: process.env.MCP_AUTH_TOKEN ? "enabled" : "DISABLED",
    nodeEnv: process.env.NODE_ENV || "development",
  });
});
