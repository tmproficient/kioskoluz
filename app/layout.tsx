import "./globals.css";
import type { Metadata } from "next";
import { TopNav } from "@/app/components/TopNav";

export const metadata: Metadata = {
  title: "Kiosko POS Cloud",
  description: "POS + inventario para kiosko en Render + Supabase"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <TopNav />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}