"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/app/lib/types";

const PRINT_STORAGE_KEY = "kiosko_print_labels_payload";

export default function LabelsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});
  const [columns, setColumns] = useState(3);
  const [gapMm, setGapMm] = useState(3);
  const [labelWidthMm, setLabelWidthMm] = useState(63);
  const [labelHeightMm, setLabelHeightMm] = useState(38);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/products")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error cargando productos");
        return data;
      })
      .then(setProducts)
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(term) || p.barcode.toLowerCase().includes(term)
    );
  }, [products, search]);

  const selectedCount = Object.values(selectedQty).reduce((acc, n) => acc + n, 0);

  const generate = () => {
    const items: Array<{ id: string; name: string; price: number; barcode: string }> = [];
    for (const product of products) {
      const qty = selectedQty[product.id] ?? 0;
      for (let i = 0; i < qty; i += 1) {
        items.push({
          id: product.id,
          name: product.name,
          price: product.price,
          barcode: product.barcode
        });
      }
    }

    if (!items.length) {
      setError("Selecciona al menos una etiqueta");
      return;
    }

    localStorage.setItem(
      PRINT_STORAGE_KEY,
      JSON.stringify({
        config: { columns, gapMm, labelWidthMm, labelHeightMm },
        items
      })
    );
    window.open("/labels/print", "_blank");
  };

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <h2>Etiquetas</h2>
      <div className="card form-grid">
        <label>
          Buscar
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          Columnas
          <input type="number" min={1} max={6} value={columns} onChange={(e) => setColumns(Number(e.target.value))} />
        </label>
        <label>
          Ancho (mm)
          <input type="number" min={20} max={100} value={labelWidthMm} onChange={(e) => setLabelWidthMm(Number(e.target.value))} />
        </label>
        <label>
          Alto (mm)
          <input type="number" min={15} max={80} value={labelHeightMm} onChange={(e) => setLabelHeightMm(Number(e.target.value))} />
        </label>
        <label>
          Separacion (mm)
          <input type="number" min={0} max={20} value={gapMm} onChange={(e) => setGapMm(Number(e.target.value))} />
        </label>
        <div className="actions">
          <button onClick={generate}>Generar e imprimir ({selectedCount})</button>
        </div>
      </div>

      {error ? <p className="card error">{error}</p> : null}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Barcode</th>
              <th>Cantidad etiquetas</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.barcode}</td>
                <td>
                  <input
                    className="qty-input"
                    type="number"
                    min={0}
                    value={selectedQty[product.id] ?? 0}
                    onChange={(e) =>
                      setSelectedQty((s) => ({
                        ...s,
                        [product.id]: Math.max(0, Number(e.target.value) || 0)
                      }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

