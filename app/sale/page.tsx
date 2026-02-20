"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/app/lib/format";
import type { Product } from "@/app/lib/types";

type CartItem = {
  product: Product;
  qty: number;
};

export default function SalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [barcodeInput, setBarcodeInput] = useState("");
  const [manualProductId, setManualProductId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "MERCADO_PAGO">("CASH");
  const [error, setError] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);

  const loadProducts = async () => {
    const res = await fetch("/api/products");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error cargando productos");
    setProducts(json);
    if (json[0] && !manualProductId) setManualProductId(json[0].id);
  };

  useEffect(() => {
    void loadProducts().catch((e) => setError(e.message));
    scanInputRef.current?.focus();
  }, []);

  const cartItems = Object.values(cart);
  const total = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.product.price * item.qty, 0),
    [cartItems]
  );

  const addToCart = (product: Product) => {
    setError("");
    setCart((curr) => {
      const currentQty = curr[product.id]?.qty ?? 0;
      const nextQty = currentQty + 1;
      if (nextQty > product.stock) {
        setError(`Stock insuficiente para ${product.name}`);
        return curr;
      }
      return { ...curr, [product.id]: { product, qty: nextQty } };
    });
  };

  const handleBarcode = async () => {
    const code = barcodeInput.trim();
    if (!code) return;
    setBarcodeInput("");

    const existing = products.find((p) => p.barcode === code);
    if (existing) {
      addToCart(existing);
      return;
    }

    const res = await fetch(`/api/products/barcode/${encodeURIComponent(code)}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Error buscando barcode");
      return;
    }
    if (!json) {
      setError("Codigo no encontrado");
      return;
    }
    addToCart(json);
  };

  const updateQty = (productId: string, qty: number) => {
    setCart((curr) => {
      const item = curr[productId];
      if (!item) return curr;
      const safeQty = Math.max(1, Math.min(qty || 1, item.product.stock));
      return { ...curr, [productId]: { ...item, qty: safeQty } };
    });
  };

  const removeItem = (productId: string) => {
    setCart((curr) => {
      const next = { ...curr };
      delete next[productId];
      return next;
    });
  };

  const checkout = async () => {
    const items = Object.values(cart).map((c) => ({ productId: c.product.id, qty: c.qty }));
    if (!items.length) {
      setError("El carrito esta vacio");
      return;
    }

    const res = await fetch("/api/sales/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, paymentMethod })
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Error en cobro");
      return;
    }
    setCart({});
    await loadProducts();
    scanInputRef.current?.focus();
  };

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <h2>Venta rapida</h2>
      <div className="card">
        <div className="sale-entry">
          <label>
            Escanear / ingresar barcode
            <input
              ref={scanInputRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleBarcode();
                }
              }}
              placeholder="Escanea y Enter"
            />
          </label>
          <div className="manual-add">
            <select value={manualProductId} onChange={(e) => setManualProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.barcode})
                </option>
              ))}
            </select>
            <button
              className="secondary"
              onClick={() => {
                const product = products.find((p) => p.id === manualProductId);
                if (product) addToCart(product);
              }}
            >
              Agregar manual
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant.</th>
              <th>P. Unit</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cartItems.length === 0 ? (
              <tr>
                <td colSpan={5}>Sin items</td>
              </tr>
            ) : (
              cartItems.map(({ product, qty }) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>
                    <input
                      className="qty-input"
                      type="number"
                      min={1}
                      max={product.stock}
                      value={qty}
                      onChange={(e) => updateQty(product.id, Number(e.target.value))}
                    />
                  </td>
                  <td>{formatCurrency(product.price)}</td>
                  <td>{formatCurrency(product.price * qty)}</td>
                  <td>
                    <button className="small danger" onClick={() => removeItem(product.id)}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="checkout-footer">
          <label>
            Metodo de pago
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "MERCADO_PAGO")}
            >
              <option value="CASH">Efectivo</option>
              <option value="MERCADO_PAGO">Mercado Pago (Fase 2)</option>
            </select>
          </label>
          <strong>Total: {formatCurrency(total)}</strong>
          <button onClick={checkout}>Cobrar</button>
        </div>
      </div>
      {error ? <p className="card error">{error}</p> : null}
    </section>
  );
}

