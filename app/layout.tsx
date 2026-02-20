import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/app/components/AuthProvider";
import { TopNav } from "@/app/components/TopNav";

export const metadata: Metadata = {
  title: "Megakiosco Ohana",
  description: "Megakiosco Ohana: POS + inventario para kiosko en Render + Supabase"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <TopNav />
          <main className="container">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
