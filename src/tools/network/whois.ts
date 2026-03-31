import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync, type ExecError } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("network");

export const whois: ToolDefinition = {
  name: "whois",
  description: "Get WHOIS registration information for a domain or IP.",
  schema: {
    query: z.string().describe("Domain or IP address"),
  },
  handler: async ({ query }) => {
    log.info("WHOIS lookup", { query });
    try {
      const { stdout } = await execAsync(`whois ${query} 2>&1`, { timeout: 10000 });
      log.info("WHOIS lookup completed", { query });
      return ok(stdout);
    } catch (err) {
      const e = err as ExecError;
      log.warn("WHOIS lookup failed", { query, error: e.message });
      return ok(e.stdout || e.message);
    }
  },
};
