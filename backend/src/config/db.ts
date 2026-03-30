import { Pool } from "pg";

let pool: Pool;

export function getDB(): Pool {
  if (!pool) throw new Error("Database not connected. Call connectDB() first.");
  return pool;
}

export async function connectDB(): Promise<void> {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query("SELECT 1");
    console.log("[db] PostgreSQL connected");
  } catch (err) {
    console.error("[db] Connection failed:", err);
    throw err;
  }
}

export async function disconnectDB(): Promise<void> {
  await pool?.end();
}
