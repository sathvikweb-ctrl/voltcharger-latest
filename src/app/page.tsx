import Link from "next/link";
import { searchChargers } from "@/lib/catalog";

const howItWorks = [
  { step: "01", title: "Search nearby chargers", text: "Filter by city, connector, capacity and availability to find the right fit for your vehicle." },
  { step: "02", title: "Compare and reserve", text: "Review price-per-kWh, parking details, charging speed and host ratings before booking." },
  { step: "03", title: "Charge with confidence", text: "Get directions, confirm the slot and charge with transparent pricing and verified hosts." },
];

const hostBenefits = [
  "Monetize an idle home or workplace charger.",
  "Set your availability and control your booking windows.",
  "Get verified hosting status and a premium guest experience.",
];

const driverBenefits = [
  "Book trusted chargers near your route or neighbourhood.",
  "Compare AC slow vs DC fast based on your charging needs.",
  "Get clear energy estimates before you reserve a slot.",
];

const faqs = [
  { q: "How is the customer price decided?", a: "VoltCharger uses the official platform pricing table. Hosts can only apply a custom price after admin approval." },
  { q: "Are exact addresses shared immediately?", a: "Only an approximate location is shown publicly. The exact address is revealed after a confirmed booking." },
  { q: "How are bookings protected?", a: "The marketplace blocks overlapping reservations, validates availability rules and relies on verified host listings." },
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const featured = (await searchChargers({})).slice(0, 4);
  const acChargers = featured.filter((charger) => charger.type === "AC");
  const averageAcPrice = acChargers.length
    ? Math.round(acChargers.reduce((sum, charger) => sum + charger.pricePerKwh, 0) / acChargers.length)
    : null;
  const ratings = featured.flatMap((charger) => charger.rating == null ? [] : [charger.rating]);
  const averageRating = ratings.length
    ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1)
    : null;

  return (
    <main>
      <section className="wrap hero">
        <div>
          <div className="kicker">Powering Every Journey</div>
          <h1>Your Neighbourhood. Your Charger. Your Energy.</h1>
          <p className="lede">
            Discover and book EV chargers near you, or turn your home charger into an earning opportunity.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/find">Find a Charger</Link>
            <Link className="btn btn-lime" href="/host/enroll">Become a Host</Link>
          </div>
          <div className="grid-3" style={{ marginTop: 26 }}>
            <div className="card">
              <div className="stat">{featured.length}</div>
              <div className="muted">Approved chargers</div>
            </div>
            <div className="card">
              <div className="stat">{averageRating ?? "—"}</div>
              <div className="muted">Average host rating</div>
            </div>
            <div className="card">
              <div className="stat">{averageAcPrice == null ? "—" : `₹${averageAcPrice}`}</div>
              <div className="muted">Avg. AC price / kWh</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="kicker">How VoltCharger works</div>
              <h2>Simple, safe and smart charging</h2>
            </div>
          </div>
          <div className="grid-3">
            {howItWorks.map((step) => (
              <div key={step.step} className="card">
                <div className="step-no">{step.step}</div>
                <h3>{step.title}</h3>
                <p className="muted">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid-2">
          <div className="card">
            <div className="kicker">For hosts</div>
            <h2>Turn your charger into income</h2>
            <ul>
              {hostBenefits.map((item) => (
                <li key={item} className="muted" style={{ marginBottom: 10 }}>{item}</li>
              ))}
            </ul>
            <Link className="btn btn-primary" href="/host/enroll">Start hosting</Link>
          </div>
          <div className="card">
            <div className="kicker">For EV drivers</div>
            <h2>Charge where you already are</h2>
            <ul>
              {driverBenefits.map((item) => (
                <li key={item} className="muted" style={{ marginBottom: 10 }}>{item}</li>
              ))}
            </ul>
            <Link className="btn btn-ghost" href="/find">Explore chargers</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="kicker">Charging types</div>
              <h2>AC slow vs DC fast</h2>
            </div>
          </div>
          <div className="grid-2">
            <div className="card art art-ac">
              <span className="pill">AC Slow</span>
              <strong>3.3–22 kW</strong>
              <p>Best for overnight home charging and everyday top-ups.</p>
            </div>
            <div className="card art art-dc">
              <span className="pill">DC Fast</span>
              <strong>15–350 kW</strong>
              <p>Perfect for quick charging on the road, longer trips and busy urban hubs.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="kicker">Featured chargers</div>
              <h2>Popular listings near you</h2>
            </div>
            <Link href="/find" className="btn btn-ghost">View all</Link>
          </div>
          {featured.length ? <div className="grid-4">
            {featured.map((charger) => (
              <div key={charger.id} className="card">
                <div className="art" style={{ background: charger.type === "DC" ? "linear-gradient(145deg, #14382c, #245848 50%, #d8f26a)" : "linear-gradient(145deg, #e7f6c8, #f7f4ea 55%, #d5e6da)" }}>
                  <span className="pill">{charger.type === "DC" ? "DC Fast" : "AC Slow"}</span>
                  <strong>{charger.capacityKw} kW</strong>
                </div>
                <h3>{charger.manufacturer} {charger.model}</h3>
                <div className="muted">{charger.city} • {charger.connector}</div>
                <div className="price" style={{ marginTop: 12 }}>₹{charger.pricePerKwh}/kWh</div>
                <div className="muted" style={{ marginTop: 8 }}>{charger.rating == null ? "No ratings yet" : `⭐ ${charger.rating} rating`}</div>
                <Link href={`/chargers/${charger.id}`} className="btn btn-primary" style={{ marginTop: 16, width: "100%" }}>Book now</Link>
              </div>
            ))}
          </div> : <div className="card"><h3>No approved chargers yet</h3><p className="muted">New host listings will appear here after they are reviewed.</p><Link className="btn btn-primary" href="/host/enroll">List your charger</Link></div>}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="kicker">Trust & safety</div>
              <h2>Verified hosts. Clear rules. Safer charging.</h2>
            </div>
          </div>
          <div className="grid-3">
            <div className="card"><h3>Identity checks</h3><p className="muted">Hosts must verify identity and charger ownership before approval.</p></div>
            <div className="card"><h3>Transparent pricing</h3><p className="muted">Every charger advertises an approved per-kWh rate with public availability rules.</p></div>
            <div className="card"><h3>Exact-address protection</h3><p className="muted">Public listings show approximate locations until a booking is confirmed.</p></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap faq">
          <div className="section-head">
            <div>
              <div className="kicker">FAQ</div>
              <h2>Questions, answered</h2>
            </div>
          </div>
          {faqs.map((item) => (
            <details key={item.q} style={{ marginBottom: 12 }}>
              <summary>{item.q}</summary>
              <p className="muted" style={{ marginTop: 8 }}>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div>
            <div className="logo">
              <svg viewBox="0 0 36 36" aria-hidden="true"><rect x="1" y="1" width="34" height="34" rx="11" fill="#14382c" /><circle cx="18" cy="18" r="14.2" fill="none" stroke="#d8f26a" strokeOpacity="0.45" strokeWidth="1.2" /><path d="M20.4 7.2 12.2 19.1h6.1l-1.5 9.7 9.6-13.8h-6.2l0.2-7.8z" fill="#d8f26a" /></svg>
              <span>VoltCharger</span>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>Premium access to trusted EV charging, built for neighbourhood hosts and drivers.</p>
          </div>
          <div>
            <h3>Company</h3>
            <p className="muted"><Link href="/about">About Us</Link></p>
            <p className="muted"><Link href="/how-it-works">How It Works</Link></p>
          </div>
          <div>
            <h3>Support</h3>
            <p className="muted"><a href="mailto:hello@voltcharger.in">hello@voltcharger.in</a></p>
            <p className="muted"><a href="tel:+919876543210">+91 98765 43210</a></p>
          </div>
          <div>
            <h3>Legal</h3>
            <p className="muted">Privacy Policy</p>
            <p className="muted">Terms of Service</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
