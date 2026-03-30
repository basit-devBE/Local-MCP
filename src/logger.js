import { createLogger, format, transports } from "winston";
import path from "path";
import { fileURLToPath } from "url";

const { combine, timestamp, colorize, printf, errors, json } = format;

const isDev = process.env.NODE_ENV !== "production";

const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const ts = timestamp.slice(11, 23); // HH:MM:SS.mmm
  const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
  return stack
    ? `${ts} [${level}] ${message}\n${stack}`
    : `${ts} [${level}] ${message}${metaStr}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  ),
  transports: [
    // Always log to console
    new transports.Console({
      format: isDev
        ? combine(colorize({ all: true }), consoleFormat)
        : combine(json()),
    }),
  ],
});

export function childLogger(module) {
  return logger.child({ module });
}

export default logger;
