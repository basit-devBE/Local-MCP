import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync, type ExecError } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("network");

export const dnsLookup: ToolDefinition = {
  name: "dns_lookup",
  description: "Resolve DNS records for a domain.",
  schema: {
    host: z.string(),
    type: z.enum(["A", "AAAA", "MX", "TXT", "CNAME", "NS", "SOA", "ALL"]).default("ALL"),
  },
  handler: async ({ host, type }) => {
    log.info("DNS lookup", { host, type });
    const cmd = type === "ALL"
      ? `nslookup ${host} 2>&1 || host ${host} 2>&1 || dig ${host} 2>&1`
      : `dig ${host} ${type} +short 2>&1 || nslookup -type=${type} ${host} 2>&1`;
    try {
      const { stdout } = await execAsync(cmd, { timeout: 10000 });
      log.info("DNS lookup completed", { host, type });
      return ok(stdout || "(no results)");
    } catch (err) {
      const e = err as ExecError;
      log.warn("DNS lookup failed", { host, type, error: e.message });
      return ok(e.stdout || e.message);
    }
  },
};
