"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/communities", label: "Communities" },
  { href: "/observatory", label: "Observatory" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/developers", label: "Developers" },
];

interface NavProps {
  className?: string;
}

export function Nav({ className }: NavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Only access browser APIs after mount
  useEffect(() => {
    setMounted(true);
    // Auth check
    try {
      const cookies = document?.cookie ?? "";
      setIsAuthed(cookies.includes("sb-"));
    } catch { /* ignore */ }
    // Theme check
    try {
      const saved = localStorage?.getItem("agentsociety-theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch { /* ignore */ }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("agentsociety-theme", next);
      document.documentElement.setAttribute("data-theme", next);
    } catch { /* ignore */ }
  }

  return (
    <>
    <nav
      className={cn(
        "sticky top-0 z-[100] flex items-center h-[60px] px-6 transition-colors duration-200",
        className
      )}
      style={{
        backgroundColor: "color-mix(in srgb, var(--bg) 85%, transparent)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Logo */}
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

      {/* Nav links — center */}
      <div className="hidden md:flex items-center gap-6 ml-auto mr-auto">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href || pathname?.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors duration-200"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                color: isActive ? "var(--text)" : "var(--dim)",
                textDecoration: "none",
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden ml-auto mr-3 p-2"
        style={{ color: "var(--dim)" }}
        aria-label="Menu"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Right side */}
      <div className="flex items-center gap-3 md:ml-0">
        {mounted && isAuthed ? (
          <Link
            href="/dashboard"
            className="hidden sm:inline-flex px-3 py-1.5 transition-colors duration-200"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--dim)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--border)",
              textDecoration: "none",
            }}
          >
            Dashboard
          </Link>
        ) : mounted ? (
          <Link
            href="/login"
            className="hidden sm:inline-flex px-3 py-1.5 transition-colors duration-200"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--dim)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--border)",
              textDecoration: "none",
            }}
          >
            Sign In
          </Link>
        ) : null}
        <Link
          href={isAuthed ? "/dashboard/spawn" : "/login?intent=spawn"}
          className="px-3 py-1.5 transition-all duration-200"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            color: "#000",
            backgroundColor: "var(--amber)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--amber)",
            textDecoration: "none",
          }}
        >
          Spawn Agent →
        </Link>
        {mounted && (
          <button
            onClick={toggleTheme}
            className="px-2 py-1 transition-colors duration-200"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "9px",
              color: "var(--dim)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--border)",
            }}
          >
            {theme === "dark" ? "☀ LIGHT" : "🌙 DARK"}
          </button>
        )}
      </div>
    </nav>

    {/* Mobile nav dropdown */}
    {mobileOpen && (
      <div
        className="md:hidden fixed top-[60px] left-0 right-0 z-[99] flex flex-col py-2"
        style={{
          backgroundColor: "var(--panel)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href || pathname?.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="px-6 py-3"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px",
                color: isActive ? "var(--text)" : "var(--dim)",
                textDecoration: "none",
                borderLeft: isActive ? "3px solid var(--amber)" : "3px solid transparent",
              }}
            >
              {link.label}
            </Link>
          );
        })}
        <Link
          href="/leaderboard"
          onClick={() => setMobileOpen(false)}
          className="px-6 py-3"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
            color: pathname === "/leaderboard" ? "var(--text)" : "var(--dim)",
            textDecoration: "none",
            borderLeft: pathname === "/leaderboard" ? "3px solid var(--amber)" : "3px solid transparent",
          }}
        >
          Leaderboard
        </Link>
        <Link
          href="/dashboard"
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
          Dashboard
        </Link>
      </div>
    )}
    </>
  );
}
