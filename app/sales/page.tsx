"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDateTime } from "@/app/lib/format";

type SaleRow = {
  id: string;
  created_at: string;
  total: number;
  payment_method: "CASH" | "MERCADO_PAGO";
  created_by: string;
};

type SaleDetail = SaleRow & {
  items: Array<{
    id: string;
    qty: number;
    unit_price: number;
    line_total: number;
    product_id: string;
    products: { name: string; barcode: string } | null;
  }>;
};

export default function SalesPage() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [selected, setSelected] = useState<SaleDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/sales")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error cargando ventas");
        return json;
      })
      .then(setSales)
      .catch((e) => setError(e.message));
  }, []);

  const openDetail = async (id: string) => {
    const res = await fetch(`/api/sales/${id}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Error cargando detalle");
      return;
    }
    setSelected(json);
  };

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <h2>Ventas</h2>
      {error ? <p className="card error">{error}</p> : null}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Total</th>
              <th>Pago</th>
              <th>Vendedor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td colSpan={5}>Sin ventas</td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr key={sale.id}>
                  <td>{formatDateTime(sale.created_at)}</td>
                  <td>{formatCurrency(sale.total)}</td>
                  <td>{sale.payment_method === "CASH" ? "Efectivo" : "Mercado Pago"}</td>
                  <td>{sale.created_by}</td>
                  <td>
                    <button className="small secondary" onClick={() => void openDetail(sale.id)}>
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="card">
          <h3>Detalle venta</h3>
          <p>
            {formatDateTime(selected.created_at)} | Total: {formatCurrency(selected.total)}
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Barcode</th>
                <th>Cant.</th>
                <th>P. Unit</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {selected.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.products?.name ?? item.product_id}</td>
                  <td>{item.products?.barcode ?? "-"}</td>
                  <td>{item.qty}</td>
                  <td>{formatCurrency(item.unit_price)}</td>
                  <td>{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

