"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

type Props = {
  value: string;
  height?: number;
  width?: number;
  displayValue?: boolean;
};

export function BarcodeSvg({ value, height = 36, width = 1.6, displayValue = false }: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, value, {
      format: "CODE128",
      lineColor: "#111",
      width,
      height,
      displayValue
    });
  }, [value, height, width, displayValue]);

  return <svg ref={ref} />;
}