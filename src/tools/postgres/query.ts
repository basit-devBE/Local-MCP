import pg from "pg";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { childLogger } from "../../logger.js";
import { ok } from "../../utils/response.js";

const log = childLogger("postgres");
const { Client } = pg;

export const pgQuery: ToolDefinition = {
  name: "pg_query",
  description: "Execute a raw SQL query against a Postgres database.",
  schema: {
    connectionString: z.string().describe("Postgres connection URL (e.g., postgresql://user:password@localhost:5432/mydb)"),
    query: z.string().describe("The SQL query to execute"),
    params: z.array(z.union([z.string(), z.number(), z.boolean()])).optional().describe("Optional parameterized values ($1, $2, etc.)"),
  },
  handler: async ({ connectionString, query, params }) => {
    log.info("Executing Postgres query", { query });
    
    const client = new Client({ connectionString });
    try {
      await client.connect();
      const result = await client.query(query, params || []);
      log.debug("Query successful", { rowCount: result.rowCount });
      
      const rows = JSON.stringify(result.rows, null, 2);
      return ok(`Rows Affected: ${result.rowCount ?? 0}\n\nResults:\n${rows}`);
    } catch (e) {
      log.error("Postgres query failed", { error: (e as Error).message });
      return ok(`Error executing query: ${(e as Error).message}`);
    } finally {
      await client.end().catch(() => {});
    }
  },
};
