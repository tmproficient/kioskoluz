"use client";

import { useState } from "react";

export default function UsersPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "seller">("seller");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        role
      })
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "No se pudo crear usuario");
      setLoading(false);
      return;
    }

    setMessage(`Usuario creado: ${json.user.email}`);
    setEmail("");
    setPassword("");
    setFullName("");
    setRole("seller");
    setLoading(false);
  };

  return (
    <section style={{ maxWidth: 560, display: "grid", gap: 16 }}>
      <h2>Gestion de usuarios</h2>
      <form className="card form-grid" onSubmit={createUser}>
        <label>
          Nombre completo
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          Rol
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "seller")}>
            <option value="seller">seller</option>
            <option value="admin">admin</option>
          </select>
        </label>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p>{message}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? "Creando..." : "Crear usuario"}
        </button>
      </form>
    </section>
  );
}

