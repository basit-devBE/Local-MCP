import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync, type ExecError } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("network");

export const ping: ToolDefinition = {
  name: "ping",
  description: "Ping a host to check connectivity and latency.",
  schema: {
    host: z.string().describe("Hostname or IP address"),
    count: z.number().optional().default(4),
  },
  handler: async ({ host, count }) => {
    const cmd = process.platform === "win32"
      ? `ping -n ${count} ${host}`
      : `ping -c ${count} ${host}`;
    log.info("Pinging host", { host, count });
    try {
      const { stdout } = await execAsync(cmd, { timeout: 15000 });
      log.info("Ping completed", { host });
      return ok(stdout);
    } catch (err) {
      const e = err as ExecError;
      log.warn("Ping failed or host unreachable", { host, error: e.message });
      return ok(e.stdout || e.message);
    }
  },
};
