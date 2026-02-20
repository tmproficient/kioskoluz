import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  price: z.number().nonnegative("Precio invalido"),
  stock: z.number().int("Stock invalido").nonnegative("Stock invalido"),
  barcode: z.string().trim().optional()
});

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().int().positive()
      })
    )
    .min(1),
  paymentMethod: z.enum(["CASH", "MERCADO_PAGO"]).default("CASH")
});