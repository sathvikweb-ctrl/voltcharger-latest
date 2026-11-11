"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin")
      .then(async (res) => {
        if (!res.ok) throw new Error("Please sign in as an admin.");
        return res.json();
      })
      .then((payload) => setData(payload))
      .catch((err) => setError(err.message || "Unable to load admin dashboard."));
  }, []);

  const stats = data?.stats ?? { customers: 0, hosts: 0, pending: 0, approved: 0, bookings: 0 };
  const pendingChargers = data?.chargers?.filter((charger: any) => charger.status === "pending") ?? [];

  return (
    <main className="section">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="kicker">Admin dashboard</div>
            <h2>Marketplace operations</h2>
          </div>
        </div>

        {error ? <div className="error">{error} <Link href="/login">Admin sign-in</Link></div> : null}

        <div className="grid-5" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 14 }}>
          <div className="card"><div className="muted">Customers</div><div className="stat">{stats.customers}</div></div>
          <div className="card"><div className="muted">Hosts</div><div className="stat">{stats.hosts}</div></div>
          <div className="card"><div className="muted">Pending</div><div className="stat">{stats.pending}</div></div>
          <div className="card"><div className="muted">Approved</div><div className="stat">{stats.approved}</div></div>
          <div className="card"><div className="muted">Bookings</div><div className="stat">{stats.bookings}</div></div>
        </div>

        <div className="grid-2" style={{ marginTop: 18 }}>
          <div className="card">
            <h3>Pending charger reviews</h3>
            {pendingChargers.length ? <ul>{pendingChargers.map((charger: any) => <li key={charger.id} className="muted">{charger.manufacturer} {charger.model} — Pending review</li>)}</ul> : <p className="muted">No pending charger applications.</p>}
          </div>
          <div className="card">
            <h3>Platform controls</h3>
            <ul>
              <li className="muted">Official pricing table</li>
              <li className="muted">Commission settings</li>
              <li className="muted">Booking moderation</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
