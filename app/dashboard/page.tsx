"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDateTime } from "@/app/lib/format";
import type { DashboardData } from "@/app/lib/types";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/dashboard")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Error cargando dashboard");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="card error">{error}</p>;
  if (!data) return <p className="card">Cargando dashboard...</p>;

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <h2>Dashboard</h2>
      <div className="kpis-grid">
        <article className="card">
          <h4>Vendido hoy</h4>
          <strong>{formatCurrency(data.kpis.soldToday)}</strong>
        </article>
        <article className="card">
          <h4>Vendido semana</h4>
          <strong>{formatCurrency(data.kpis.soldWeek)}</strong>
        </article>
        <article className="card">
          <h4>Vendido mes</h4>
          <strong>{formatCurrency(data.kpis.soldMonth)}</strong>
        </article>
        <article className="card">
          <h4>Ventas hoy</h4>
          <strong>{data.kpis.salesCountToday}</strong>
        </article>
        <article className="card">
          <h4>Ticket promedio</h4>
          <strong>{formatCurrency(data.kpis.ticketAverageToday)}</strong>
        </article>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <h3>Top productos</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Unidades</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.length === 0 ? (
                <tr>
                  <td colSpan={3}>Sin ventas</td>
                </tr>
              ) : (
                data.topProducts.map((row) => (
                  <tr key={row.product_id}>
                    <td>{row.name}</td>
                    <td>{row.qty_sold}</td>
                    <td>{formatCurrency(row.total_sold)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Ultimas ventas</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Items</th>
                <th>Total</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              {data.recentSales.length === 0 ? (
                <tr>
                  <td colSpan={4}>Sin ventas</td>
                </tr>
              ) : (
                data.recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{formatDateTime(sale.created_at)}</td>
                    <td>{sale.items_count}</td>
                    <td>{formatCurrency(sale.total)}</td>
                    <td>{sale.payment_method === "CASH" ? "Efectivo" : "Mercado Pago"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 style={{ color: "#b91c1c" }}>Stock bajo (&lt;= 3)</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Stock</th>
              <th>Barcode</th>
            </tr>
          </thead>
          <tbody>
            {data.lowStockProducts.length === 0 ? (
              <tr>
                <td colSpan={3}>Sin alertas</td>
              </tr>
            ) : (
              data.lowStockProducts.map((p) => (
                <tr key={p.id} className="row-low-stock">
                  <td>{p.name}</td>
                  <td>{p.stock}</td>
                  <td>{p.barcode}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

