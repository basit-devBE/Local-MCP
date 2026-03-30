import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev      = process.env.NODE_ENV !== "production";
const LOG_LEVEL  = process.env.LOG_LEVEL  || (isDev ? "debug" : "info");
const LOG_DIR    = process.env.LOG_DIR    || path.join(__dirname, "..", "logs");

const REDACT_KEYS = /secret|token|password|passwd|key|api[_-]?key|auth|bearer|credential/i;

const { combine, timestamp, colorize, printf, errors, json, splat } = format;

function redact(obj, depth = 0) {
  if (depth > 6 || obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(v => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      REDACT_KEYS.test(k) ? [k, "***REDACTED***"] : [k, redact(v, depth + 1)]
    )
  );
}

const redactFormat = format((info) => {
  const { level, message, timestamp, stack, ...meta } = info;
  const cleaned = redact(meta);
  return Object.assign(info, cleaned);
});

const devConsoleFormat = printf(({ level, message, timestamp, stack, module, ...meta }) => {
  const ts      = String(timestamp).slice(11, 23);
  const mod     = module ? ` [${module}]` : "";
  const metaStr = Object.keys(meta).length ? "  " + JSON.stringify(meta, null, 0) : "";
  const base = `${ts} ${level}${mod}  ${message}${metaStr}`;
  return stack ? `${base}\n${stack}` : base;
});

const consoleTransport = new transports.Console({
  format: isDev
    ? combine(colorize({ all: true }), devConsoleFormat)
    : combine(json()),
});

const rollingFileTransport = new DailyRotateFile({
  dirname:       LOG_DIR,
  filename:      "mcp-%DATE%.log",
  datePattern:   "YYYY-MM-DD",
  zippedArchive: true,
  maxFiles:      "14d",
  maxSize:       "20m",
  format:        combine(json()),
});

const errorFileTransport = new DailyRotateFile({
  dirname:       LOG_DIR,
  filename:      "mcp-error-%DATE%.log",
  datePattern:   "YYYY-MM-DD",
  zippedArchive: true,
  maxFiles:      "30d",
  level:         "error",
  format:        combine(json()),
});

const logger = createLogger({
  level: LOG_LEVEL,
  format: combine(
    errors({ stack: true }),
    redactFormat(),
    splat(),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  ),
  transports: [
    consoleTransport,
    rollingFileTransport,
    errorFileTransport,
  ],
  exitOnError: false,
});

logger.request = function (req, res, durationMs) {
  const level = res.statusCode >= 500 ? "error"
              : res.statusCode >= 400 ? "warn"
              : "info";

  logger[level](`${req.method} ${req.originalUrl || req.path} → ${res.statusCode}`, {
    method:      req.method,
    path:        req.originalUrl || req.path,
    status:      res.statusCode,
    duration_ms: durationMs,
    ip:          req.ip,
    sessionId:   req.headers["mcp-session-id"] || undefined,
    userAgent:   req.headers["user-agent"]     || undefined,
  });
};

logger.tool = function (toolName, input = {}, result = {}, durationMs = 0) {
  const isError = result?.isError === true;
  logger[isError ? "error" : "info"](`[tool] ${toolName}`, {
    tool:        toolName,
    input:       redact(input),
    isError,
    duration_ms: durationMs,
  });
};

export function childLogger(module, defaultMeta = {}) {
  return logger.child({ module, ...defaultMeta });
}

export function logRequest(req, res, next) {
  const start = Date.now();
  logger.debug(`→ ${req.method} ${req.path}`, {
    module:    "http",
    ip:        req.ip,
    sessionId: req.headers["mcp-session-id"] || undefined,
  });
  res.on("finish", () => logger.request(req, res, Date.now() - start));
  next();
}

export function logStartupBanner({ port, fsRoot, auth, nodeEnv } = {}) {
  logger.info("════════════════════════════════════════");
  logger.info(" local-env-mcp starting up", {
    port,
    fsRoot,
    auth:     auth ? "enabled" : "DISABLED",
    nodeEnv:  nodeEnv || process.env.NODE_ENV || "development",
    logLevel: LOG_LEVEL,
    logDir:   LOG_DIR,
    node:     process.version,
    hostname: os.hostname(),
    pid:      process.pid,
  });
  logger.info("════════════════════════════════════════");
}

export function flushAndExit(code = 0) {
  logger.info("Server shutting down — flushing logs…", { pid: process.pid });
  logger.on("finish", () => process.exit(code));
  logger.end();
}

export default logger;
