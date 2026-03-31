import pg from "pg";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { childLogger } from "../../logger.js";
import { ok } from "../../utils/response.js";

const log = childLogger("postgres");
const { Client } = pg;

export const pgDescribeTable: ToolDefinition = {
  name: "pg_describe_table",
  description: "Get schema details (columns, types, nullability) for a specific table.",
  schema: {
    connectionString: z.string().describe("Postgres connection URL (e.g., postgresql://user:password@localhost:5432/mydb)"),
    table: z.string().describe("Name of the table to describe"),
  },
  handler: async ({ connectionString, table }) => {
    log.debug("Describing table", { table });
    const query = `
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position;
    `;
    
    const client = new Client({ connectionString });
    try {
      await client.connect();
      const result = await client.query(query, [table]);
      
      if (result.rows.length === 0) {
        return ok(`Table '${table}' not found or has no columns.`);
      }
      
      log.debug("Table schema retrieved", { table, columnCount: result.rows.length });
      
      const lines = result.rows.map(r => {
        const type = r.data_type + (r.character_maximum_length ? `(${r.character_maximum_length})` : '');
        const nullable = r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const def = r.column_default ? ` DEFAULT ${r.column_default}` : '';
        return `  ${r.column_name.padEnd(20)} ${type.padEnd(20)} ${nullable}${def}`;
      });
      
      return ok(`Table: ${table}\n${"─".repeat(50)}\n${lines.join("\n")}`);
    } catch (e) {
      log.error("Failed to describe table", { error: (e as Error).message });
      return ok(`Error describing table: ${(e as Error).message}`);
    } finally {
      await client.end().catch(() => {});
    }
  },
};
