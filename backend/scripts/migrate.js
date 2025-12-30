const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

async function ensureMigrationsTable(pool) {
  // This table tracks which migration files have already been applied
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getApplied(pool) {
  const r = await pool.query("SELECT version FROM schema_migrations");
  return new Set(r.rows.map((x) => x.version));
}

async function applyMigration(pool, filename) {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");

  // transaction = all-or-nothing safety
  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query("INSERT INTO schema_migrations(version) VALUES ($1)", [filename]);
    await pool.query("COMMIT");
    console.log(`✅ Applied: ${filename}`);
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(`❌ Failed: ${filename}`);
    throw err;
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL missing in backend/.env");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    await ensureMigrationsTable(pool);
    const applied = await getApplied(pool);

    // Apply migrations in filename order
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const f of files) {
      if (!applied.has(f)) {
        await applyMigration(pool, f);
      }
    }

    console.log("🎉 Migrations up to date");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
