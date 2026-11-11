"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { googleMapsDirectionsUrl } from "@/lib/googleMaps";

const MapPreview = dynamic(
  () => import("@/components/MapPreview").then((module) => module.MapPreview),
  { ssr: false, loading: () => <div className="map-loading">Loading map...</div> },
);

export default function HostDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (res) => {
        if (!res.ok) throw new Error("Please sign in as a host to see the dashboard.");
        return res.json();
      })
      .then((payload) => setData(payload))
      .catch((err) => setError(err.message || "Unable to load dashboard."));
  }, []);

  const stats = data?.stats ?? {
    totalBookings: 0,
    upcoming: 0,
    completed: 0,
    energyKwh: 0,
    gross: 0,
    commission: 0,
    net: 0,
  };
  const bookings = data?.bookings ?? [];
  const chargers = data?.chargers ?? [];
  const mappedChargers = chargers.filter((charger: any) => Number.isFinite(charger.lat) && Number.isFinite(charger.lng));

  async function deleteAccount() {
    if (!window.confirm("Delete your host account and unpublish all its chargers? Booking history will be retained.")) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to delete your account.");
      router.push("/");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete your account.");
      setDeleting(false);
    }
  }

  return (
    <main className="section">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="kicker">Host dashboard</div>
            <h2>Manage your chargers and payouts</h2>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}

        <div className="grid-4">
          <div className="card"><div className="muted">Total bookings</div><div className="stat">{stats.totalBookings}</div></div>
          <div className="card"><div className="muted">Upcoming</div><div className="stat">{stats.upcoming}</div></div>
          <div className="card"><div className="muted">Energy served</div><div className="stat">{stats.energyKwh} kWh</div></div>
          <div className="card"><div className="muted">Net earnings</div><div className="stat">₹{stats.net}</div></div>
        </div>

        <div className="grid-2" style={{ marginTop: 18 }}>
          <div className="card">
            <h3>Your charger locations</h3>
            {mappedChargers.length ? (
              <>
                <div className="host-pin-map" style={{ marginTop: 12, marginBottom: 16, borderRadius: 16, overflow: "hidden" }}>
                  <MapPreview chargers={mappedChargers.map((charger: any) => ({
                    id: charger.id,
                    city: charger.city,
                    price: charger.pricePerKwh,
                    type: charger.type,
                    capacity: charger.capacityKw,
                    lat: charger.lat,
                    lng: charger.lng,
                    label: `${charger.manufacturer} ${charger.model}`,
                  }))} />
                </div>
                <ul>{chargers.map((charger: any) => (
                  <li key={charger.id} className="muted" style={{ marginBottom: 10 }}>
                    {charger.manufacturer} {charger.model} · {charger.status}
                    {Number.isFinite(charger.lat) && Number.isFinite(charger.lng) ? (
                      <>
                        <div>{charger.address}, {charger.city}</div>
                        <a href={googleMapsDirectionsUrl(`${charger.lat},${charger.lng}`)} target="_blank" rel="noreferrer">Navigate to your charger</a>
                      </>
                    ) : null}
                  </li>
                ))}</ul>
              </>
            ) : <p className="muted">No charger locations available yet.</p>}
          </div>
          <div className="card">
            <h3>Payout summary</h3>
            <div className="muted">Gross: ₹{stats.gross}</div>
            <div className="muted">Commission: ₹{stats.commission}</div>
            <div className="muted">Net: ₹{stats.net}</div>
          </div>
        </div>
        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="section-head"><div><div className="kicker">Bookings</div><h2>Customer visits</h2></div></div>
          {bookings.length ? (
            <div className="list" style={{ maxHeight: "none" }}>
              {bookings.map((booking: any) => {
                const digits = typeof booking.customerPhone === "string" ? booking.customerPhone.replace(/\D/g, "") : "";
                const whatsappNumber = digits.length === 10 ? `91${digits}` : digits;
                const message = encodeURIComponent(`Hello ${booking.customerName}, I'm contacting you about your VoltCharger booking ${booking.id}.`);
                return (
                  <article key={booking.id} className="card">
                    <div className="section-head" style={{ marginBottom: 12 }}>
                      <div><h3>{booking.chargerName}</h3><div className="muted">{booking.date} · {booking.start}-{booking.end} · {booking.status.replaceAll("_", " ")}</div></div>
                      <strong>₹{booking.total}</strong>
                    </div>
                    <div className="muted">Customer: {booking.customerName}</div>
                    {booking.customerPhone ? (
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
                        <a href={`tel:${booking.customerPhone}`}>{booking.customerPhone}</a>
                        <a href={`https://wa.me/${whatsappNumber}?text=${message}`} target="_blank" rel="noreferrer">Message on WhatsApp</a>
                      </div>
                    ) : <div className="muted" style={{ marginTop: 8 }}>Customer contact not shared.</div>}
                  </article>
                );
              })}
            </div>
          ) : <div className="card muted">No bookings yet.</div>}
        </section>

        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="card">
            <div className="kicker">Account</div>
            <h3>Delete host account</h3>
            <p className="muted">Your chargers will be unpublished. Upcoming bookings must be resolved first; booking history is retained.</p>
            <button type="button" className="btn btn-ghost" style={{ color: "#8a2b22", borderColor: "#d8a39d" }} onClick={deleteAccount} disabled={deleting}>
              {deleting ? "Deleting account..." : "Delete account"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
