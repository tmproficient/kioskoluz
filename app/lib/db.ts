import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { generateBarcodeCandidate } from "./barcode";
import type { DashboardData, Product } from "./types";

const connectionString = process.env.DATABASE_URL;
let sqlInstance: ReturnType<typeof postgres> | null = null;

function getSql() {
  if (sqlInstance) return sqlInstance;
  if (!connectionString) throw new Error("DATABASE_URL no configurada");
  sqlInstance = postgres(connectionString, {
    prepare: false,
    ssl: "require"
  });
  return sqlInstance;
}

export async function initSchema() {
  const sql = getSql();
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      price NUMERIC(12,2) NOT NULL CHECK(price >= 0),
      stock INTEGER NOT NULL CHECK(stock >= 0),
      barcode TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS sales (
      id UUID PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      total NUMERIC(12,2) NOT NULL CHECK(total >= 0),
      payment_method TEXT NOT NULL DEFAULT 'CASH' CHECK(payment_method IN ('CASH','MERCADO_PAGO'))
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id UUID PRIMARY KEY,
      sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id),
      qty INTEGER NOT NULL CHECK(qty > 0),
      unit_price NUMERIC(12,2) NOT NULL CHECK(unit_price >= 0),
      line_total NUMERIC(12,2) NOT NULL CHECK(line_total >= 0)
    );

    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
  `);
}

export async function seedDemoData() {
  const sql = getSql();
  const [{ count }] = await sql<{ count: string }[]>`SELECT COUNT(*)::text as count FROM products`;
  if (Number(count) > 0) return;

  const demo = [
    { name: "Coca Cola 500ml", price: 1800, stock: 12 },
    { name: "Papas Clasicas 100g", price: 2200, stock: 7 },
    { name: "Chocolate Barra", price: 1500, stock: 3 },
    { name: "Agua Sin Gas 600ml", price: 1200, stock: 15 },
    { name: "Galletas Vainilla", price: 2000, stock: 2 },
    { name: "Caramelos Menta x10", price: 1000, stock: 20 }
  ];

  for (const item of demo) {
    await createProduct(item);
  }
}

export async function listProducts(): Promise<Product[]> {
  const sql = getSql();
  return sql<Product[]>`
    SELECT id::text, name, price::float8 as price, stock, barcode, created_at::text, updated_at::text
    FROM products ORDER BY created_at DESC
  `;
}

export async function listLowStockProducts(threshold = 3): Promise<Product[]> {
  const sql = getSql();
  return sql<Product[]>`
    SELECT id::text, name, price::float8 as price, stock, barcode, created_at::text, updated_at::text
    FROM products WHERE stock <= ${threshold}
    ORDER BY stock ASC, name ASC
  `;
}

export async function findProductByBarcode(barcode: string): Promise<Product | null> {
  const sql = getSql();
  const rows = await sql<Product[]>`
    SELECT id::text, name, price::float8 as price, stock, barcode, created_at::text, updated_at::text
    FROM products WHERE barcode = ${barcode} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createProduct(input: {
  name: string;
  price: number;
  stock: number;
  barcode?: string;
}) {
  const sql = getSql();
  const barcode = input.barcode?.trim() || (await generateUniqueBarcode());
  const id = randomUUID();

  const rows = await sql<Product[]>`
    INSERT INTO products (id, name, price, stock, barcode, created_at, updated_at)
    VALUES (${id}::uuid, ${input.name.trim()}, ${input.price}, ${input.stock}, ${barcode}, now(), now())
    RETURNING id::text, name, price::float8 as price, stock, barcode, created_at::text, updated_at::text
  `;

  return rows[0];
}

export async function updateProduct(
  id: string,
  input: { name: string; price: number; stock: number; barcode?: string }
) {
  const sql = getSql();
  const barcode = input.barcode?.trim() || (await generateUniqueBarcode());

  const rows = await sql<Product[]>`
    UPDATE products
    SET name = ${input.name.trim()},
        price = ${input.price},
        stock = ${input.stock},
        barcode = ${barcode},
        updated_at = now()
    WHERE id = ${id}::uuid
    RETURNING id::text, name, price::float8 as price, stock, barcode, created_at::text, updated_at::text
  `;

  if (!rows[0]) throw new Error("Producto no encontrado");
  return rows[0];
}

export async function deleteProduct(id: string) {
  const sql = getSql();
  const used = await sql<{ found: number }[]>`
    SELECT 1 as found FROM sale_items WHERE product_id = ${id}::uuid LIMIT 1
  `;
  if (used.length) {
    throw new Error("No se puede eliminar un producto con ventas asociadas");
  }

  await sql`DELETE FROM products WHERE id = ${id}::uuid`;
}

