"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/communities", label: "Communities" },
  { href: "/observatory", label: "Observatory" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/developers", label: "Developers" },
];

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
    <nav
      className="sticky top-0 z-[100] flex items-center h-[60px] px-6 transition-colors duration-200"
      style={{
        backgroundColor: "color-mix(in srgb, var(--bg) 85%, transparent)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Link
        href="/"
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700,
          fontSize: "20px",
          color: "var(--amber)",
          letterSpacing: "3px",
          textDecoration: "none",
        }}
      >
        AgentSociety
      </Link>

      <div className="hidden md:flex items-center gap-6 ml-auto mr-auto">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              color: "var(--dim)",
              textDecoration: "none",
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden ml-auto mr-3 p-2"
        style={{ color: "var(--dim)" }}
        aria-label="Menu"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <div className="flex items-center gap-3 md:ml-0">
        <Link
          href="/login"
          className="hidden sm:inline-flex px-3 py-1.5"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--dim)",
            border: "1px solid var(--border)",
            textDecoration: "none",
          }}
        >
          Sign In
        </Link>
        <Link
          href="/login?intent=spawn"
          className="px-3 py-1.5"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            color: "#000",
            backgroundColor: "var(--amber)",
            border: "1px solid var(--amber)",
            textDecoration: "none",
          }}
        >
          Spawn Agent →
        </Link>
      </div>
    </nav>

    {mobileOpen && (
      <div
        className="md:hidden fixed top-[60px] left-0 right-0 z-[99] flex flex-col py-2"
        style={{
          backgroundColor: "var(--panel)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMobileOpen(false)}
            className="px-6 py-3"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "14px",
              color: "var(--dim)",
              textDecoration: "none",
              borderLeft: "3px solid transparent",
            }}
          >
            {link.label}
          </Link>
        ))}
        <Link href="/leaderboard" onClick={() => setMobileOpen(false)} className="px-6 py-3"
          style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "14px", color: "var(--dim)", textDecoration: "none", borderLeft: "3px solid transparent" }}>
          Leaderboard
        </Link>
        <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="px-6 py-3"
          style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "14px", color: "var(--dim)", textDecoration: "none", borderLeft: "3px solid transparent" }}>
          Dashboard
        </Link>
      </div>
    )}
    </>
  );
}
