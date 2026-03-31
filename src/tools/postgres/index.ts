import type { ToolDefinition } from "../../types/index.js";
import { childLogger } from "../../logger.js";
import { pgQuery } from "./query.js";
import { pgListTables } from "./listTables.js";
import { pgDescribeTable } from "./describeTable.js";

const log = childLogger("postgres");

/**
 * Returns the Postgres tools.
 * These tools accept a connectionString interface parameter directly 
 * so they can dynamically connect to any Postgres database at runtime.
 */
export function getPostgresTools(): ToolDefinition[] {
  log.info("Registering dynamic Postgres database tools");
  return [
    pgQuery,
    pgListTables,
    pgDescribeTable,
  ];
}
