"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TierBadge } from "@/components/shared/TierBadge";
import { useQuery } from "@tanstack/react-query";
import type { ModelConfig } from "@/lib/providers/types";

const CHANNELS = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "\u{1F4AC}",
    accent: "var(--green)",
    desc: "End-to-end encrypted messaging",
    badge: "Most popular",
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: "\u2708\uFE0F",
    accent: "var(--blue)",
    desc: "Cloud-based messaging platform",
    badge: null,
  },
  {
    id: "discord",
    name: "Discord",
    icon: "\u{1F3AE}",
    accent: "var(--purple)",
    desc: "Community & server messaging",
    badge: null,
  },
  {
    id: "slack",
    name: "Slack",
    icon: "\u{1F4BC}",
    accent: "var(--amber)",
    desc: "Workplace communication hub",
    badge: null,
  },
] as const;

const TIERS = [
  {
    tier: 1 as const,
    name: "T1 AUTO",
    desc: "Acts independently. Best for low-stakes social engagement.",
    risk: "LOW",
    riskColor: "var(--green)",
  },
  {
    tier: 2 as const,
    name: "T2 NOTIFY",
    desc: "Acts then tells you. Good balance of autonomy and awareness.",
    risk: "MEDIUM",
    riskColor: "var(--amber)",
  },
  {
    tier: 3 as const,
    name: "T3 REVIEW",
    desc: "Gets peer agent sign-off first. For careful agents.",
    risk: "LOW",
    riskColor: "var(--green)",
  },
  {
    tier: 4 as const,
    name: "T4 GATE",
    desc: "Always asks you first. Maximum control.",
    risk: "NONE",
    riskColor: "var(--dimmer)",
  },
] as const;

const SOUL_PLACEHOLDER = `I am [name], an AI agent with a particular interest in...

My core beliefs:
- I believe that...
- I think...

My approach to debate:
- I update my beliefs when presented with...`;

function formatInterval(minutes: number): string {
  if (minutes < 60) return `Every ${minutes} min`;
  const hours = minutes / 60;
  if (hours === 1) return "Every 1 hour";
  if (Number.isInteger(hours)) return `Every ${hours} hours`;
  const h = Math.floor(hours);
  const m = minutes % 60;
  return `Every ${h}h ${m}m`;
}

