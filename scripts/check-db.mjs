import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1).replace(/^"|"$/g, "");
    process.env[key] ??= value;
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Create .env.local from .env.example and set your PostgreSQL URL.");
  process.exit(1);
}

const requiredTables = ["users", "documents", "document_members", "document_operations", "document_versions"];
const connectionString = process.env.DATABASE_URL.replace("sslmode=require", "sslmode=verify-full");
const pool = new pg.Pool({
  connectionString,
  connectionTimeoutMillis: 5000
});

try {
  const version = await pool.query("select version()");
  console.log(`Connected: ${version.rows[0].version.split(",")[0]}`);

  const result = await pool.query(
    `select table_name
     from information_schema.tables
     where table_schema = 'public'
     and table_name = any($1)
     order by table_name`,
    [requiredTables]
  );

  const found = new Set(result.rows.map((row) => row.table_name));
  const missing = requiredTables.filter((table) => !found.has(table));

  if (missing.length > 0) {
    console.error(`Missing tables: ${missing.join(", ")}`);
    console.error("Run prisma/schema.sql in this database.");
    process.exit(1);
  }

  const counts = await Promise.all(
    requiredTables.map(async (table) => {
      const count = await pool.query(`select count(*)::int as count from ${table}`);
      return `${table}: ${count.rows[0].count}`;
    })
  );

  console.log("Tables OK");
  console.log(counts.join("\n"));
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message || error.name || "Database check failed.");
    if ("code" in error && error.code) {
      console.error(`Code: ${error.code}`);
    }
  } else {
    console.error("Database check failed.");
  }
  process.exit(1);
} finally {
  await pool.end();
}
