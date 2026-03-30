/**
 * Simple migration runner — reads SQL files in order and executes them.
 * Run with: npx ts-node src/db/migrate.ts
 */
import fs from "fs";
import path from "path";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Create migrations tracking table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      filename   TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied = await pool
    .query<{ filename: string }>("SELECT filename FROM _migrations ORDER BY id")
    .then((r) => new Set(r.rows.map((row) => row.filename)));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] Skipping ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

    console.log(`[migrate] Applying ${file}...`);
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO _migrations (filename) VALUES ($1)", [file]);
      await pool.query("COMMIT");
      console.log(`[migrate] ✓ ${file}`);
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error(`[migrate] ✗ ${file} failed:`, err);
      process.exit(1);
    }
  }

  await pool.end();
  console.log("[migrate] Done.");
}

run();