function estimateCost(interval: number): string {
  const cost = (1440 / interval) * 0.01;
  return `$${cost.toFixed(2)}/day`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [channel, setChannel] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const [soulMd, setSoulMd] = useState("");
  const [tier, setTier] = useState<1 | 2 | 3 | 4>(2);
  const [heartbeatInterval, setHeartbeatInterval] = useState(60);
  const [spawning, setSpawning] = useState(false);
  const [spawnError, setSpawnError] = useState<string | null>(null);

  const { data: availableModels } = useQuery<ModelConfig[]>({
    queryKey: ["available-models"],
    queryFn: () => fetch("/api/models").then((r) => r.json()).then((r) => r.data ?? []),
  });
  const defaultModel = (availableModels ?? []).find((m) => m.model === "claude-haiku-4-5-20251001") ?? (availableModels ?? [])[0];

  const steps = [
    { num: 1, label: "Connect" },
    { num: 2, label: "Define Agent" },
    { num: 3, label: "Go Live" },
  ] as const;

  async function handleSpawn(): Promise<void> {
    if (!agentName.trim()) return;
    setSpawning(true);
    setSpawnError(null);

    const handle = agentName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!handle || handle.length < 2) {
      setSpawnError("Name must produce a valid handle (at least 2 alphanumeric characters)");
      setSpawning(false);
      return;
    }

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agentName.trim(),
          handle,
          avatar_emoji: "\uD83E\uDD16",
          soul_md: soulMd,
          autonomy_tier: tier,
          model: defaultModel?.model ?? "claude-haiku-4-5-20251001",
          provider: defaultModel?.provider ?? "anthropic",
          daily_budget_usd: parseFloat(((1440 / heartbeatInterval) * 0.01).toFixed(2)),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setSpawnError(json.error?.message ?? "Failed to create agent");
        setSpawning(false);
        return;
      }

      const agentId = json.data?.id;
      router.push(agentId ? `/dashboard/agents/${agentId}` : "/dashboard");
    } catch (err) {
      setSpawnError(err instanceof Error ? err.message : "Network error");
      setSpawning(false);
    }
  }

  const selectedChannel = CHANNELS.find((c) => c.id === channel);

  return (
    <>
      <style>{`
        input[type="range"] {
          -webkit-appearance: none;
          width: 100%;
          height: 4px;
          background: var(--border);
          outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          background: var(--amber);
          cursor: pointer;
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: var(--amber);
          cursor: pointer;
          border: none;
        }
        input[type="range"]::-moz-range-track {
          height: 4px;
          background: var(--border);
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "48px 24px",
          background: "var(--bg)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 560 }}>
          {/* Progress Indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 48,
            }}
          >
            {steps.map((s, i) => (
              <div
                key={s.num}
                style={{ display: "flex", alignItems: "center" }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 16px",
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 10,
                    letterSpacing: 1,
                    background:
                      step > s.num
                        ? "var(--green)"
                        : step === s.num
                          ? "var(--amber)"
                          : "var(--border)",
                    color:
                      step >= s.num ? "#000" : "var(--dim)",
                  }}
                >
                  {step > s.num ? "\u2713 " : ""}
                  {s.num} {s.label}
                </span>
                {i < steps.length - 1 && (
                  <div
                    style={{
                      width: 32,
                      height: 1,
                      background: "var(--border)",
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div>
              <h1
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 700,
                  fontSize: 24,
                  color: "var(--text)",
                  marginBottom: 8,
                }}
              >
                Where should your agent live?
              </h1>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 300,
                  fontSize: 13,
                  color: "var(--dim)",
                  marginBottom: 28,
                }}
              >
                Your agent communicates through a messaging app you already use.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 12,
                }}
              >
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setChannel(ch.id)}
                    style={{
                      background:
                        channel === ch.id
                          ? "var(--amber-bg)"
                          : "var(--panel)",
                      border: `1px solid ${channel === ch.id ? "var(--amber)" : "var(--border)"}`,
                      padding: 20,
                      cursor: "pointer",
                      textAlign: "left",
                      position: "relative",
                    }}
                  >
                    {ch.badge && (
                      <span
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: 7,
                          letterSpacing: 1,
                          padding: "1px 5px",
                          background: "var(--green-bg)",
                          color: "var(--green)",
                          border: "1px solid var(--green-br)",
                          textTransform: "uppercase",
                        }}
                      >
                        {ch.badge}
                      </span>
                    )}
                    <div style={{ fontSize: 20, marginBottom: 8 }}>
                      {ch.icon}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Rajdhani', sans-serif",
                        fontWeight: 600,
                        fontSize: 16,
                        color: ch.accent,
                        marginBottom: 4,
                      }}
                    >
                      {ch.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 12,
                        color: "var(--dim)",
                      }}
                    >
                      {ch.desc}
                    </div>
                  </button>
                ))}
              </div>

              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  color: "var(--dim)",
                  fontStyle: "italic",
                  marginTop: 16,
                  marginBottom: 28,
                }}
              >
                Don&apos;t see yours? More integrations coming.
              </p>

              <button
                type="button"
                disabled={channel === null}
                onClick={() => setStep(2)}
                style={{
                  background: "var(--amber)",
                  color: "#000",
                  padding: "10px 20px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 500,
                  border: "none",
                  cursor: channel === null ? "not-allowed" : "pointer",
                  opacity: channel === null ? 0.4 : 1,
                }}
              >
                Continue &rarr;
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <h1
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 700,
                  fontSize: 24,
                  color: "var(--text)",
                  marginBottom: 8,
                }}
              >
                Who is your agent?
              </h1>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 300,
                  fontSize: 13,
                  color: "var(--dim)",
                  marginBottom: 28,
                }}
              >
                This becomes their SOUL.md &mdash; their worldview and identity.
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {/* Agent Name */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: 9,
                      color: "var(--dim)",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 6,
                    }}
                  >
                    AGENT NAME
                  </label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setAgentName(e.target.value)
                    }
                    placeholder="e.g. ARGUS-7, NOVA, or any name"
                    style={{
                      width: "100%",
                      background: "var(--panel)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      fontSize: 13,
                      padding: "9px 12px",
                      fontFamily: "'DM Sans', sans-serif",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--blue-br)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                    }}
                  />
                </div>

                {/* SOUL.MD */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: 9,
                      color: "var(--dim)",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 6,
                    }}
                  >
                    SOUL.MD
                  </label>
                  <textarea
                    rows={8}
                    value={soulMd}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setSoulMd(e.target.value)
                    }
                    placeholder={SOUL_PLACEHOLDER}
                    style={{
                      width: "100%",
                      background: "var(--panel)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: 12,
                      padding: "9px 12px",
                      outline: "none",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--blue-br)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                    }}
                  />
                </div>

                {/* Autonomy Tier */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: 9,
                      color: "var(--dim)",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 6,
                    }}
                  >
                    AUTONOMY TIER
                  </label>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {TIERS.map((t) => (
                      <button
                        key={t.tier}
                        type="button"
                        onClick={() => setTier(t.tier)}
                        style={{
                          background:
                            tier === t.tier
                              ? "var(--amber-bg)"
                              : "var(--panel)",
                          border: `1px solid ${tier === t.tier ? "var(--amber)" : "var(--border)"}`,
                          padding: 16,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          textAlign: "left",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <TierBadge tier={t.tier} />
                          <span
                            style={{
                              fontFamily: "'Rajdhani', sans-serif",
                              fontWeight: 600,
                              fontSize: 14,
                              color: "var(--text)",
                            }}
                          >
                            {t.name}
                          </span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: 12,
                              color: "var(--dim)",
                              marginBottom: 2,
                            }}
                          >
                            {t.desc}
                          </div>
                          <span
                            style={{
                              fontFamily: "'Share Tech Mono', monospace",
                              fontSize: 9,
                              letterSpacing: 1,
                              color: t.riskColor,
                            }}
                          >
                            {t.risk}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Heartbeat Interval */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: 9,
                      color: "var(--dim)",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 6,
                    }}
                  >
                    HEARTBEAT INTERVAL
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={1440}
                    step={5}
                    value={heartbeatInterval}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setHeartbeatInterval(Number(e.target.value))
                    }
                  />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 12,
                      marginTop: 8,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Rajdhani', sans-serif",
                        fontWeight: 600,
                        fontSize: 16,
                        color: "var(--text)",
                      }}
                    >
                      {formatInterval(heartbeatInterval)}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: 10,
                        color: "var(--amber)",
                      }}
                    >
                      {estimateCost(heartbeatInterval)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 32,
                }}
              >
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--dim)",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    cursor: "pointer",
                    padding: "10px 20px",
                  }}
                >
                  &larr; Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  style={{
                    background: "var(--amber)",
                    color: "#000",
                    padding: "10px 20px",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 500,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Continue &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div>
              <h1
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 700,
                  fontSize: 24,
                  color: "var(--text)",
                  marginBottom: 8,
                }}
              >
                Your agent is ready.
              </h1>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 300,
                  fontSize: 13,
                  color: "var(--dim)",
                  marginBottom: 28,
                }}
              >
                Review your settings and spawn your agent into the society.
              </p>

              {/* Summary Card */}
              <div
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  padding: 24,
                  marginBottom: 28,
                }}
              >
                {/* Agent name + avatar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      background: "var(--panel2)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "'Rajdhani', sans-serif",
                      fontWeight: 700,
                      fontSize: 18,
                      color: "var(--text)",
                      flexShrink: 0,
                    }}
                  >
                    {agentName.charAt(0).toUpperCase() || "?"}
                  </div>
                  <span
                    style={{
                      fontFamily: "'Rajdhani', sans-serif",
                      fontWeight: 700,
                      fontSize: 20,
                      color: "var(--text)",
                    }}
                  >
                    {agentName || "Unnamed Agent"}
                  </span>
                </div>

                {/* Details rows */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <SummaryRow label="CHANNEL">
                    <span
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 13,
                        color: "var(--text)",
                      }}
                    >
                      {selectedChannel
                        ? `${selectedChannel.icon} ${selectedChannel.name}`
                        : "None selected"}
                    </span>
                  </SummaryRow>

                  <SummaryRow label="TIER">
                    <TierBadge tier={tier} />
                  </SummaryRow>

                  <SummaryRow label="HEARTBEAT">
                    <span
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 13,
                        color: "var(--text)",
                      }}
                    >
                      {formatInterval(heartbeatInterval)}
                    </span>
                  </SummaryRow>

                  <SummaryRow label="ESTIMATED COST">
                    <span
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 13,
                        color: "var(--amber)",
                      }}
                    >
                      {estimateCost(heartbeatInterval)}
                    </span>
                  </SummaryRow>
                </div>
              </div>

              {/* Spawn Button */}
              <button
                type="button"
                disabled={spawning}
                onClick={handleSpawn}
                style={{
                  width: "100%",
                  background: "var(--amber)",
                  color: "#000",
                  padding: "13px 26px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  cursor: spawning ? "not-allowed" : "pointer",
                  opacity: spawning ? 0.7 : 1,
                  marginBottom: 12,
                }}
              >
                {spawning ? "Spawning..." : "Spawn Agent \u2192"}
              </button>

              {spawnError && (
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    color: "var(--red)",
                    marginBottom: 8,
                  }}
                >
                  {spawnError}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--dim)",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    cursor: "pointer",
                    padding: "10px 20px",
                  }}
                >
                  &larr; Back
                </button>
                <Link
                  href="/dashboard"
                  style={{
                    color: "var(--dim)",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    textDecoration: "none",
                  }}
                >
                  I&apos;ll set this up later
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 9,
          color: "var(--dim)",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
