declare module "jsbarcode" {
  type Options = {
    format?: string;
    lineColor?: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
  };

  export default function JsBarcode(
    element: SVGElement | HTMLCanvasElement,
    text: string,
    options?: Options
  ): void;
}