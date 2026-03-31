import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import os from "os";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";

const isDev = config.nodeEnv !== "production";

const REDACT_KEYS = /secret|token|password|passwd|key|api[_-]?key|auth|bearer|credential/i;

const { combine, timestamp, colorize, printf, errors, json, splat } = format;

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
interface JsonObject { [key: string]: JsonValue }
type JsonArray = JsonValue[];

function redact(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) =>
      REDACT_KEYS.test(k) ? [k, "***REDACTED***"] : [k, redact(v, depth + 1)]
    )
  );
}

const redactFormat = format((info) => {
  const { level: _level, message: _message, timestamp: _ts, stack: _stack, ...meta } = info;
  const cleaned = redact(meta) as Record<string, unknown>;
  return Object.assign(info, cleaned);
});

const devConsoleFormat = printf(({ level, message, timestamp: ts, stack, module: mod, ...meta }) => {
  const time = String(ts).slice(11, 23);
  const moduleTag = mod ? ` [${mod}]` : "";
  const metaStr = Object.keys(meta).length ? "  " + JSON.stringify(meta, null, 0) : "";
  const base = `${time} ${level}${moduleTag}  ${message}${metaStr}`;
  return stack ? `${base}\n${stack}` : base;
});

const consoleTransport = new transports.Console({
  format: isDev
    ? combine(colorize({ all: true }), devConsoleFormat)
    : combine(json()),
});

const rollingFileTransport = new DailyRotateFile({
  dirname: config.logDir,
  filename: "mcp-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxFiles: "14d",
  maxSize: "20m",
  format: combine(json()),
});

const errorFileTransport = new DailyRotateFile({
  dirname: config.logDir,
  filename: "mcp-error-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxFiles: "30d",
  level: "error",
  format: combine(json()),
});

const logger = createLogger({
  level: config.logLevel,
  format: combine(
    errors({ stack: true }),
    redactFormat(),
    splat(),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  ),
  transports: [consoleTransport, rollingFileTransport, errorFileTransport],
  exitOnError: false,
});

export function childLogger(moduleName: string, defaultMeta: Record<string, unknown> = {}) {
  return logger.child({ module: moduleName, ...defaultMeta });
}

export function logRequest(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  logger.debug(`→ ${req.method} ${req.path}`, {
    module: "http",
    ip: req.ip,
    sessionId: req.headers["mcp-session-id"] ?? undefined,
  });

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? "error"
      : res.statusCode >= 400 ? "warn"
        : "info";

    logger[level](`${req.method} ${req.originalUrl || req.path} → ${res.statusCode}`, {
      method: req.method,
      path: req.originalUrl || req.path,
      status: res.statusCode,
      duration_ms: durationMs,
      ip: req.ip,
      sessionId: req.headers["mcp-session-id"] ?? undefined,
      userAgent: req.headers["user-agent"] ?? undefined,
    });
  });

  next();
}

export function logStartupBanner(opts: {
  port: number;
  fsRoot: string;
  auth: boolean;
  nodeEnv: string | undefined;
}): void {
  logger.info("════════════════════════════════════════");
  logger.info(" local-env-mcp starting up", {
    port: opts.port,
    fsRoot: opts.fsRoot,
    auth: opts.auth ? "enabled" : "DISABLED",
    nodeEnv: opts.nodeEnv ?? config.nodeEnv,
    logLevel: config.logLevel,
    logDir: config.logDir,
    node: process.version,
    hostname: os.hostname(),
    pid: process.pid,
  });
  logger.info("════════════════════════════════════════");
}

export function flushAndExit(code = 0): void {
  logger.info("Server shutting down — flushing logs…", { pid: process.pid });
  logger.on("finish", () => process.exit(code));
  logger.end();
}

export default logger;
