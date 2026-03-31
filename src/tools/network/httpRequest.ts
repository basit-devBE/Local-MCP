import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { childLogger } from "../../logger.js";

const log = childLogger("network");

export const httpRequest: ToolDefinition = {
  name: "http_request",
  description: "Make an HTTP/HTTPS request (like curl). Supports GET, POST, PUT, PATCH, DELETE.",
  schema: {
    url: z.string().describe("Full URL to request"),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).default("GET"),
    headers: z.record(z.string()).optional().describe("Request headers"),
    body: z.string().optional().describe("Request body (JSON string or plain text)"),
    timeout_ms: z.number().optional().default(10000),
    follow_redirects: z.boolean().optional().default(true),
  },
  handler: async ({ url, method, headers, body, timeout_ms, follow_redirects }) => {
    log.info("HTTP request", { method, url, timeout_ms, hasBody: Boolean(body) });

    const start = Date.now();
    const res = await fetch(url, {
      method,
      headers: { "User-Agent": "local-mcp/2.0", ...headers },
      body: body || undefined,
      redirect: follow_redirects ? "follow" : "manual",
      signal: AbortSignal.timeout(timeout_ms),
    });

    const elapsed = Date.now() - start;
    log.info("HTTP response received", { method, url, status: res.status, elapsed_ms: elapsed });

    const responseHeaders = Object.fromEntries(res.headers.entries());
    const text = await res.text();
    const truncated = text.length > 8000;
    if (truncated) {
      log.debug("Response body truncated", { url, originalLength: text.length, truncatedTo: 8000 });
    }

    const lines = [
      `Status:  ${res.status} ${res.statusText}`,
      `URL:     ${res.url}`,
      `Headers: ${JSON.stringify(responseHeaders, null, 2)}`,
      ``,
      `Body:`,
      truncated ? text.slice(0, 8000) + "\n... (truncated)" : text,
    ];
    return ok(lines.join("\n"));
  },
};
