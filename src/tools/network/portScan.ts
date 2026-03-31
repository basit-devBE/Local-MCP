import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("network");

export const portScan: ToolDefinition = {
  name: "port_scan",
  description: "Check if specific ports are open on a host. Not a full nmap — uses nc/netcat.",
  schema: {
    host: z.string(),
    ports: z.array(z.number()).describe("List of ports to check, e.g. [22, 80, 443, 3000, 8080]"),
    timeout_ms: z.number().optional().default(2000),
  },
  handler: async ({ host, ports, timeout_ms }) => {
    log.info("Port scan starting", { host, ports, timeout_ms });
    const results: string[] = [];
    let openCount = 0;

    for (const port of ports) {
      const timeoutSecs = Math.ceil(timeout_ms / 1000);
      try {
        await execAsync(`nc -z -w${timeoutSecs} ${host} ${port} 2>&1`, { timeout: timeout_ms + 500 });
        results.push(`  ${port.toString().padStart(5)}  ✅ OPEN`);
        openCount++;
      } catch {
        results.push(`  ${port.toString().padStart(5)}  ❌ CLOSED / FILTERED`);
      }
    }

    log.info("Port scan complete", {
      host,
      total: ports.length,
      open: openCount,
      closed: ports.length - openCount,
    });
    return ok(`Port scan: ${host}\n${"─".repeat(30)}\n${results.join("\n")}`);
  },
};
