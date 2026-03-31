import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync, type ExecError } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("network");

export const traceroute: ToolDefinition = {
  name: "traceroute",
  description: "Trace the network path to a host.",
  schema: {
    host: z.string(),
  },
  handler: async ({ host }) => {
    const cmd = process.platform === "darwin"
      ? `traceroute ${host}`
      : `traceroute -m 20 ${host} 2>&1`;
    log.info("Traceroute started", { host });
    try {
      const { stdout } = await execAsync(cmd, { timeout: 30000 });
      log.info("Traceroute complete", { host });
      return ok(stdout);
    } catch (err) {
      const e = err as ExecError;
      log.warn("Traceroute failed", { host, error: e.message });
      return ok(e.stdout || e.message);
    }
  },
};
