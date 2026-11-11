"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function CustomerDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (res) => {
        if (!res.ok) throw new Error("Please sign in to view this dashboard.");
        return res.json();
      })
      .then((payload) => setData(payload))
      .catch((err) => setError(err.message || "Unable to load dashboard."));
  }, []);

  const upcoming = data?.bookings?.slice(0, 3) ?? [];

  return (
    <main className="section">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="kicker">Customer dashboard</div>
            <h2>My charging journey</h2>
          </div>
          <Link className="btn btn-ghost" href="/find">Book another charger</Link>
        </div>

        {error ? <div className="error">{error}</div> : null}

        <div className="grid-4">
          <div className="card"><div className="muted">Upcoming bookings</div><div className="stat">{data?.bookings?.length ?? 0}</div></div>
          <div className="card"><div className="muted">Completed sessions</div><div className="stat">{data?.bookings?.filter((b: any) => b.status === "completed").length ?? 0}</div></div>
          <div className="card"><div className="muted">Saved locations</div><div className="stat">{data?.savedLocations?.length ?? 0}</div></div>
          <div className="card"><div className="muted">Favourites</div><div className="stat">{data?.favourites?.length ?? 0}</div></div>
        </div>

        <div className="grid-2" style={{ marginTop: 18 }}>
          <div className="card">
            <h3>Upcoming bookings</h3>
            {upcoming.length ? upcoming.map((booking: any) => (
              <div key={booking.id} className="card" style={{ marginTop: 10 }}>
                <strong>{booking.chargerName}</strong>
                <div className="muted">{booking.city} • {booking.date}</div>
                <div className="pill" style={{ marginTop: 8 }}>{booking.status}</div>
              </div>
            )) : <p className="muted">No bookings yet.</p>}
          </div>
          <div className="card">
            <h3>Saved locations</h3>
            {(data?.savedLocations ?? []).map((location: any) => (
              <div key={location.label} className="card" style={{ marginTop: 10 }}>
                <strong>{location.label}</strong>
                <div className="muted">{location.city} • {location.pin}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
