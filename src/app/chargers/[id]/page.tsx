import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getChargerForViewer } from "@/lib/catalog";
import { googleMapsDirectionsUrl } from "@/lib/googleMaps";

export default async function ChargerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await currentUser();
  const result = await getChargerForViewer(id, viewer);

  if (!result) notFound();
  const charger = result.charger;
  const typeLabel = charger.type === "DC" ? "DC Fast" : "AC Slow";
  const chargerName = `${charger.manufacturer} ${charger.model}`;

  return (
    <main className="section">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="kicker">Charger details</div>
            <h2>{chargerName}</h2>
          </div>
          <Link className="btn btn-primary" href={`/chargers/${charger.id}/book`}>Book this charger</Link>
        </div>

        <div className="grid-3" style={{ marginBottom: 22 }}>
          {charger.photos.length ? charger.photos.map((image) => (
            <img key={image} src={image} alt={chargerName} style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 20 }} />
          )) : (
            <div className="art" style={{ gridColumn: "1 / -1", height: 220, background: charger.type === "DC" ? "linear-gradient(145deg, #14382c, #245848 50%, #d8f26a)" : "linear-gradient(145deg, #e7f6c8, #f7f4ea 55%, #d5e6da)" }}>
              <span className="pill">{typeLabel}</span><strong>{charger.capacityKw} kW</strong>
            </div>
          )}
        </div>

        <div className="grid-2">
          <div className="card">
            <h3>Overview</h3>
            <p className="muted">{typeLabel} charging at up to {charger.capacityKw} kW, with {charger.connector} connectivity.</p>
            <div className="grid-2">
              <div><strong>Type:</strong> {typeLabel}</div>
              <div><strong>Capacity:</strong> {charger.capacityKw} kW</div>
              <div><strong>Connector:</strong> {charger.connector}</div>
              <div><strong>Price:</strong> ₹{charger.pricePerKwh}/kWh</div>
              <div><strong>Host:</strong> {charger.hostName}</div>
              <div><strong>Rating:</strong> {charger.rating ? `⭐ ${charger.rating}` : "New"}</div>
            </div>
          </div>

          <div className="card">
            <h3>Location & rules</h3>
            <p className="muted">{charger.address ?? `${charger.city}, ${charger.state} • ${charger.pinArea}`}</p>
            <div className="muted" style={{ marginTop: 10 }}>Parking: {charger.parking}</div>
            <div className="muted">Indoor: {charger.indoor ? "Yes" : "No"}</div>
            <p className="muted" style={{ marginTop: 12 }}>{charger.rules}</p>
            <a className="btn btn-ghost btn-small" href={googleMapsDirectionsUrl(`${charger.publicLat},${charger.publicLng}`)} target="_blank" rel="noreferrer">Open approximate location</a>
          </div>
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Availability</h3>
          <div className="grid-3">
            <div><strong>Opening:</strong> {charger.open}</div>
            <div><strong>Closing:</strong> {charger.close}</div>
            <div><strong>Minimum booking:</strong> {charger.minDurationMin} mins</div>
          </div>
        </div>
      </div>
    </main>
  );
}
