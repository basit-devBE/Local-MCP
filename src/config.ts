import "dotenv/config";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const configSchema = z.object({
  port: z.coerce.number().default(3000),
  fsRoot: z.string().default("/host-home"),
  authToken: z.string().optional(),
  publicUrl: z.string().default("http://localhost:3000"),
  nodeEnv: z.string().default("development"),
  logLevel: z.string().default("debug"),
  logDir: z.string().default(path.join(__dirname, "..", "logs")),
});

export type AppConfig = z.infer<typeof configSchema>;


export const config: AppConfig = Object.freeze(
  configSchema.parse({
    port: process.env.PORT,
    fsRoot: process.env.FS_ROOT,
    authToken: process.env.MCP_AUTH_TOKEN,
    publicUrl: process.env.PUBLIC_URL,
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
    logDir: process.env.LOG_DIR,
  })
);
