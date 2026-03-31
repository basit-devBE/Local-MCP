import type { z, ZodRawShape } from "zod";

export interface McpToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface ToolDefinition<TParams extends ZodRawShape = ZodRawShape> {
  name: string;
  description: string;
  schema: TParams;
  handler: (params: z.infer<z.ZodObject<TParams>>) => Promise<McpToolResult>;
}

export interface ManagedProcess {
  id: number;
  child: import("child_process").ChildProcess;
  logs: string[];
  command: string;
  args: string[];
  cwd: string;
  started: Date;
}