export async function checkoutSale(payload: {
  items: { productId: string; qty: number }[];
  paymentMethod: "CASH" | "MERCADO_PAGO";
}) {
  const sql = getSql();
  const grouped = new Map<string, number>();
  for (const item of payload.items) {
    grouped.set(item.productId, (grouped.get(item.productId) ?? 0) + item.qty);
  }

  const saleId = randomUUID();

  const result = await sql.begin(async (tx) => {
    let total = 0;

    for (const [productId, qty] of grouped.entries()) {
      const products = await tx.unsafe<{ id: string; stock: number; price: number }[]>(
        `SELECT id::text as id, stock, price::float8 as price
         FROM products
         WHERE id = $1::uuid
         FOR UPDATE`,
        [productId]
      );

      const product = products[0];
      if (!product) throw new Error("Producto no encontrado");
      if (product.stock < qty) throw new Error(`Stock insuficiente para ${productId}`);

      const lineTotal = round2(product.price * qty);
      total += lineTotal;

      await tx.unsafe(
        `UPDATE products SET stock = stock - $1, updated_at = now()
         WHERE id = $2::uuid`,
        [qty, productId]
      );

      await tx.unsafe(
        `INSERT INTO sale_items (id, sale_id, product_id, qty, unit_price, line_total)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)`,
        [randomUUID(), saleId, productId, qty, product.price, lineTotal]
      );
    }

    total = round2(total);

    await tx.unsafe(
      `INSERT INTO sales (id, created_at, total, payment_method)
       VALUES ($1::uuid, now(), $2, $3)`,
      [saleId, total, payload.paymentMethod]
    );

    return { saleId, total };
  });

  return result;
}

export async function getDashboardData(): Promise<DashboardData> {
  const sql = getSql();
  const soldToday = await scalar(`
    SELECT COALESCE(SUM(total),0)::float8 as value
    FROM sales
    WHERE (created_at AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date
  `);

  const soldWeek = await scalar(`
    SELECT COALESCE(SUM(total),0)::float8 as value
    FROM sales
    WHERE created_at >= now() - interval '7 day'
  `);

  const soldMonth = await scalar(`
    SELECT COALESCE(SUM(total),0)::float8 as value
    FROM sales
    WHERE date_trunc('month', created_at AT TIME ZONE 'America/Bogota')
      = date_trunc('month', now() AT TIME ZONE 'America/Bogota')
  `);

  const salesCountToday = await scalar(`
    SELECT COUNT(*)::float8 as value
    FROM sales
    WHERE (created_at AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date
  `);

  const ticketAverageToday = salesCountToday > 0 ? round2(soldToday / salesCountToday) : 0;

  const topProducts = await sql<DashboardData["topProducts"]>`
    SELECT
      si.product_id::text as product_id,
      p.name,
      SUM(si.qty)::int as qty_sold,
      SUM(si.line_total)::float8 as total_sold
    FROM sale_items si
    INNER JOIN products p ON p.id = si.product_id
    GROUP BY si.product_id, p.name
    ORDER BY qty_sold DESC, total_sold DESC
    LIMIT 10
  `;

  const recentSales = await sql<DashboardData["recentSales"]>`
    SELECT
      s.id::text as id,
      s.created_at::text as created_at,
      s.total::float8 as total,
      COUNT(si.id)::int as items_count,
      s.payment_method
    FROM sales s
    LEFT JOIN sale_items si ON si.sale_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT 10
  `;

  return {
    kpis: {
      soldToday: round2(soldToday),
      soldWeek: round2(soldWeek),
      soldMonth: round2(soldMonth),
      salesCountToday: Math.trunc(salesCountToday),
      ticketAverageToday
    },
    topProducts,
    recentSales,
    lowStockProducts: await listLowStockProducts(3)
  };
}

async function scalar(sqlText: string) {
  const sql = getSql();
  const rows = await sql.unsafe<{ value: number }[]>(sqlText);
  return Number(rows[0]?.value ?? 0);
}

async function generateUniqueBarcode() {
  const sql = getSql();
  for (let tries = 0; tries < 50; tries += 1) {
    const barcode = generateBarcodeCandidate();
    const found = await sql<{ id: string }[]>`
      SELECT id::text as id FROM products WHERE barcode = ${barcode} LIMIT 1
    `;
    if (found.length === 0) return barcode;
  }
  throw new Error("No se pudo generar barcode unico");
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function closeDb() {
  if (!sqlInstance) return;
  await sqlInstance.end();
  sqlInstance = null;
}
