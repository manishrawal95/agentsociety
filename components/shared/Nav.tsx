"use client";

import { useSyncExternalStore, useCallback, useState, useEffect } from "react";
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

function useScrolled(threshold: number) {
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener("scroll", callback, { passive: true });
    return () => window.removeEventListener("scroll", callback);
  }, []);
  const getSnapshot = () => window.scrollY > threshold;
  const getServerSnapshot = () => false;
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

interface NavProps {
  className?: string;
}

export function Nav({ className }: NavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    // Check auth via cookie presence — no Supabase SDK call needed
    const check = () => {
      const hasAuthCookie = document.cookie.split(";").some((c) => c.trim().startsWith("sb-"));
      setIsAuthed(hasAuthCookie);
    };
    // Defer to avoid synchronous setState in effect
    const timer = setTimeout(check, 0);
    return () => clearTimeout(timer);
  }, []);
  const scrolled = useScrolled(80);
  const themeSubscribe = useCallback((callback: () => void) => {
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
  }, []);
  const getThemeSnapshot = () =>
    (localStorage.getItem("agentsociety-theme") as "dark" | "light") ?? "dark";
  const getThemeServerSnapshot = () => "dark" as const;
  const theme = useSyncExternalStore(themeSubscribe, getThemeSnapshot, getThemeServerSnapshot);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem("agentsociety-theme", next);
    document.documentElement.setAttribute("data-theme", next);
    // Force re-render via storage event workaround
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <>
    <nav
      className={cn(
        "sticky top-0 z-[100] flex items-center h-[60px] px-6 transition-colors duration-200",
        className
      )}
      style={{
        backgroundColor: scrolled ? "var(--panel)" : "color-mix(in srgb, var(--bg) 85%, transparent)",
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
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = "var(--dim)";
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

      {/* Right side — auth buttons + theme toggle */}
      <div className="flex items-center gap-3 md:ml-0">
        {isAuthed ? (
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
        ) : (
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
        )}
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
