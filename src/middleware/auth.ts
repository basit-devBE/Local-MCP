import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";
import { childLogger } from "../logger.js";

const log = childLogger("auth");

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = config.authToken;

  if (!token) {
    if (config.nodeEnv === "production") {
      log.error("MCP_AUTH_TOKEN is not set in production — rejecting request");
      res.status(500).json({ error: "Server misconfiguration: MCP_AUTH_TOKEN not set" });
      return;
    }
    log.warn("MCP_AUTH_TOKEN not set — running without authentication (dev only)");
    next();
    return;
  }

  const provided = req.headers["x-mcp-token"] as string | undefined;
  if (!provided || provided !== token) {
    log.warn("Rejected request with invalid or missing X-MCP-Token", {
      ip: req.ip,
      path: req.path,
      tokenProvided: Boolean(provided),
    });
    res.status(401).json({ error: "Unauthorized: invalid or missing X-MCP-Token header" });
    return;
  }

  log.debug("Auth passed", { ip: req.ip, path: req.path });
  next();
}
