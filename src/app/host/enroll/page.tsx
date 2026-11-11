"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { connectorsFor, lookupPrice, OFFICIAL_PRICES } from "@/lib/pricing";
import { googleMapsSearchUrl } from "@/lib/googleMaps";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

const MapPreview = dynamic(
  () => import("@/components/MapPreview").then((module) => module.MapPreview),
  { ssr: false, loading: () => <div className="map-loading">Loading map...</div> },
);

const steps = [
  "Personal details",
  "Charger details",
  "Location details",
  "Availability",
  "Pricing & earnings",
  "Verification",
  "Review & submit",
];

function toE164(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return phone.trim();
}

const initialForm = {
  fullName: "",
  phone: "",
  email: "",
  manufacturer: "",
  model: "",
  type: "AC" as "AC" | "DC",
  capacityKw: 7.4,
  connector: "Type 2",
  connectorCount: 1,
  phase: "single" as "single" | "three" | "na",
  installationNotes: "",
  maxOutputKw: 7.4,
  address: "",
  city: "",
  state: "",
  pin: "",
  lat: 20.5937,
  lng: 78.9629,
  parking: true,
  indoor: false,
  days: [1, 2, 3, 4, 5, 6],
  open: "06:00",
  close: "22:00",
  minDurationMin: 30,
  maxDurationMin: 240,
  advanceDays: 14,
  requestedCustomPrice: null as number | null,
  photos: [] as string[],
};

