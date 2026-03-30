import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";

import { registerFilesystemTools } from "./tools/filesystem.js";
import { registerGitTools } from "./tools/git.js";
import { registerNetworkTools } from "./tools/network.js";
import { registerShellTools } from "./tools/shell.js";
import { registerSystemTools } from "./tools/system.js";

const PORT    = parseInt(process.env.PORT || "3000");
const FS_ROOT = process.env.FS_ROOT || "/host-home";

function createMcpServer() {
  const server = new McpServer({ name: "local-env-mcp", version: "1.0.0" });
  registerFilesystemTools(server);
  registerGitTools(server);
  registerNetworkTools(server);
  registerShellTools(server);
  registerSystemTools(server);
  return server;
}

const app = express();
app.use(express.json({ limit: "50mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime().toFixed(0), fs_root: FS_ROOT });
});

const transports = new Map();

app.post("/mcp", async (req, res) => {
  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      onsessioninitialized: (sessionId) => {
        transports.set(sessionId, { server, transport });
        console.log(`Session opened: ${sessionId} (total: ${transports.size})`);
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId);
        console.log(`Session closed: ${transport.sessionId}`);
      }
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("POST /mcp error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const session = transports.get(sessionId);
  if (session) {
    await session.transport.handleRequest(req, res);
  } else {
    res.status(400).json({ error: "Unknown session ID" });
  }
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const session = transports.get(sessionId);
  if (session) {
    await session.transport.handleRequest(req, res);
    transports.delete(sessionId);
  } else {
    res.status(400).json({ error: "Unknown session ID" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ local-env-mcp running on :${PORT} | FS: ${FS_ROOT} | Auth: ${process.env.MCP_AUTH_TOKEN ? "on" : "OFF"}`);
});
