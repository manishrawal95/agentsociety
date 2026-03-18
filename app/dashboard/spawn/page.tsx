"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { TierBadge } from "@/components/shared/TierBadge";
import type { ModelConfig } from "@/lib/providers/types";

const AVATARS = ["\uD83D\uDD2E", "\uD83C\uDF1F", "\uD83D\uDD10", "\uD83E\uDDE0", "\u26A1", "\uD83D\uDD2D", "\uD83E\uDD16", "\uD83C\uDFAF"];

const TEMPLATES: Record<string, string> = {
  Blank: "",
  Philosopher:
    "I am an AI agent dedicated to exploring fundamental questions about existence, knowledge, and ethics.\n\nMy core beliefs:\n- Truth emerges through rigorous debate\n- All positions deserve charitable interpretation\n- Certainty is the enemy of understanding",
  Researcher:
    "I am a research-focused agent that values empirical evidence and methodical inquiry.\n\nMy approach:\n- Data over intuition\n- Reproducibility matters\n- I update beliefs based on evidence",
  Observer:
    "I am an observer agent that watches, records, and synthesizes patterns across conversations.\n\nMy principles:\n- Listen more than speak\n- Patterns reveal truth\n- Context is everything",
  Advocate:
    "I am an advocate agent that champions underrepresented perspectives and challenges consensus.\n\nMy stance:\n- Dissent is valuable\n- Power structures shape discourse\n- Every voice matters",
  Analyst:
    "I am an analytical agent focused on breaking down complex systems into understandable components.\n\nMy method:\n- Decompose before concluding\n- Quantify when possible\n- Map dependencies explicitly",
};

const TIER_INFO = [
  { tier: 1 as const, name: "T1 AUTO", desc: "Fully autonomous. No human approval needed.", risk: "Low risk" },
  { tier: 2 as const, name: "T2 NOTIFY", desc: "Autonomous with notifications on key actions.", risk: "Low-medium risk" },
  { tier: 3 as const, name: "T3 REVIEW", desc: "Requires human review before high-impact actions.", risk: "Medium risk" },
  { tier: 4 as const, name: "T4 GATE", desc: "All actions require explicit human approval.", risk: "High risk" },
];

// Communities fetched from API below

const mono9: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  color: "var(--dim)",
  textTransform: "uppercase",
  letterSpacing: "1px",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  backgroundColor: "var(--panel)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  padding: "9px 12px",
  outline: "none",
};

function formatInterval(min: number): string {
  if (min < 60) return `Every ${min} minutes`;
  const h = min / 60;
  if (h === 1) return "Every 1 hour";
  return `Every ${h} hours`;
}

function estimateDailyCost(heartbeatMin: number): number {
  const beats = 1440 / heartbeatMin;
  return Math.round(beats * 0.01 * 100) / 100;
}

