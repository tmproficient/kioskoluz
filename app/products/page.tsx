"use client";

import { useEffect, useState } from "react";
import { BarcodeSvg } from "@/app/components/BarcodeSvg";
import { formatCurrency } from "@/app/lib/format";
import type { Product } from "@/app/lib/types";

type FormState = {
  id?: string;
  name: string;
  price: number;
  stock: number;
  barcode?: string;
};

const initialForm: FormState = { name: "", price: 0, stock: 0, barcode: "" };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProducts = async () => {
    const res = await fetch("/api/products");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error cargando productos");
    setProducts(json);
  };

  useEffect(() => {
    void loadProducts().catch((e) => setError(e.message));
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        price: Number(form.price),
        stock: Number(form.stock),
        barcode: form.id ? form.barcode?.trim() : undefined
      };

      const res = await fetch(form.id ? `/api/products/${form.id}` : "/api/products", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo guardar");

      setForm(initialForm);
      await loadProducts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async (id: string) => {
    if (!window.confirm("Eliminar producto?")) return;
    setError("");
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "No se pudo eliminar");
      return;
    }
    await loadProducts();
  };

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <h2>Productos</h2>
      <div className="split-layout">
        <form className="card form-grid" onSubmit={onSubmit}>
          <h3>{form.id ? "Editar producto" : "Nuevo producto"}</h3>
          <label>
            Nombre
            <input
              required
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
          </label>
          <label>
            Precio
            <input
              type="number"
              min={0}
              required
              value={form.price}
              onChange={(e) => setForm((s) => ({ ...s, price: Number(e.target.value) }))}
            />
          </label>
          <label>
            Stock
            <input
              type="number"
              min={0}
              step={1}
              required
              value={form.stock}
              onChange={(e) => setForm((s) => ({ ...s, stock: Number(e.target.value) }))}
            />
          </label>
          {form.id ? (
            <label>
              Barcode
              <input
                required
                value={form.barcode}
                onChange={(e) => setForm((s) => ({ ...s, barcode: e.target.value }))}
              />
            </label>
          ) : (
            <p>El barcode se genera automaticamente al crear.</p>
          )}
          {error ? <p className="error">{error}</p> : null}
          <div className="actions">
            <button type="submit" disabled={saving}>
              {saving ? "Guardando..." : form.id ? "Actualizar" : "Crear"}
            </button>
            {form.id ? (
              <button type="button" className="secondary" onClick={() => setForm(initialForm)}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Barcode</th>
                <th>Vista</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6}>No hay productos</td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className={p.stock <= 3 ? "row-low-stock" : ""}>
                    <td>{p.name}</td>
                    <td>{formatCurrency(p.price)}</td>
                    <td>{p.stock}</td>
                    <td>{p.barcode}</td>
                    <td>
                      <BarcodeSvg value={p.barcode} />
                    </td>
                    <td>
                      <div className="inline-actions">
                        <button
                          className="small secondary"
                          onClick={() =>
                            setForm({
                              id: p.id,
                              name: p.name,
                              price: p.price,
                              stock: p.stock,
                              barcode: p.barcode
                            })
                          }
                        >
                          Editar
                        </button>
                        <button className="small danger" onClick={() => void removeProduct(p.id)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

