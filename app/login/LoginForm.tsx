"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { internalEmailFromUsername } from "@/app/lib/identity";
import { getBrowserSupabase } from "@/app/lib/supabase/browser";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/sale";
  const supabase = getBrowserSupabase();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const email = internalEmailFromUsername(username);
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    router.replace(next);
    router.refresh();
  };

  return (
    <section style={{ maxWidth: 420, margin: "30px auto" }}>
      <div className="card form-grid">
        <h2>Ingresar</h2>
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Usuario
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      </div>
    </section>
  );
}