export default function HostEnrollPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [otpCode, setOtpCode] = useState("");
  const [otpPhone, setOtpPhone] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpStatus, setOtpStatus] = useState("Verify your mobile number to continue.");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationSet, setLocationSet] = useState(false);

  const connectorOptions = useMemo(() => connectorsFor(form.type), [form.type]);
  const basePrice = lookupPrice(form.type, Number(form.capacityKw), OFFICIAL_PRICES) ?? 25;
  const estimatedEarnings = (basePrice * 20) * 0.82;

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Location access is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        updateField("lat", coords.latitude);
        updateField("lng", coords.longitude);
        setLocationSet(true);
        setError(null);
      },
      () => setError("Could not read your location. You can place the pin on the map instead."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function requestOtp() {
    setError(null);
    try {
      if (form.fullName.trim().length < 2) throw new Error("Enter your full name first.");
      const phone = toE164(form.phone);
      if (!/^\+91[6-9]\d{9}$/.test(phone)) throw new Error("Enter a valid 10-digit Indian mobile number.");
      const supabase = createSupabaseBrowserClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          shouldCreateUser: true,
          data: { full_name: form.fullName.trim(), email: form.email.trim() || null },
        },
      });
      if (otpError) throw otpError;
      setOtpPhone(phone);
      setOtpVerified(false);
      setOtpCode("");
      setOtpStatus("SMS code sent. Enter the code to verify your number.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send the SMS code.");
    }
  }

  async function verifyOtp() {
    setError(null);
    try {
      if (!otpPhone || toE164(form.phone) !== otpPhone) throw new Error("Send a new code to the current phone number.");
      const supabase = createSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({ phone: otpPhone, token: otpCode.trim(), type: "sms" });
      if (verifyError) throw verifyError;

      const response = await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.fullName, email: form.email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not link your verified phone to a host account.");
      setOtpVerified(true);
      setOtpStatus("Mobile number verified successfully.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That SMS code is invalid or expired.");
    }
  }

  async function submitForm() {
    setError(null);
    if (!locationSet) {
      setError("Select the charger's location on the map or use your current location before submitting.");
      setStep(2);
      return;
    }
    if (!otpVerified) {
      setError("Verify the phone number before submitting the charger application.");
      return;
    }
    const phoneDigits = form.phone.replace(/\D/g, "");
    const verifiedPhone = phoneDigits.length === 12 && phoneDigits.startsWith("91") ? phoneDigits.slice(2) : phoneDigits;

    const identityResponse = await fetch("/api/auth/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.fullName, email: form.email }),
    });
    const identityData = await identityResponse.json().catch(() => ({}));
    if (!identityResponse.ok) {
      setError(identityData.error ?? "Could not verify the host account.");
      return;
    }

    const payload = {
      ...form,
      phone: verifiedPhone,
      phase: form.type === "DC" ? "na" : form.phase,
    };

    const response = await fetch("/api/chargers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "The charger application could not be submitted.");
      return;
    }

    setResult(data.message ?? "Your charger has been submitted successfully. Our team will review your application.");
    setStep(steps.length - 1);
  }

  const canGoNext = step < steps.length - 1;

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 980 }}>
        <div className="card">
          <div className="kicker">Become a host</div>
          <h2>Enroll your EV charger</h2>

          <div className="steps" style={{ marginTop: 16 }}>
            {steps.map((label, index) => (
              <button key={label} type="button" data-on={index === step} onClick={() => setStep(index)}> {label} </button>
            ))}
          </div>

          {error ? <div className="error" style={{ marginBottom: 16 }}>{error}</div> : null}
          {result ? <div className="notice" style={{ marginBottom: 16 }}>{result}</div> : null}

          {step === 0 && (
            <div className="form-grid">
              <label className="field"><span>Full name</span><input value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} /></label>
              <label className="field"><span>Mobile number</span><input type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => { updateField("phone", e.target.value); setOtpVerified(false); }} /></label>
              <label className="field"><span>Email address (optional)</span><input type="email" autoComplete="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} /></label>
              <div className="field">
                <span>Phone verification</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost btn-small" type="button" onClick={requestOtp}>Send SMS code</button>
                  <input inputMode="numeric" autoComplete="one-time-code" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="6-digit code" />
                  <button className="btn btn-primary btn-small" type="button" onClick={verifyOtp} disabled={!otpPhone || otpVerified}>Verify</button>
                </div>
                <div className={otpVerified ? "notice" : "muted"}>{otpStatus}</div>
              </div>
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span>Host profile photo (optional)</span>
                <input type="file" accept="image/*" />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="form-grid">
              <label className="field"><span>Manufacturer</span><input value={form.manufacturer} onChange={(e) => updateField("manufacturer", e.target.value)} /></label>
              <label className="field"><span>Model</span><input value={form.model} onChange={(e) => updateField("model", e.target.value)} /></label>
              <label className="field"><span>Charger type</span><select value={form.type} onChange={(e) => updateField("type", e.target.value as "AC" | "DC")}>
                <option value="AC">AC Slow</option>
                <option value="DC">DC Fast</option>
              </select></label>
              <label className="field"><span>Capacity (kW)</span><select value={form.capacityKw} onChange={(e) => updateField("capacityKw", Number(e.target.value))}>
                {(form.type === "AC" ? [3.3, 7.4, 11, 22] : [15, 20, 25, 30, 40, 50, 60, 90, 120, 150, 180, 240, 300, 350]).map((capacity) => (
                  <option key={capacity} value={capacity}>{capacity} kW</option>
                ))}
              </select></label>
              <label className="field"><span>Connector type</span><select value={form.connector} onChange={(e) => updateField("connector", e.target.value)}>
                {connectorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select></label>
              <label className="field"><span>Number of connectors</span><input type="number" min={1} max={8} value={form.connectorCount} onChange={(e) => updateField("connectorCount", Number(e.target.value))} /></label>
              {form.type === "AC" && (
                <label className="field"><span>Supply type</span><select value={form.phase} onChange={(e) => updateField("phase", e.target.value as "single" | "three")}> <option value="single">Single-phase</option><option value="three">Three-phase</option></select></label>
              )}
              <label className="field"><span>Maximum supported output</span><input type="number" step="0.1" value={form.maxOutputKw} onChange={(e) => updateField("maxOutputKw", Number(e.target.value))} /></label>
              <label className="field" style={{ gridColumn: "1 / -1" }}><span>Installation details</span><textarea value={form.installationNotes} onChange={(e) => updateField("installationNotes", e.target.value)} /></label>
            </div>
          )}

          {step === 2 && (
            <div className="form-grid">
              <label className="field" style={{ gridColumn: "1 / -1" }}><span>Property address</span><textarea value={form.address} onChange={(e) => updateField("address", e.target.value)} /></label>
              <label className="field"><span>City</span><input value={form.city} onChange={(e) => updateField("city", e.target.value)} /></label>
              <label className="field"><span>State</span><input value={form.state} onChange={(e) => updateField("state", e.target.value)} /></label>
              <label className="field"><span>PIN code</span><input value={form.pin} onChange={(e) => updateField("pin", e.target.value)} /></label>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <span>Charger map location</span>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <button className="btn btn-ghost btn-small" type="button" onClick={useCurrentLocation}>Use my location</button>
                  <a className="btn btn-ghost btn-small" href={googleMapsSearchUrl(`${form.address}, ${form.city}, ${form.state} ${form.pin}`)} target="_blank" rel="noreferrer">Find address on Google Maps</a>
                </div>
                <div className="map-shell host-pin-map">
                  <MapPreview
                    chargers={[]}
                    center={[form.lat, form.lng]}
                    selectedLocation={locationSet ? { lat: form.lat, lng: form.lng } : undefined}
                    onLocationSelect={({ lat, lng }) => {
                      updateField("lat", lat);
                      updateField("lng", lng);
                      setLocationSet(true);
                    }}
                  />
                </div>
                <div className="muted">{locationSet ? "Pin selected." : "Select the charger entrance on the map or use your current location."} Only an approximate location is shown publicly until a booking is confirmed.</div>
                {locationSet ? <div className="muted">{form.lat.toFixed(5)}, {form.lng.toFixed(5)}</div> : null}
              </div>
              <label className="field"><span>Parking availability</span><select value={String(form.parking)} onChange={(e) => updateField("parking", e.target.value === "true")}><option value="true">Available</option><option value="false">Not available</option></select></label>
              <label className="field"><span>Charging location</span><select value={String(form.indoor)} onChange={(e) => updateField("indoor", e.target.value === "true")}><option value="false">Outdoor</option><option value="true">Indoor</option></select></label>
            </div>
          )}

          {step === 3 && (
            <div className="form-grid">
              <label className="field"><span>Available days</span><input value={form.days.join(", ")} onChange={(e) => updateField("days", e.target.value.split(",").map(Number).filter((day) => !Number.isNaN(day)))} /></label>
              <label className="field"><span>Opening time</span><input type="time" value={form.open} onChange={(e) => updateField("open", e.target.value)} /></label>
              <label className="field"><span>Closing time</span><input type="time" value={form.close} onChange={(e) => updateField("close", e.target.value)} /></label>
              <label className="field"><span>Minimum booking duration</span><input type="number" value={form.minDurationMin} onChange={(e) => updateField("minDurationMin", Number(e.target.value))} /></label>
              <label className="field"><span>Maximum booking duration</span><input type="number" value={form.maxDurationMin} onChange={(e) => updateField("maxDurationMin", Number(e.target.value))} /></label>
              <label className="field"><span>Advance booking option</span><input type="number" value={form.advanceDays} onChange={(e) => updateField("advanceDays", Number(e.target.value))} /></label>
              <label className="field"><span>Temporarily disable bookings</span><select value={"false"} onChange={() => undefined}><option value="false">No</option><option value="true">Yes</option></select></label>
            </div>
          )}

          {step === 4 && (
            <div className="card" style={{ background: "#f4f8ed" }}>
              <h3>Pricing preview</h3>
              <div className="grid-2">
                <div><strong>Charger type:</strong> {form.type}</div>
                <div><strong>Capacity:</strong> {form.capacityKw} kW</div>
                <div><strong>Base customer price:</strong> ₹{basePrice}/kWh</div>
                <div><strong>Estimated host payout:</strong> ₹{Math.round(estimatedEarnings)}</div>
              </div>
              <div className="notice" style={{ marginTop: 16 }}>
                Platform pricing is set by the marketplace and custom prices require admin approval.
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="form-grid">
              <label className="field"><span>Government ID</span><input type="file" accept="image/*,.pdf" /></label>
              <label className="field"><span>Proof of ownership</span><input type="file" accept="image/*,.pdf" /></label>
              <label className="field"><span>Charger photographs</span><input type="file" accept="image/*" multiple /></label>
              <label className="field"><span>Installation photograph</span><input type="file" accept="image/*" /></label>
              <label className="field"><span>Bank account name</span><input value={form.fullName} readOnly /></label>
              <label className="field"><span>Bank IFSC</span><input value="HDFC0001234" /></label>
              <label className="field"><span>Account number</span><input value="4242424242" /></label>
            </div>
          )}

          {step === 6 && (
            <div className="card">
              <h3>Review your application</h3>
              <p className="muted">Please verify that the charger details, location and availability are correct before submission.</p>
              <ul>
                <li>Host: {form.fullName}</li>
                <li>Charger: {form.manufacturer} {form.model}</li>
                <li>Type: {form.type} • {form.capacityKw} kW</li>
                <li>Location: {form.city}, {form.state} • {form.pin}</li>
                <li>Rate: ₹{basePrice}/kWh</li>
              </ul>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, flexWrap: "wrap", gap: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStep((value) => Math.max(value - 1, 0))} disabled={step === 0}>Back</button>
            {step < steps.length - 1 ? (
              <button type="button" className="btn btn-primary" onClick={() => setStep((value) => Math.min(value + 1, steps.length - 1))}>Next</button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={submitForm}>Submit application</button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
