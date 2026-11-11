"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const previewAccounts = {
  customer: { email: "driver@voltcharger.test", password: "DriverDemo#2026" },
  admin: { email: "admin@voltcharger.test" },
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(previewAccounts.customer.email);
  const [password, setPassword] = useState(previewAccounts.customer.password);
  const [role, setRole] = useState<keyof typeof previewAccounts>("customer");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setStatus("Signing in...");
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(null);
      setError(data.error ?? "Unable to sign in.");
      return;
    }
    setStatus("Welcome back.");
    const nextPath = role === "admin" ? "/admin" : "/dashboard";
    router.push(nextPath);
    router.refresh();
  }

  function applyPreview(roleKey: keyof typeof previewAccounts) {
    const preview = previewAccounts[roleKey];
    setRole(roleKey);
    setEmail(preview.email);
    setPassword("password" in preview ? preview.password : "");
  }

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 620 }}>
        <div className="card">
          <div className="kicker">Welcome back</div>
          <h2>Login to VoltCharger</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0 20px" }}>
            {Object.keys(previewAccounts).map((key) => (
              <button key={key} type="button" className="btn btn-ghost btn-small" onClick={() => applyPreview(key as keyof typeof previewAccounts)}>
                {key === "admin" ? "Admin sign-in" : "Customer access"}
              </button>
            ))}
          </div>

          <div className="form-grid" style={{ marginBottom: 16 }}>
            <label className="field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          </div>

          {error ? <div className="error" style={{ marginBottom: 10 }}>{error}</div> : null}
          {status ? <div className="notice" style={{ marginBottom: 10 }}>{status}</div> : null}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={submit} type="button">Login</button>
            <Link className="btn btn-ghost" href="/">Back home</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
