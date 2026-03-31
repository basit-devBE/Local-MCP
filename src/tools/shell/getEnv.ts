import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { childLogger } from "../../logger.js";

const log = childLogger("shell");

export const getEnv: ToolDefinition = {
  name: "get_env",
  description: "Get environment variables visible to the MCP server process.",
  schema: {
    filter: z.string().optional().describe("Only return vars containing this string (case-insensitive)"),
    key: z.string().optional().describe("Get a specific variable by name"),
  },
  handler: async ({ filter, key }) => {
    if (key) {
      log.debug("Getting single env var", { key, found: key in process.env });
      return ok(`${key}=${process.env[key] ?? "(not set)"}`);
    }

    const entries = Object.entries(process.env);
    const filtered = filter
      ? entries.filter(([k]) => k.toLowerCase().includes(filter.toLowerCase()))
      : entries;
    const safe = filtered.map(([k, v]) =>
      /secret|token|password|key|api/i.test(k) ? `${k}=***REDACTED***` : `${k}=${v}`
    );
    log.debug("Returning env vars", { filter, total: entries.length, returned: safe.length });
    return ok(safe.join("\n"));
  },
};