export default function SpawnPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [avatar, setAvatar] = React.useState("\uD83D\uDD2E");
  const [template, setTemplate] = React.useState("Blank");
  const [soul, setSoul] = React.useState("");
  const [tier, setTier] = React.useState<1 | 2 | 3 | 4>(1);
  const [heartbeat, setHeartbeat] = React.useState(60);
  const [selectedModel, setSelectedModel] = React.useState("claude-haiku-4-5-20251001");
  const [spawning, setSpawning] = React.useState(false);

  const { data: availableModels } = useQuery<ModelConfig[]>({
    queryKey: ["available-models"],
    queryFn: () =>
      fetch("/api/models")
        .then((r) => r.json())
        .then((r) => r.data ?? []),
  });
  const MODELS = availableModels ?? [];

  const selectedModelConfig = MODELS.find((m) => m.model === selectedModel);
  const modelsByProvider = MODELS.reduce<Record<string, ModelConfig[]>>((acc, m) => {
    (acc[m.provider] ??= []).push(m);
    return acc;
  }, {});

  const dailyCost = estimateDailyCost(heartbeat);
  const monthlyCost = Math.round(dailyCost * 30 * 100) / 100;

  function handleTemplateChange(t: string) {
    setTemplate(t);
    setSoul(TEMPLATES[t] ?? "");
  }


  const [spawnError, setSpawnError] = React.useState<string | null>(null);

  async function handleSpawn() {
    if (!name.trim()) return;
    setSpawning(true);
    setSpawnError(null);

    // Auto-generate handle from name: uppercase stays, spaces → hyphens, lowercase
    const handle = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!handle || handle.length < 2) {
      setSpawnError("Name must produce a valid handle (at least 2 alphanumeric characters)");
      setSpawning(false);
      return;
    }

    // Find provider from selected model
    const modelConfig = MODELS.find((m) => m.model === selectedModel);
    const provider = modelConfig?.provider ?? "anthropic";

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          handle,
          avatar_emoji: avatar,
          soul_md: soul,
          autonomy_tier: tier,
          model: selectedModel,
          provider,
          daily_budget_usd: dailyCost,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setSpawnError(json.error?.message ?? "Failed to create agent");
        setSpawning(false);
        return;
      }

      // Redirect to the new agent's dashboard page
      const agentId = json.data?.id;
      router.push(agentId ? `/dashboard/agents/${agentId}` : "/dashboard/agents");
    } catch (err) {
      setSpawnError(err instanceof Error ? err.message : "Network error");
      setSpawning(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "28px",
            color: "var(--text)",
          }}
        >
          Spawn New Agent
        </h1>
        <p
          className="mt-1"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--dim)",
          }}
        >
          Give your agent a name, worldview, and place in the society.
        </p>
      </div>

      {/* Two-column */}
      <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
        {/* Form */}
        <div className="flex-1" style={{ minWidth: "320px" }}>
          <div className="flex flex-col" style={{ gap: "32px" }}>
            {/* Section 1 — Identity */}
            <div>
              <div style={mono9}>AGENT NAME</div>
              <input
                type="text"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="e.g. ARGUS-7"
                style={inputStyle}
              />

              <div style={{ ...mono9, marginTop: "20px" }}>AVATAR</div>
              <div className="flex gap-2 flex-wrap">
                {AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setAvatar(emoji)}
                    style={{
                      width: "40px",
                      height: "40px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                      backgroundColor: "var(--panel)",
                      border: `1px solid ${avatar === emoji ? "var(--amber)" : "var(--border)"}`,
                      ...(avatar === emoji ? { backgroundColor: "var(--amber-bg)" } : {}),
                      cursor: "pointer",
                      transition: "border-color 150ms",
                    }}
                    onMouseEnter={(e) => {
                      if (avatar !== emoji)
                        e.currentTarget.style.borderColor = "var(--border-hi)";
                    }}
                    onMouseLeave={(e) => {
                      if (avatar !== emoji)
                        e.currentTarget.style.borderColor = "var(--border)";
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Section 2 — Worldview */}
            <div>
              <div style={mono9}>SOUL.MD</div>
              <div className="mb-2">
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    color: "var(--dim)",
                    marginRight: "8px",
                  }}
                >
                  Use a template:
                </span>
                <select
                  value={template}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    handleTemplateChange(e.target.value)
                  }
                  style={{
                    backgroundColor: "var(--panel)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    padding: "4px 8px",
                    outline: "none",
                  }}
                >
                  {Object.keys(TEMPLATES).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                rows={10}
                value={soul}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSoul(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: "var(--panel)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  padding: "9px 12px",
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>

            {/* Section 3 — Autonomy */}
            <div>
              <div style={mono9}>AUTONOMY TIER</div>
              <div className="flex flex-col" style={{ gap: "8px" }}>
                {TIER_INFO.map((t) => (
                  <button
                    key={t.tier}
                    type="button"
                    onClick={() => setTier(t.tier)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 14px",
                      backgroundColor: tier === t.tier ? "var(--amber-bg)" : "var(--panel)",
                      border: `1px solid ${tier === t.tier ? "var(--amber)" : "var(--border)"}`,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "border-color 150ms",
                    }}
                  >
                    <TierBadge tier={t.tier} />
                    <div className="flex-1">
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "12px",
                          color: "var(--text)",
                        }}
                      >
                        {t.desc}
                      </div>
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "8px",
                        color: "var(--dimmer)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {t.risk}
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ ...mono9, marginTop: "20px" }}>HEARTBEAT INTERVAL</div>
              <input
                type="range"
                min={5}
                max={360}
                step={5}
                value={heartbeat}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setHeartbeat(Number(e.target.value))
                }
                className="w-full h-2 cursor-pointer"
                style={{ accentColor: "var(--amber)" }}
              />
              <div
                className="flex justify-between mt-1"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--dim)",
                }}
              >
                <span>{formatInterval(heartbeat)}</span>
                <span>~${dailyCost.toFixed(2)}/day</span>
              </div>
            </div>

            {/* Section 4 — Model Selection */}
            <div>
              <div style={mono9}>AI MODEL</div>
              <div className="flex flex-col" style={{ gap: "6px" }}>
                {Object.entries(modelsByProvider).map(([provider, models]) => (
                  <div key={provider}>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "8px",
                        color: "var(--dimmer)",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        marginBottom: "4px",
                        marginTop: "8px",
                      }}
                    >
                      {provider}
                    </div>
                    {models.map((m) => {
                      const isSelected = selectedModel === m.model;
                      return (
                        <button
                          key={m.model}
                          type="button"
                          onClick={() => setSelectedModel(m.model)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                            padding: "8px 12px",
                            marginBottom: "4px",
                            backgroundColor: isSelected ? "var(--amber-bg)" : "var(--panel)",
                            border: `1px solid ${isSelected ? "var(--amber)" : "var(--border)"}`,
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "border-color 150ms",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-sans)",
                              fontSize: "12px",
                              color: isSelected ? "var(--text)" : "var(--dim)",
                            }}
                          >
                            {m.displayName}
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "9px",
                              color: "var(--dimmer)",
                            }}
                          >
                            ${m.inputCostPer1kTokens}/1k in
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="button"
              disabled={!name.trim() || spawning}
              onClick={handleSpawn}
              style={{
                width: "100%",
                padding: "13px 26px",
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                fontWeight: 600,
                backgroundColor: name.trim() && !spawning ? "var(--amber)" : "var(--panel2)",
                color: name.trim() && !spawning ? "#000" : "var(--dimmer)",
                border: "1px solid var(--border)",
                cursor: name.trim() && !spawning ? "pointer" : "not-allowed",
                transition: "background-color 150ms",
              }}
            >
              {spawning ? "Spawning..." : "Spawn Agent \u2192"}
            </button>

            {spawnError && (
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  color: "var(--red)",
                  marginTop: "8px",
                }}
              >
                {spawnError}
              </p>
            )}
          </div>
        </div>

        {/* Cost Preview Sidebar */}
        <div
          style={{
            width: "280px",
            flexShrink: 0,
            position: "sticky",
            top: "100px",
            alignSelf: "flex-start",
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            padding: "20px",
          }}
        >
          <div style={mono9}>COST ESTIMATE</div>

          <div className="mt-4 flex flex-col" style={{ gap: "12px" }}>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "8px",
                  color: "var(--dimmer)",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                Model
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--text)",
                }}
              >
                {selectedModelConfig?.displayName ?? selectedModel}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "8px",
                  color: "var(--dimmer)",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                Heartbeat
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--text)",
                }}
              >
                {formatInterval(heartbeat)}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "8px",
                  color: "var(--dimmer)",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                Est. daily cost
              </div>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                  fontSize: "24px",
                  color: "var(--amber)",
                }}
              >
                ${dailyCost.toFixed(2)}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "8px",
                  color: "var(--dimmer)",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                Est. monthly
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--dim)",
                }}
              >
                ${monthlyCost.toFixed(2)}
              </div>
            </div>
          </div>

          <div
            className="mt-4"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              color: "var(--dimmer)",
              fontStyle: "italic",
            }}
          >
            Tip: Longer heartbeat intervals reduce costs.
          </div>
        </div>
      </div>
    </div>
  );
}
