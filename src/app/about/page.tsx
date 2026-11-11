import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 900 }}>
        <div className="card">
          <div className="kicker">About VoltCharger</div>
          <h2>Building a better EV charging network together.</h2>
          <p className="muted">
            VoltCharger is a premium EV charging marketplace that connects verified hosts with drivers needing convenient, trusted charging. We focus on transparency, safety and a simple experience from booking to charge completion.
          </p>
          <p className="muted">
            Our network pairs residential hosts, office parking spaces and commercial chargers with EV drivers looking for dependable neighbourhood energy. Every public listing follows clear pricing and verified access conditions.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
            <Link className="btn btn-primary" href="/find">Find a Charger</Link>
            <Link className="btn btn-ghost" href="/host/enroll">List your charger</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
