import { closeDb, initSchema, seedDemoData } from "../app/lib/db";

async function run() {
  await initSchema();
  await seedDemoData();
  await closeDb();
  console.log("Seed completado");
}

run().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
