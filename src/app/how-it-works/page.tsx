import Link from "next/link";

const steps = [
  { title: "Search nearby charging", text: "Filter by location, power output, connector type and pricing to find the right charger." },
  { title: "Book with confidence", text: "Compare host ratings, parking options and availability windows before confirming a slot." },
  { title: "Charge and review", text: "Drive in, connect, complete your charging session and share a review for future drivers." },
];

export default function HowItWorksPage() {
  return (
    <main className="section">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="kicker">How it works</div>
            <h2>From host signup to confirmed charge in a few steps</h2>
          </div>
        </div>
        <div className="grid-3">
          {steps.map((step, index) => (
            <div key={step.title} className="card">
              <div className="step-no">0{index + 1}</div>
              <h3>{step.title}</h3>
              <p className="muted">{step.text}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="btn btn-primary" href="/find">Explore chargers</Link>
          <Link className="btn btn-ghost" href="/host/enroll">List a charger</Link>
        </div>
      </div>
    </main>
  );
}
