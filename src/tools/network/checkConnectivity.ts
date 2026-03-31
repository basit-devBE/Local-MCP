import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { childLogger } from "../../logger.js";

const log = childLogger("network");

export const checkConnectivity: ToolDefinition = {
  name: "check_connectivity",
  description: "Quick check of internet connectivity and latency to common endpoints.",
  schema: {},
  handler: async () => {
    log.info("Running connectivity check");
    const targets: [string, string][] = [
      ["1.1.1.1", "https://1.1.1.1/cdn-cgi/trace"],
      ["Google", "https://www.google.com"],
      ["GitHub", "https://api.github.com"],
    ];
    const results: string[] = [];

    for (const [name, url] of targets) {
      const start = Date.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const elapsed = Date.now() - start;
        results.push(`  ${name.padEnd(10)}  ✅ ${res.status}  ${elapsed}ms`);
        log.debug("Connectivity target reachable", { name, url, status: res.status, elapsed_ms: elapsed });
      } catch (err) {
        const e = err as Error;
        results.push(`  ${name.padEnd(10)}  ❌ ${e.message.slice(0, 40)}`);
        log.warn("Connectivity target unreachable", { name, url, error: e.message });
      }
    }

    log.info("Connectivity check complete");
    return ok(`Connectivity check:\n${"─".repeat(40)}\n${results.join("\n")}`);
  },
};
