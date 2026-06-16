import express from "express";
import { logRequest } from "./logger.js";
import healthRoutes from "./routes/health.js";
import mcpRoutes from "./routes/mcp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { SimpleOAuthProvider } from "./auth/oauthProvider.js";
import { config } from "./config.js";

const app = express();
export const oauthProvider = new SimpleOAuthProvider();

app.use(express.json({ limit: "50mb" }));
app.use(logRequest);

app.use(mcpAuthRouter({
  provider: oauthProvider,
  issuerUrl: new URL(config.publicUrl),
  resourceServerUrl: new URL(`${config.publicUrl}/mcp`),
}));

app.use(healthRoutes);

const mcpAuth = requireBearerAuth({ verifier: oauthProvider });
app.use("/mcp", mcpAuth, mcpRoutes);
app.use("/", mcpAuth, mcpRoutes);

export default app;
