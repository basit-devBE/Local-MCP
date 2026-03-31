import { Router } from "express";
import { config } from "../config.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime().toFixed(0),
    fs_root: config.fsRoot,
  });
});

router.get("/", (_req, res) => {
  res.send(`
    <h1>local-env-mcp</h1>
    <p>Model Context Protocol server for local environment access.</p>
    <p><strong>FS_ROOT:</strong> ${config.fsRoot}</p>
    <p><strong>Auth:</strong> ${config.authToken ? "ON" : "OFF"}</p>
    <p>Endpoints:</p>
    <ul>
      <li><code>POST /mcp</code>: Start a new MCP session.</li>
      <li><code>GET /mcp</code>: Poll an existing session.</li>
      <li><code>DELETE /mcp</code>: Close an existing session.</li>
    </ul>
  `);
});

export default router;
