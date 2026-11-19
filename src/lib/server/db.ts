import postgres, { type Sql } from "postgres";

type GlobalWithSql = typeof globalThis & { __alphaSql?: Sql };

const globalWithSql = globalThis as GlobalWithSql;

export function dataMode(): "demo" | "database" {
  return process.env.ALPHA_DATA_MODE === "database" && process.env.DATABASE_URL ? "database" : "demo";
}

export function getSql(): Sql | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || dataMode() !== "database") return null;
  if (!globalWithSql.__alphaSql) {
    globalWithSql.__alphaSql = postgres(connectionString, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return globalWithSql.__alphaSql;
}

export async function databaseHealth() {
  const sql = getSql();
  if (!sql) return { mode: "demo" as const, configured: false, healthy: true };
  try {
    await sql`select 1 as ok`;
    return { mode: "database" as const, configured: true, healthy: true };
  } catch (error) {
    return {
      mode: "database" as const,
      configured: true,
      healthy: false,
      error: error instanceof Error ? error.message : "Database check failed",
    };
  }
}
