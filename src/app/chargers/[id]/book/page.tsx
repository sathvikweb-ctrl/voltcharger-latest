"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import type { PublicCharger } from "@/lib/types";
import { googleMapsDirectionsUrl } from "@/lib/googleMaps";

export default function ChargerBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [charger, setCharger] = useState<PublicCharger | null>(null);
  const [loading, setLoading] = useState(true);
  const [energy, setEnergy] = useState(20);
  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [slots, setSlots] = useState<{ start: string; end: string }[]>([]);
  const [slot, setSlot] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [shareContact, setShareContact] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [navigationUrl, setNavigationUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/chargers/${id}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Charger not found.");
        return data.charger as PublicCharger;
      })
      .then((data) => {
        if (!cancelled) setCharger(data);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason.message ?? "Unable to load charger.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!charger) return;
    let cancelled = false;
    const search = new URLSearchParams({ date, energy: String(energy), vehicleLimit: String(charger.capacityKw) });
    fetch(`/api/chargers/${charger.id}/slots?${search}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const nextSlots = data.slots ?? [];
        setSlots(nextSlots);
        setSlot((current) => nextSlots.some((item: { start: string }) => item.start === current) ? current : nextSlots[0]?.start ?? "");
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => { cancelled = true; };
  }, [charger, date, energy]);

  useEffect(() => {
    if (!charger || !slot) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    fetch("/api/bookings/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chargerId: charger.id, date, start: slot, energyKwh: energy, vehicleLimitKw: charger.capacityKw }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not calculate this booking.");
        return data;
      })
      .then((data) => {
        if (!cancelled) setQuote(data);
      })
      .catch((reason) => {
        if (!cancelled) {
          setQuote(null);
          setError(reason.message ?? "Could not calculate this booking.");
        }
      });
    return () => { cancelled = true; };
  }, [charger, date, energy, slot]);

  async function submitBooking() {
    if (!charger || !slot) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargerId: charger.id, date, start: slot, energyKwh: energy, vehicleLimitKw: charger.capacityKw, shareContact }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create booking.");
      setBooking(data);
      setNavigationUrl(googleMapsDirectionsUrl(`${charger.publicLat},${charger.publicLng}`));
      if (data.booking.status === "confirmed" || data.booking.status === "completed") {
        try {
          const chargerResponse = await fetch(`/api/chargers/${charger.id}`);
          const chargerData = await chargerResponse.json();
          if (!chargerResponse.ok) throw new Error(chargerData.error ?? "Could not load the confirmed charger location.");
          if (chargerData.charger.exactLocationVisible && Number.isFinite(chargerData.charger.lat) && Number.isFinite(chargerData.charger.lng)) {
            setNavigationUrl(googleMapsDirectionsUrl(`${chargerData.charger.lat},${chargerData.charger.lng}`));
          } else {
            setError("Your booking is saved, but exact directions are not available yet. The map link shows an approximate location.");
          }
        } catch (reason) {
          setError(reason instanceof Error
            ? `Your booking is saved, but exact directions could not be loaded: ${reason.message}`
            : "Your booking is saved, but exact directions could not be loaded.");
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create booking.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="section"><div className="wrap"><div className="card">Loading charger...</div></div></main>;
  }
  if (!charger) {
    return (
      <main className="section">
        <div className="wrap"><div className="card"><h2>Charger not found.</h2><p className="muted">{error}</p><Link className="btn btn-primary" href="/find">Back to search</Link></div></div>
      </main>
    );
  }
  const chargerName = `${charger.manufacturer} ${charger.model}`;

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 900 }}>
        <div className="card">
          <div className="kicker">Book a charging slot</div>
          <h2>{chargerName}</h2>

          <div className="form-grid" style={{ marginTop: 16 }}>
            <label className="field">
              <span>Select date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field">
              <span>Available slot</span>
              <select value={slot} onChange={(e) => setSlot(e.target.value)} disabled={!slots.length}>
                {!slots.length ? <option value="">No available slots</option> : null}
                {slots.map((item) => <option key={item.start} value={item.start}>{item.start} - {item.end}</option>)}
              </select>
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>Requested charging energy (kWh)</span>
              <input type="range" min="1" max="150" step="1" value={energy} onChange={(e) => setEnergy(Number(e.target.value))} />
              <div className="muted">{energy} kWh</div>
            </label>
            <label className="check" style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "start" }}>
              <input type="checkbox" checked={shareContact} onChange={(e) => setShareContact(e.target.checked)} />
              <span>Share my account phone number with the host and send this booking update to my WhatsApp.</span>
            </label>
          </div>

          <div className="notice" style={{ marginTop: 16 }}>
            Energy requested: {energy} kWh<br />
            Rate: ₹{charger.pricePerKwh}/kWh<br />
            Charging estimate: {quote ? `₹${quote.energyAmount}` : "Calculating..."}<br />
            Platform fee: {quote ? `₹${quote.platformFee}` : "Calculating..."}<br />
            Tax on platform fee: {quote ? `₹${quote.tax}` : "Calculating..."}<br />
            Estimated total: {quote ? `₹${quote.total}` : "Calculating..."}<br />
            {quote ? <>{quote.amountLabel}<br /></> : null}
            Estimated duration: {quote ? `${quote.estimatedMinutes} minutes` : "Calculating..."} (actual charge time may vary by vehicle and efficiency).
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
            <button type="button" className="btn btn-primary" onClick={submitBooking} disabled={!quote || submitting || Boolean(booking)}>{submitting ? "Booking..." : "Book this slot"}</button>
            <Link className="btn btn-ghost" href={`/chargers/${charger.id}`}>Back to details</Link>
          </div>

          {error ? <div className="error" style={{ marginTop: 16 }}>{error} <Link href="/login">Sign in</Link></div> : null}

          {booking ? (
            <div className="notice" style={{ marginTop: 20 }}>
              Booking {booking.booking.id} {booking.booking.status === "awaiting_host" ? "is waiting for host approval." : "is confirmed."} No payment was collected.
              {navigationUrl ? (
                <div style={{ marginTop: 10 }}>
                  <a className="btn btn-primary btn-small" href={navigationUrl} target="_blank" rel="noreferrer">
                    {booking.booking.status === "awaiting_host" ? "Navigate to approximate location" : "Navigate to charger"}
                  </a>
                  {booking.booking.status === "awaiting_host" ? <div className="muted" style={{ marginTop: 6 }}>Exact directions are available after the host confirms your booking.</div> : null}
                </div>
              ) : null}
              {shareContact && booking.whatsapp === "sent" ? <div>Booking details were sent to your WhatsApp.</div> : null}
              {shareContact && booking.whatsapp === "not_configured" ? <div>WhatsApp delivery is not configured yet. Your booking is saved.</div> : null}
              {shareContact && booking.whatsapp === "failed" ? <div>Your booking is saved, but the WhatsApp message could not be sent.</div> : null}
              {!shareContact ? <div>Phone number was not shared and no WhatsApp message was sent.</div> : null}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
