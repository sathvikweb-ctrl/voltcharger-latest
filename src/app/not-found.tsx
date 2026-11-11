import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 640 }}>
        <div className="card">
          <div className="kicker">404</div>
          <h2>That charger could not be found.</h2>
          <p className="muted">The listing may have been moved or is no longer available in this demo marketplace.</p>
          <Link className="btn btn-primary" href="/find">Browse chargers</Link>
        </div>
      </div>
    </main>
  );
}
