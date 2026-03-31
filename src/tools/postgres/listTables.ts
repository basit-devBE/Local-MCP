import pg from "pg";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { childLogger } from "../../logger.js";
import { ok } from "../../utils/response.js";

const log = childLogger("postgres");
const { Client } = pg;

export const pgListTables: ToolDefinition = {
  name: "pg_list_tables",
  description: "List all user tables in the connected Postgres database.",
  schema: {
    connectionString: z.string().describe("Postgres connection URL (e.g., postgresql://user:password@localhost:5432/mydb)"),
  },
  handler: async ({ connectionString }) => {
    log.debug("Listing Postgres tables");
    const query = `
      SELECT tablename 
      FROM pg_catalog.pg_tables 
      WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'
      ORDER BY tablename;
    `;
    
    const client = new Client({ connectionString });
    try {
      await client.connect();
      const result = await client.query(query);
      const tables = result.rows.map(r => r.tablename);
      
      log.debug("Tables retrieved", { count: tables.length });
      return ok(tables.length > 0 ? tables.join("\n") : "(no tables found)");
    } catch (e) {
      log.error("Failed to list tables", { error: (e as Error).message });
      return ok(`Error listing tables: ${(e as Error).message}`);
    } finally {
      await client.end().catch(() => {});
    }
  },
};
