export type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode: string;
  created_at: string;
  updated_at: string;
};

export type Sale = {
  id: string;
  created_at: string;
  total: number;
  payment_method: "CASH" | "MERCADO_PAGO";
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

export type DashboardData = {
  kpis: {
    soldToday: number;
    soldWeek: number;
    soldMonth: number;
    salesCountToday: number;
    ticketAverageToday: number;
  };
  topProducts: {
    product_id: string;
    name: string;
    qty_sold: number;
    total_sold: number;
  }[];
  recentSales: {
    id: string;
    created_at: string;
    total: number;
    items_count: number;
    payment_method: "CASH" | "MERCADO_PAGO";
  }[];
  lowStockProducts: Product[];
};