"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/app/lib/format";

type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "seller";
  created_at: string;
  last_sign_in_at: string | null;
};

type EditMap = Record<string, { full_name: string; role: "admin" | "seller" }>;

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [edits, setEdits] = useState<EditMap>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "seller">("seller");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadUsers = async () => {
    const res = await fetch("/api/admin/users");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudieron cargar usuarios");
    setUsers(json);
    const nextEdits: EditMap = {};
    for (const u of json as AdminUser[]) {
      nextEdits[u.id] = { full_name: u.full_name ?? "", role: u.role };
    }
    setEdits(nextEdits);
  };

  useEffect(() => {
    void loadUsers().catch((e) => setError(e.message));
  }, []);

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

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

    setEmail("");
    setPassword("");
    setFullName("");
    setRole("seller");
    setMessage("Usuario creado correctamente");
    await loadUsers();
    setLoading(false);
  };

  const updateUser = async (id: string) => {
    const row = edits[id];
    if (!row) return;
    setError("");
    setMessage("");

    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row)
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "No se pudo actualizar");
      return;
    }
    setMessage("Usuario actualizado");
    await loadUsers();
  };

  const deleteUser = async (id: string) => {
    if (!window.confirm("Eliminar usuario? Esta accion es irreversible.")) return;
    setError("");
    setMessage("");

    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "No se pudo eliminar");
      return;
    }
    setMessage("Usuario eliminado");
    await loadUsers();
  };

  const totals = useMemo(() => {
    const adminCount = users.filter((u) => u.role === "admin").length;
    const sellerCount = users.length - adminCount;
    return { adminCount, sellerCount, total: users.length };
  }, [users]);

  return (
    <section className="panel">
      <div className="page-head">
        <h2>Gestion de usuarios</h2>
        <p>Administra accesos y roles del sistema.</p>
      </div>

      <div className="kpis-grid">
        <article className="card kpi-mini">
          <h4>Total usuarios</h4>
          <strong>{totals.total}</strong>
        </article>
        <article className="card kpi-mini">
          <h4>Admins</h4>
          <strong>{totals.adminCount}</strong>
        </article>
        <article className="card kpi-mini">
          <h4>Sellers</h4>
          <strong>{totals.sellerCount}</strong>
        </article>
      </div>

      {error ? <p className="card error">{error}</p> : null}
      {message ? <p className="card success">{message}</p> : null}

      <div className="users-layout">
        <form className="card form-grid" onSubmit={createUser}>
          <h3>Crear usuario</h3>
          <label>
            Nombre completo
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
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
          <button type="submit" disabled={loading}>
            {loading ? "Creando..." : "Crear usuario"}
          </button>
        </form>

        <div className="card">
          <h3>Usuarios existentes</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Alta</th>
                <th>Ultimo acceso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6}>Sin usuarios</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <input
                        value={edits[u.id]?.full_name ?? ""}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [u.id]: { ...prev[u.id], full_name: e.target.value }
                          }))
                        }
                      />
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <div className="role-cell">
                        <span className={`role-badge ${u.role === "admin" ? "role-admin" : "role-seller"}`}>
                          {u.role}
                        </span>
                        <select
                          value={edits[u.id]?.role ?? u.role}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [u.id]: { ...prev[u.id], role: e.target.value as "admin" | "seller" }
                            }))
                          }
                        >
                          <option value="seller">seller</option>
                          <option value="admin">admin</option>
                        </select>
                      </div>
                    </td>
                    <td>{formatDateTime(u.created_at)}</td>
                    <td>{u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : "-"}</td>
                    <td>
                      <div className="inline-actions">
                        <button className="small secondary" onClick={() => void updateUser(u.id)}>
                          Guardar
                        </button>
                        <button className="small danger" onClick={() => void deleteUser(u.id)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

