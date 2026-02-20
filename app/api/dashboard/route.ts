import { requireAuthProfile } from "@/app/lib/auth";
import { ok } from "@/app/lib/http";
import { getServerSupabase } from "@/app/lib/supabase/server";

export async function GET() {
  let step: "auth" | "rpc_dashboard" | "fallback_dashboard" = "auth";
  try {
    await requireAuthProfile("admin");
    const supabase = await getServerSupabase();

    step = "rpc_dashboard";
    const { data, error } = await supabase.rpc("get_dashboard_data");
    if (!error && data) {
      return ok(data);
    }

    const rpcCode = (error as { code?: string } | null)?.code ?? "";
    const rpcMessage = ((error as { message?: string } | null)?.message ?? "").toLowerCase();
    const rpcMissing =
      rpcCode === "42883" ||
      rpcCode === "PGRST202" ||
      rpcMessage.includes("function") ||
      rpcMessage.includes("get_dashboard_data");
    if (!rpcMissing) {
      throw decorateError(error ?? new Error("Fallo RPC dashboard"), step, 500);
    }

    step = "fallback_dashboard";
    const dashboard = await buildDashboardFallback(supabase);
    return ok(dashboard);
  } catch (rawError) {
    const error = rawError as {
      code?: string;
      message?: string;
      hint?: string;
      details?: string;
      statusCode?: number;
      step?: string;
    };
    const message = error.message ?? "Error inesperado";
    const statusCode =
      message === "UNAUTHORIZED"
        ? 401
        : message === "FORBIDDEN"
        ? 403
        : Number(error.statusCode ?? 500);
    const payload = {
      statusCode,
      code: error.code ?? null,
      message:
        message === "UNAUTHORIZED"
          ? "No autenticado"
          : message === "FORBIDDEN"
          ? "Sin permisos para ver dashboard"
          : message,
      hint: error.hint ?? null,
      details: error.details ?? null,
      step: error.step ?? step
    };

    console.error("[dashboard_error]", {
      ...payload,
      at: new Date().toISOString()
    });

    return Response.json(payload, { status: statusCode });
  }
}

async function buildDashboardFallback(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>
) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select("id, created_at, total, payment_method")
    .order("created_at", { ascending: false });
  if (salesError) {
    throw decorateError(salesError, "fallback_dashboard", 500);
  }

  const { data: topItems, error: topError } = await supabase
    .from("sale_items")
    .select("sale_id, product_id, qty, line_total, products(name)");
  if (topError) {
    throw decorateError(topError, "fallback_dashboard", 500);
  }

  const { data: lowStockProducts, error: lowStockError } = await supabase
    .from("products")
    .select("id, name, price, stock, barcode, created_at, updated_at")
    .lte("stock", 3)
    .order("stock", { ascending: true })
    .order("name", { ascending: true });
  if (lowStockError) {
    throw decorateError(lowStockError, "fallback_dashboard", 500);
  }

  const soldToday = sumSalesByRange(sales ?? [], todayStart, now);
  const soldWeek = sumSalesByRange(sales ?? [], weekStart, now);
  const soldMonth = sumSalesByRange(sales ?? [], monthStart, now);
  const salesToday = (sales ?? []).filter((sale) => {
    const createdAt = new Date(sale.created_at);
    return createdAt >= todayStart && createdAt <= now;
  });
  const salesCountToday = salesToday.length;
  const ticketAverageToday =
    salesCountToday > 0 ? round2(soldToday / salesCountToday) : 0;

  const groupedProducts = new Map<
    string,
    { product_id: string; name: string; qty_sold: number; total_sold: number }
  >();
  for (const row of topItems ?? []) {
    const current = groupedProducts.get(row.product_id) ?? {
      product_id: row.product_id,
      name: getProductName(row.products),
      qty_sold: 0,
      total_sold: 0
    };
    current.qty_sold += Number(row.qty ?? 0);
    current.total_sold = round2(current.total_sold + Number(row.line_total ?? 0));
    groupedProducts.set(row.product_id, current);
  }

  const topProducts = Array.from(groupedProducts.values())
    .sort((a, b) => {
      if (b.qty_sold !== a.qty_sold) return b.qty_sold - a.qty_sold;
      return b.total_sold - a.total_sold;
    })
    .slice(0, 10);

  const recentSales = (sales ?? []).slice(0, 10).map((sale) => ({
    id: sale.id,
    created_at: sale.created_at,
    total: Number(sale.total ?? 0),
    items_count: (topItems ?? []).reduce((acc, item) => {
      if (item.sale_id === sale.id) return acc + Number(item.qty ?? 0);
      return acc;
    }, 0),
    payment_method: sale.payment_method
  }));

  return {
    kpis: {
      soldToday: round2(soldToday),
      soldWeek: round2(soldWeek),
      soldMonth: round2(soldMonth),
      salesCountToday,
      ticketAverageToday
    },
    topProducts,
    recentSales,
    lowStockProducts: lowStockProducts ?? []
  };
}

function sumSalesByRange(
  sales: Array<{ created_at: string; total: number }>,
  start: Date,
  end: Date
) {
  return sales.reduce((acc, sale) => {
    const createdAt = new Date(sale.created_at);
    if (createdAt >= start && createdAt <= end) {
      return round2(acc + Number(sale.total ?? 0));
    }
    return acc;
  }, 0);
}

function decorateError(error: any, step: string, statusCode: number) {
  return {
    statusCode,
    code: error?.code ?? null,
    message: error?.message ?? "Error inesperado",
    hint: error?.hint ?? null,
    details: error?.details ?? null,
    step
  };
}

function getProductName(value: unknown) {
  if (!value || typeof value !== "object") return "Sin nombre";
  if (Array.isArray(value)) {
    const first = value[0] as { name?: string } | undefined;
    return first?.name ?? "Sin nombre";
  }
  const row = value as { name?: string };
  return row.name ?? "Sin nombre";
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
