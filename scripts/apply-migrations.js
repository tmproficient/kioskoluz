/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("ERROR: missing env SUPABASE_DB_URL");
    console.error("Example:");
    console.error(
      "  SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres npm run db:init"
    );
    process.exit(1);
  }

  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "001_init.sql"
  );

  if (!fs.existsSync(migrationPath)) {
    console.error(`ERROR: migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, "utf8");
  if (!sql.trim()) {
    console.error("ERROR: migration file is empty");
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Connecting to Supabase Postgres...");
    await client.connect();
    console.log("Connected.");

    console.log("Applying migration: supabase/migrations/001_init.sql");
    await client.query(sql);
    console.log("Migration applied successfully.");

    const tables = await client.query(`
      select tablename
      from pg_tables
      where schemaname = 'public'
        and tablename in ('profiles', 'products', 'sales', 'sale_items')
      order by tablename;
    `);

    console.log("Validation - created tables:");
    for (const row of tables.rows) {
      console.log(` - ${row.tablename}`);
    }

    const missing = ["profiles", "products", "sales", "sale_items"].filter(
      (name) => !tables.rows.some((r) => r.tablename === name)
    );

    if (missing.length) {
      console.error(`ERROR: missing tables after migration: ${missing.join(", ")}`);
      process.exit(1);
    }

    console.log("db:init completed OK.");
  } catch (error) {
    console.error("Migration failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main();

