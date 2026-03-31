import type { McpToolResult } from "../types/index.js";

export function ok(text: string): McpToolResult {
  return { content: [{ type: "text", text }] };
}

export function errorResponse(message: string): McpToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
