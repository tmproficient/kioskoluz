"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/components/AuthProvider";

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  if (pathname === "/login") return null;

  const links = [
    ...(user?.role === "admin" ? [{ href: "/dashboard", label: "Dashboard" }] : []),
    ...(user?.role === "admin" ? [{ href: "/sales", label: "Ventas" }] : []),
    { href: "/products", label: "Productos" },
    { href: "/labels", label: "Etiquetas" },
    { href: "/sale", label: "Venta rapida" },
    { href: "/alerts", label: "Stock bajo" },
    ...(user?.role === "admin" ? [{ href: "/users", label: "Usuarios" }] : [])
  ];

  return (
    <header className="topbar">
      <div className="brand">
        <h1>Megakiosco Ohana</h1>
        {user ? (
          <span className={`role-badge ${user.role === "admin" ? "role-admin" : "role-seller"}`}>
            {user.role}
          </span>
        ) : null}
      </div>
      <nav className="tabs">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}>
            {link.label}
          </Link>
        ))}
        {user ? <span className="user-pill">{user.fullName || user.email}</span> : null}
        {user ? (
          <button
            className="secondary"
            onClick={() => {
              void logout().then(() => router.replace("/login"));
            }}
          >
            Salir
          </button>
        ) : null}
      </nav>
    </header>
  );
}
