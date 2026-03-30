export function authMiddleware(req, res, next) {
  const token = process.env.MCP_AUTH_TOKEN;

  if (!token) {
    if (process.env.NODE_ENV === "production") {
      return res.status(500).json({ error: "Server misconfiguration: MCP_AUTH_TOKEN not set" });
    }
    console.warn("⚠️  WARNING: MCP_AUTH_TOKEN not set — running without authentication (dev only)");
    return next();
  }

  const provided = req.headers["x-mcp-token"];
  if (!provided || provided !== token) {
    return res.status(401).json({ error: "Unauthorized: invalid or missing X-MCP-Token header" });
  }

  next();
}
