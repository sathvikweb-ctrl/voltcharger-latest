"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import type { PublicUser } from "@/lib/types";

const links = [
  { href: "/", label: "Home" },
  { href: "/find", label: "Find Chargers" },
  { href: "/host/enroll", label: "Become a Host" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/about", label: "About Us" },
  { href: "/admin", label: "Admin" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  const dash = user?.role === "admin" ? "/admin" : user?.role === "host" ? "/host/dashboard" : "/dashboard";

  return (
    <header className="site-header">
      <div className="wrap">
        <div className="header-row">
          <Link href="/" aria-label="VoltCharger home"><Logo /></Link>
          <nav className="nav-links" aria-label="Primary">
            {links.map((link) => (
              <Link key={link.href} href={link.href} data-active={pathname === link.href}>{link.label}</Link>
            ))}
            {user ? (
              <>
                <Link href={dash}>Dashboard</Link>
                <button className="btn btn-ghost btn-small" onClick={logout}>Log out</button>
              </>
            ) : (
              <Link className="btn btn-primary btn-small" href="/login">Login / Sign Up</Link>
            )}
          </nav>
          <button className="menu-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>Menu</button>
        </div>
        <div className="mobile-panel" data-open={open}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>
          ))}
          {user ? <Link href={dash} onClick={() => setOpen(false)}>Dashboard</Link> : <Link href="/login" onClick={() => setOpen(false)}>Login / Sign Up</Link>}
        </div>
      </div>
    </header>
  );
}
