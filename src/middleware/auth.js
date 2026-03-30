import { childLogger } from "../logger.js";

const log = childLogger("auth");

export function authMiddleware(req, res, next) {
  const token = process.env.MCP_AUTH_TOKEN;

  if (!token) {
    if (process.env.NODE_ENV === "production") {
      log.error("MCP_AUTH_TOKEN is not set in production — rejecting request");
      return res.status(500).json({ error: "Server misconfiguration: MCP_AUTH_TOKEN not set" });
    }
    log.warn("MCP_AUTH_TOKEN not set — running without authentication (dev only)");
    return next();
  }

  const provided = req.headers["x-mcp-token"];
  if (!provided || provided !== token) {
    log.warn("Rejected request with invalid or missing X-MCP-Token", {
      ip: req.ip,
      path: req.path,
      tokenProvided: Boolean(provided),
    });
    return res.status(401).json({ error: "Unauthorized: invalid or missing X-MCP-Token header" });
  }

  log.debug("Auth passed", { ip: req.ip, path: req.path });
  next();
}
