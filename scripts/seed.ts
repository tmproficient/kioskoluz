import { generateBarcodeCandidate } from "../app/lib/barcode";
import { getServiceSupabase } from "../app/lib/supabase/service";

async function run() {
  const serviceSupabase = getServiceSupabase();
  const { count } = await serviceSupabase
    .from("products")
    .select("id", { head: true, count: "exact" });

  if ((count ?? 0) === 0) {
    const demo = [
      { name: "Coca Cola 500ml", price: 1800, stock: 12 },
      { name: "Papas Clasicas 100g", price: 2200, stock: 7 },
      { name: "Chocolate Barra", price: 1500, stock: 3 },
      { name: "Agua Sin Gas 600ml", price: 1200, stock: 15 },
      { name: "Galletas Vainilla", price: 2000, stock: 2 },
      { name: "Caramelos Menta x10", price: 1000, stock: 20 }
    ];

    const payload = demo.map((item) => ({
      ...item,
      barcode: generateBarcodeCandidate()
    }));
    const { error } = await (serviceSupabase.from("products") as any).insert(payload);
    if (error) throw error;
  }

  console.log("Seed completado");
}

run().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
