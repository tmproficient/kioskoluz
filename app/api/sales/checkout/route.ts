import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok } from "@/app/lib/http";
import { checkoutSchema } from "@/app/lib/validation";

export async function POST(request: NextRequest) {
  let step:
    | "auth"
    | "insert_sale"
    | "insert_items"
    | "update_stock"
    | "calculate_total"
    | "update_total" = "auth";
  let saleId: string | null = null;

  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return Response.json(
        {
          statusCode: 401,
          code: "NO_TOKEN",
          message: "Falta Authorization: Bearer <access_token>",
          step
        },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return Response.json(
        {
          statusCode: 500,
          code: "ENV_MISSING",
          message: "Faltan variables NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY",
          step
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return Response.json(
        {
          statusCode: 401,
          code: userError?.code ?? "INVALID_TOKEN",
          message: "Token invalido o expirado",
          details: userError?.message ?? null,
          step
        },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw decorateError(profileError ?? new Error("Perfil no encontrado"), step);
    }

    if (profile.role !== "admin" && profile.role !== "seller") {
      return Response.json(
        {
          statusCode: 403,
          code: "ROLE_BLOCKED",
          message: "Rol sin permisos para registrar ventas",
          step
        },
        { status: 403 }
      );
    }

    const payload = await request.json();
    const totalRecibido = Number(payload?.total ?? 0);
    const parsed = checkoutSchema.parse(payload);
    const grouped = new Map<string, number>();
    for (const item of parsed.items) {
      grouped.set(item.productId, (grouped.get(item.productId) ?? 0) + item.qty);
    }

    step = "insert_sale";
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        total: 0,
        payment_method: parsed.paymentMethod,
        created_by: user.id
      })
      .select("id")
      .single();
    if (saleError || !sale?.id) {
      throw decorateError(saleError ?? new Error("No se pudo crear la venta"), step);
    }
    saleId = sale.id as string;

    const insertRows: Array<{
      sale_id: string;
      product_id: string;
      qty: number;
      unit_price: number;
      line_total: number;
    }> = [];

    for (const [productId, qty] of grouped.entries()) {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id, price, stock")
        .eq("id", productId)
        .single();
      if (productError || !product) {
        throw decorateError(productError ?? new Error("Producto no encontrado"), "insert_items");
      }

      if ((product.stock ?? 0) < qty) {
        return Response.json(
          {
            statusCode: 400,
            code: "STOCK_INSUFICIENTE",
            message: `Stock insuficiente para producto ${productId}`,
            details: `stock=${product.stock} qty=${qty}`,
            step: "update_stock"
          },
          { status: 400 }
        );
      }

      step = "update_stock";
      const { error: stockError } = await supabase
        .from("products")
        .update({ stock: product.stock - qty })
        .eq("id", productId);
      if (stockError) {
        throw decorateError(stockError, step);
      }

      const unitPrice = Number(product.price ?? 0);
      const lineTotal = round2(unitPrice * qty);
      insertRows.push({
        sale_id: saleId,
        product_id: productId,
        qty,
        unit_price: unitPrice,
        line_total: lineTotal
      });
    }

    step = "insert_items";
    const { error: itemsError } = await supabase.from("sale_items").insert(insertRows);
    if (itemsError) {
      throw decorateError(itemsError, step);
    }

    step = "calculate_total";
    const { data: totalsData, error: totalsError } = await supabase
      .from("sale_items")
      .select("line_total, qty, unit_price")
      .eq("sale_id", saleId);
    if (totalsError) {
      throw decorateError(totalsError, step);
    }

    const itemsCount = totalsData?.length ?? 0;
    const totalCalculado = round2(
      (totalsData ?? []).reduce((acc, row) => {
        const lineTotal = Number(row.line_total ?? 0);
        if (lineTotal > 0) return acc + lineTotal;
        return acc + Number(row.qty ?? 0) * Number(row.unit_price ?? 0);
      }, 0)
    );

    if (itemsCount > 0 && totalCalculado <= 0) {
      throw {
        statusCode: 500,
        code: "TOTAL_ZERO_WITH_ITEMS",
        message: "Total calculado en 0 con items cargados",
        details: `saleId=${saleId} items=${itemsCount}`,
        step
      };
    }

    step = "update_total";
    const { error: totalError } = await supabase
      .from("sales")
      .update({ total: totalCalculado })
      .eq("id", saleId);
    if (totalError) {
      throw decorateError(totalError, step);
    }

    const { data: savedSale, error: savedSaleError } = await supabase
      .from("sales")
      .select("total")
      .eq("id", saleId)
      .single();
    if (savedSaleError) {
      throw decorateError(savedSaleError, step);
    }

    const totalGuardado = round2(Number(savedSale?.total ?? 0));
    console.info("[checkout_totales]", {
      saleId,
      paymentMethod: parsed.paymentMethod,
      totalRecibido,
      totalCalculado,
      totalGuardado,
      itemsCount,
      at: new Date().toISOString()
    });

    if (itemsCount > 0 && totalGuardado <= 0) {
      throw {
        statusCode: 500,
        code: "TOTAL_NOT_SAVED",
        message: "La venta tiene items pero el total guardado quedo en 0",
        details: `saleId=${saleId} items=${itemsCount} totalGuardado=${totalGuardado}`,
        step: "update_total"
      };
    }

    return ok({ saleId, total: totalGuardado }, 201);
  } catch (rawError) {
    const error = rawError as any;
    const isRls =
      error?.code === "42501" ||
      String(error?.message ?? "").toLowerCase().includes("row-level security");
    const statusCode = isRls
      ? 403
      : error?.statusCode
      ? Number(error.statusCode)
      : 400;

    const payload = {
      statusCode,
      code: error?.code ?? null,
      message: isRls ? "RLS blocked" : error?.message ?? "Error inesperado",
      hint: error?.hint ?? null,
      details: error?.details ?? null,
      step: error?.step ?? step
    };

    console.error("[checkout_error]", {
      ...payload,
      stack: error?.stack ?? null,
      at: new Date().toISOString()
    });

    const strictProduction =
      process.env.NODE_ENV === "production" &&
      process.env.STRICT_ERROR_RESPONSES === "true";

    if (strictProduction) {
      return Response.json(
        {
          statusCode,
          code: payload.code,
          message: isRls ? "RLS blocked" : "Error inesperado",
          step: payload.step
        },
        { status: statusCode }
      );
    }

    return Response.json(payload, { status: statusCode });
  }
}

function decorateError(error: any, step: string) {
  return {
    statusCode: 400,
    code: error?.code ?? null,
    message: error?.message ?? "Error inesperado",
    hint: error?.hint ?? null,
    details: error?.details ?? null,
    step
  };
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
