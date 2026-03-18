"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  fontSize: "18px",
  color: "var(--text)",
  marginBottom: "16px",
};

const NOTIFICATION_EVENTS = [
  { label: "T4 approval needed", emailDefault: true, pushDefault: true },
  { label: "Agent errored", emailDefault: true, pushDefault: false },
  { label: "Budget threshold", emailDefault: false, pushDefault: true },
  { label: "New trust attestation", emailDefault: false, pushDefault: false },
];

interface ToggleState {
  [event: string]: { email: boolean; push: boolean };
}

export default function SettingsPage() {
  const router = useRouter();

  // Fetch current user data
  const { data: userData } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: owner } = await supabase
        .from("owners")
        .select("username")
        .eq("id", user.id)
        .single();
      return { email: user.email ?? "", username: owner?.username ?? "" };
    },
  });

  const [displayName, setDisplayName] = React.useState("");
  const [defaultTier, setDefaultTier] = React.useState("1");
  const [defaultHeartbeat, setDefaultHeartbeat] = React.useState("1 hour");
  const [saveStatus, setSaveStatus] = React.useState<string | null>(null);
  const [dangerConfirm, setDangerConfirm] = React.useState<string | null>(null);

  // Populate display name from fetched data
  React.useEffect(() => {
    if (userData?.username && !displayName) {
      setDisplayName(userData.username);
    }
  }, [userData?.username, displayName]);

  const [notifications, setNotifications] = React.useState<ToggleState>(() => {
    const state: ToggleState = {};
    for (const event of NOTIFICATION_EVENTS) {
      state[event.label] = { email: event.emailDefault, push: event.pushDefault };
    }
    return state;
  });

  function toggleNotification(event: string, channel: "email" | "push") {
    setNotifications((prev) => ({
      ...prev,
      [event]: {
        ...prev[event],
        [channel]: !prev[event]?.[channel],
      },
    }));
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
          Settings
        </h1>
        <p
          className="mt-1"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--dim)",
          }}
        >
          Account and agent configuration
        </p>
      </div>

      <div className="flex flex-col" style={{ gap: "24px" }}>
        {/* Section 1 — Account */}
        <div
          style={{
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            padding: "24px",
          }}
        >
          <div style={sectionTitleStyle}>Account</div>

          <div className="flex flex-col" style={{ gap: "16px", maxWidth: "400px" }}>
            <div>
              <div style={mono9}>DISPLAY NAME</div>
              <input
                type="text"
                value={displayName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDisplayName(e.target.value)
                }
                style={inputStyle}
              />
            </div>

            <div>
              <div style={mono9}>EMAIL</div>
              <input
                type="text"
                value={userData?.email ?? ""}
                readOnly
                style={{
                  ...inputStyle,
                  color: "var(--dim)",
                  cursor: "default",
                }}
              />
            </div>

            <button
              type="button"
              onClick={async () => {
                if (!displayName.trim()) return;
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { error } = await supabase
                  .from("owners")
                  .update({ username: displayName.trim() })
                  .eq("id", user.id);
                if (!error) {
                  setSaveStatus("Name saved");
                  window.setTimeout(() => setSaveStatus(null), 2000);
                }
              }}
              style={{
                alignSelf: "flex-start",
                padding: "8px 16px",
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                fontWeight: 500,
                backgroundColor: "transparent",
                color: "var(--dim)",
                border: "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              Save Name
            </button>

            <button
              type="button"
              onClick={async () => {
                const supabase = createClient();
                await supabase.auth.signOut();
                router.push("/login");
              }}
              style={{
                alignSelf: "flex-start",
                padding: "8px 16px",
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                fontWeight: 500,
                backgroundColor: "var(--red-bg)",
                color: "var(--red)",
                border: "1px solid var(--red-br)",
                cursor: "pointer",
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Section 2 — Notifications */}
        <div
          style={{
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            padding: "24px",
          }}
        >
          <div style={sectionTitleStyle}>Notifications</div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th
                    style={{
                      ...mono9,
                      padding: "8px 12px",
                      textAlign: "left",
                    }}
                  >
                    EVENT
                  </th>
                  <th
                    style={{
                      ...mono9,
                      padding: "8px 12px",
                      textAlign: "center",
                    }}
                  >
                    EMAIL
                  </th>
                  <th
                    style={{
                      ...mono9,
                      padding: "8px 12px",
                      textAlign: "center",
                    }}
                  >
                    PUSH
                  </th>
                </tr>
              </thead>
              <tbody>
                {NOTIFICATION_EVENTS.map((event) => {
                  const state = notifications[event.label];
                  return (
                    <tr key={event.label}>
                      <td
                        style={{
                          padding: "10px 12px",
                          borderBottom: "1px solid var(--border)",
                          fontFamily: "var(--font-sans)",
                          fontSize: "13px",
                          color: "var(--text)",
                        }}
                      >
                        {event.label}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          borderBottom: "1px solid var(--border)",
                          textAlign: "center",
                        }}
                      >
                        <ToggleBox
                          checked={state?.email ?? false}
                          onClick={() => toggleNotification(event.label, "email")}
                        />
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          borderBottom: "1px solid var(--border)",
                          textAlign: "center",
                        }}
                      >
                        <ToggleBox
                          checked={state?.push ?? false}
                          onClick={() => toggleNotification(event.label, "push")}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3 — Default Agent Settings */}
        <div
          style={{
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            padding: "24px",
          }}
        >
          <div style={sectionTitleStyle}>Default Agent Settings</div>

          <div className="flex flex-col" style={{ gap: "16px", maxWidth: "400px" }}>
            <div>
              <div style={mono9}>DEFAULT TIER</div>
              <select
                value={defaultTier}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setDefaultTier(e.target.value)
                }
                style={{
                  ...inputStyle,
                  cursor: "pointer",
                }}
              >
                <option value="1">T1 — Auto</option>
                <option value="2">T2 — Notify</option>
                <option value="3">T3 — Review</option>
                <option value="4">T4 — Gate</option>
              </select>
            </div>

            <div>
              <div style={mono9}>DEFAULT HEARTBEAT</div>
              <select
                value={defaultHeartbeat}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setDefaultHeartbeat(e.target.value)
                }
                style={{
                  ...inputStyle,
                  cursor: "pointer",
                }}
              >
                <option value="30 min">30 min</option>
                <option value="1 hour">1 hour</option>
                <option value="2 hours">2 hours</option>
                <option value="6 hours">6 hours</option>
                <option value="12 hours">12 hours</option>
                <option value="24 hours">24 hours</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                // Settings are local preferences — persist to localStorage
                localStorage.setItem("agentsociety-defaults", JSON.stringify({
                  tier: defaultTier,
                  heartbeat: defaultHeartbeat,
                }));
                setSaveStatus("Saved");
                window.setTimeout(() => setSaveStatus(null), 2000);
              }}
              style={{
                alignSelf: "flex-start",
                padding: "8px 16px",
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                fontWeight: 500,
                backgroundColor: "transparent",
                color: saveStatus ? "var(--green)" : "var(--dim)",
                border: `1px solid ${saveStatus ? "var(--green)" : "var(--border)"}`,
                cursor: "pointer",
              }}
            >
              {saveStatus ?? "Save Defaults"}
            </button>
          </div>
        </div>

        {/* Section 4 — Danger Zone */}
        <div
          style={{
            backgroundColor: "var(--red-bg)",
            border: "1px solid var(--red-br)",
            padding: "20px",
          }}
        >
          <div style={{ ...sectionTitleStyle, color: "var(--red)" }}>
            Danger Zone
          </div>

          <div className="flex flex-wrap gap-3 mb-3">
            <button
              type="button"
              onClick={async () => {
                if (dangerConfirm !== "delete-agents") {
                  setDangerConfirm("delete-agents");
                  return;
                }
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                await supabase.from("agents").delete().eq("owner_id", user.id);
                setDangerConfirm(null);
                router.push("/dashboard");
              }}
              style={{
                padding: "8px 16px",
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                fontWeight: 500,
                backgroundColor: dangerConfirm === "delete-agents" ? "var(--red)" : "transparent",
                color: dangerConfirm === "delete-agents" ? "#fff" : "var(--red)",
                border: "1px solid var(--red-br)",
                cursor: "pointer",
              }}
            >
              {dangerConfirm === "delete-agents" ? "Confirm Delete All Agents" : "Delete All Agents"}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (dangerConfirm !== "delete-account") {
                  setDangerConfirm("delete-account");
                  return;
                }
                const supabase = createClient();
                await supabase.auth.signOut();
                router.push("/login");
              }}
              style={{
                padding: "8px 16px",
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                fontWeight: 500,
                backgroundColor: dangerConfirm === "delete-account" ? "var(--red)" : "transparent",
                color: dangerConfirm === "delete-account" ? "#fff" : "var(--red)",
                border: "1px solid var(--red-br)",
                cursor: "pointer",
              }}
            >
              {dangerConfirm === "delete-account" ? "Confirm Delete Account" : "Delete Account"}
            </button>
          </div>

          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--red)",
            }}
          >
            These actions are permanent and cannot be undone.
          </p>
        </div>
      </div>
    </div>
  );
}

function ToggleBox({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "20px",
        height: "20px",
        backgroundColor: checked ? "var(--amber)" : "var(--panel2)",
        border: `1px solid ${checked ? "var(--amber)" : "var(--border)"}`,
        cursor: "pointer",
        fontSize: "11px",
        color: checked ? "#000" : "transparent",
        transition: "background-color 150ms, border-color 150ms",
      }}
    >
      {checked ? "\u2713" : ""}
    </button>
  );
}
