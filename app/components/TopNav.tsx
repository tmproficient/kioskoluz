"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/products", label: "Productos" },
  { href: "/labels", label: "Etiquetas" },
  { href: "/sale", label: "Venta rapida" }
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="topbar">
      <h1>Kiosko POS Cloud</h1>
      <nav className="tabs">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}>
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}