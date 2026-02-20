"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { BarcodeSvg } from "@/app/components/BarcodeSvg";
import { formatCurrency } from "@/app/lib/format";

const PRINT_STORAGE_KEY = "kiosko_print_labels_payload";

type PrintPayload = {
  config: {
    columns: number;
    gapMm: number;
    labelWidthMm: number;
    labelHeightMm: number;
  };
  items: Array<{ id: string; name: string; price: number; barcode: string }>;
};

export default function PrintLabelsPage() {
  const [payload, setPayload] = useState<PrintPayload | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(PRINT_STORAGE_KEY);
    if (!raw) return;
    try {
      setPayload(JSON.parse(raw) as PrintPayload);
    } catch {
      setPayload(null);
    }
  }, []);

  if (!payload || !payload.items.length) {
    return (
      <div className="card">
        <p>No hay datos para imprimir.</p>
        <Link href="/labels">Volver</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="print-toolbar no-print">
        <button onClick={() => window.print()}>Imprimir</button>
        <Link href="/labels">Volver</Link>
      </div>
      <div
        className="labels-grid"
        style={
          {
            ["--columns" as string]: payload.config.columns,
            ["--gap-mm" as string]: `${payload.config.gapMm}mm`,
            ["--label-width-mm" as string]: `${payload.config.labelWidthMm}mm`,
            ["--label-height-mm" as string]: `${payload.config.labelHeightMm}mm`
          } as CSSProperties
        }
      >
        {payload.items.map((item, idx) => (
          <article className="label-card" key={`${item.id}-${idx}`}>
            <strong className="name">{item.name}</strong>
            <span className="price">{formatCurrency(item.price)}</span>
            <BarcodeSvg value={item.barcode} height={28} width={1.35} />
            <span className="code">{item.barcode}</span>
          </article>
        ))}
      </div>
    </div>
  );
}
