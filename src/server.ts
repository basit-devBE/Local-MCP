import app from "./app.js";
import { config } from "./config.js";
import { logStartupBanner, flushAndExit } from "./logger.js";

process.on("SIGTERM", () => flushAndExit(0));
process.on("SIGINT", () => flushAndExit(0));

app.listen(config.port, () => {
  logStartupBanner({
    port: config.port,
    fsRoot: config.fsRoot,
    auth: Boolean(config.authToken),
    nodeEnv: config.nodeEnv,
  });
});
