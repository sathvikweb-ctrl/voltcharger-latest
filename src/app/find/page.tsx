"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { googleMapsDirectionsUrl, googleMapsSearchUrl } from "@/lib/googleMaps";
import type { PublicCharger } from "@/lib/types";

const MapPreview = dynamic(
  () => import("@/components/MapPreview").then((module) => module.MapPreview),
  { ssr: false, loading: () => <div className="map-loading">Loading map...</div> },
);

const filterOptions = [
  { label: "All charging types", value: "all" },
  { label: "AC Slow", value: "AC" },
  { label: "DC Fast", value: "DC" },
];

export default function FindPage() {
  const [catalog, setCatalog] = useState<PublicCharger[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [capacityFilter, setCapacityFilter] = useState("all");
  const [connectorFilter, setConnectorFilter] = useState("all");
  const [maxPrice, setMaxPrice] = useState(60);
  const [view, setView] = useState<"list" | "map">("list");

  useEffect(() => {
    fetch("/api/chargers")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load chargers.");
        return response.json();
      })
      .then((data) => setCatalog(data.chargers ?? []))
      .catch((error) => setLoadError(error.message ?? "Could not load chargers."))
      .finally(() => setLoading(false));
  }, []);

  const chargers = useMemo(() =>
    catalog.filter((charger) => {
      const matchesQuery = [charger.city, charger.state, charger.manufacturer, charger.model, charger.connector, charger.pinArea].join(" ").toLowerCase().includes(query.toLowerCase());
      const matchesType = typeFilter === "all" || charger.type === typeFilter;
      const matchesCapacity = capacityFilter === "all" || charger.capacityKw === Number(capacityFilter);
      const matchesConnector = connectorFilter === "all" || charger.connector === connectorFilter;
      const matchesPrice = charger.pricePerKwh <= maxPrice;
      return matchesQuery && matchesType && matchesCapacity && matchesConnector && matchesPrice;
    }),
    [capacityFilter, catalog, connectorFilter, maxPrice, query, typeFilter],
  );

  const mapItems = chargers.map((charger) => ({
    id: charger.id,
    city: charger.city,
    price: charger.pricePerKwh,
    type: charger.type === "DC" ? "DC Fast" : "AC Slow",
    capacity: charger.capacityKw,
    lat: charger.publicLat,
    lng: charger.publicLng,
    label: `${charger.manufacturer} ${charger.model}`,
  }));
  const stationSearchArea = query.trim() || "near me";
  const publicStationsUrl = googleMapsSearchUrl(`EV charging stations near ${stationSearchArea}`);

  return (
    <main className="section">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="kicker">Find a charger</div>
            <h2>Discover available charging near you</h2>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a className="btn btn-ghost" href={publicStationsUrl} target="_blank" rel="noreferrer">Public EV stations</a>
            <Link className="btn btn-ghost" href="/host/enroll">Become a Host</Link>
          </div>
        </div>

        <div className="filters">
          <label className="field">
            <span>Search by city, PIN or charger</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hyderabad, Bengaluru, 500032..." />
          </label>
          <label className="field">
            <span>Type</span>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Capacity</span>
            <select value={capacityFilter} onChange={(e) => setCapacityFilter(e.target.value)}>
              <option value="all">Any</option>
              <option value="3.3">3.3 kW</option>
              <option value="7.4">7.4 kW</option>
              <option value="11">11 kW</option>
              <option value="22">22 kW</option>
              <option value="50">50 kW</option>
            </select>
          </label>
          <label className="field">
            <span>Connector</span>
            <select value={connectorFilter} onChange={(e) => setConnectorFilter(e.target.value)}>
              <option value="all">Any</option>
              <option value="Type 2">Type 2</option>
              <option value="CCS2">CCS2</option>
              <option value="Bharat AC-001">Bharat AC-001</option>
            </select>
          </label>
          <label className="field">
            <span>Max price</span>
            <input type="range" min="20" max="75" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} />
            <div className="muted">₹{maxPrice}/kWh</div>
          </label>
        </div>

        <div className="view-toggle">
          <button className="btn btn-ghost btn-small" type="button" onClick={() => setView("list")}>List</button>
          <button className="btn btn-ghost btn-small" type="button" onClick={() => setView("map")}>Map</button>
        </div>

        <div className="split" data-view={view}>
          <div className="map-shell">
            <MapPreview chargers={mapItems} />
          </div>
          <div className="list">
            {loadError ? <div className="error">{loadError}</div> : null}
            {loading ? <div className="card">Loading chargers...</div> : null}
            {chargers.length === 0 ? (
              !loading && !loadError ? <div className="card"><h3>No chargers match these filters.</h3><p className="muted">Try increasing the selected range or choosing a different city.</p></div> : null
            ) : (
              chargers.map((charger) => (
                <div key={charger.id} className="card charger-card">
                  <div className="art" style={{ background: charger.type === "DC" ? "linear-gradient(145deg, #14382c, #245848 50%, #d8f26a)" : "linear-gradient(145deg, #e7f6c8, #f7f4ea 55%, #d5e6da)", height: 160 }}>
                    <span className="pill">{charger.type === "DC" ? "DC Fast" : "AC Slow"}</span>
                    <strong>{charger.capacityKw} kW</strong>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <h3>{charger.manufacturer} {charger.model}</h3>
                      <span className="pill">{charger.rating ? `⭐ ${charger.rating}` : "New"}</span>
                    </div>
                    <div className="muted">{charger.city}, {charger.state} • {charger.connector}</div>
                    <div className="price" style={{ marginTop: 10 }}>₹{charger.pricePerKwh}/kWh</div>
                    <div className="muted" style={{ marginTop: 10 }}>Parking: {charger.parking ? "Available" : "Unavailable"}</div>
                    <div className="muted">Indoor: {charger.indoor ? "Yes" : "No"}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 10 }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <div className="muted">{charger.availableNow ? "Available now" : `Hours ${charger.open}-${charger.close}`}</div>
                        <a href={googleMapsDirectionsUrl(`${charger.publicLat},${charger.publicLng}`)} target="_blank" rel="noreferrer" className="muted">Directions</a>
                      </div>
                      <Link href={`/chargers/${charger.id}`} className="btn btn-primary btn-small">Book Now</Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
