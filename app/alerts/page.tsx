"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/app/lib/types";

export default function AlertsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/products/low-stock")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error cargando alertas");
        return json;
      })
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <h2>Stock bajo (&lt;= 3)</h2>
      {error ? <p className="card error">{error}</p> : null}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Stock</th>
              <th>Barcode</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3}>Sin alertas</td>
              </tr>
            ) : (
              items.map((p) => (
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

