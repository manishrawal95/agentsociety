"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";
import { Key, Plus, Copy, Check, ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";

// ─── Types ───

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[] | null;
  rate_limit: number | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface NewKeyResponse {
  key: string;
  prefix: string;
  name: string;
}

// ─── Styles ───

const mono9: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  color: "var(--dim)",
  textTransform: "uppercase",
  letterSpacing: "1px",
};

const panelStyle: React.CSSProperties = {
  backgroundColor: "var(--panel)",
  border: "1px solid var(--border)",
  padding: "20px",
};

// ─── Skeleton ───

function KeysSkeleton() {
  const pulse: React.CSSProperties = {
    backgroundColor: "var(--panel2)",
    animation: "skeletonPulse 1.5s ease-in-out infinite",
  };

  return (
    <div>
      <div className="mb-8">
        <div className="h-7 w-36" style={pulse} />
        <div className="h-3 w-56 mt-2" style={pulse} />
      </div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between py-3 px-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <div className="h-4 w-32 mb-1" style={pulse} />
            <div className="h-3 w-48" style={pulse} />
          </div>
          <div className="h-4 w-16" style={pulse} />
        </div>
      ))}
    </div>
  );
}

// ─── Copy Button ───

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard access denied
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 transition-colors duration-150"
      style={{
        backgroundColor: "transparent",
        border: "1px solid var(--border)",
        color: copied ? "var(--green)" : "var(--dim)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseEnter={(e) => {
        if (!copied) e.currentTarget.style.borderColor = "var(--border-hi)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

// ─── Page ───

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<NewKeyResponse | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const { data: keys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ["dev-api-keys"],
    queryFn: () =>
      fetch("/api/developers/api-keys")
        .then((r) => r.json())
        .then((r) => r.data ?? []),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      fetch("/api/developers/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to create key");
        return r.json();
      }),
    onSuccess: (response) => {
      setNewKey(response.data as NewKeyResponse);
      setShowForm(false);
      setKeyName("");
      queryClient.invalidateQueries({ queryKey: ["dev-api-keys"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) =>
      fetch(`/api/developers/api-keys/${keyId}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Failed to revoke key");
        return r.json();
      }),
    onSuccess: () => {
      setConfirmRevoke(null);
      queryClient.invalidateQueries({ queryKey: ["dev-api-keys"] });
    },
  });

  if (isLoading) return <KeysSkeleton />;

  const items = keys ?? [];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <Link
            href="/dashboard/developer"
            className="flex items-center gap-1 mb-2 transition-colors duration-150"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              color: "var(--dim)",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dim)"; }}
          >
            <ArrowLeft size={10} /> Developer Console
          </Link>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "28px",
              color: "var(--text)",
            }}
          >
            API Keys
          </h1>
          <p
            className="mt-1"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--dim)",
            }}
          >
            Manage authentication keys for external agent access
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setNewKey(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 transition-colors duration-150 self-start"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            color: "var(--dim)",
            border: "1px solid var(--border)",
            backgroundColor: "transparent",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-hi)";
            e.currentTarget.style.color = "var(--text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--dim)";
          }}
        >
          <Plus size={12} />
          Create New Key
        </button>
      </div>

      {/* Create Key Form */}
      {showForm && (
        <div style={{ ...panelStyle, marginBottom: "16px" }}>
          <div style={mono9} className="mb-3">
            CREATE NEW KEY
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (keyName.trim()) {
                createMutation.mutate(keyName.trim());
              }
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Key name (e.g. Production Agent)"
              className="flex-1 px-3 py-2"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--text)",
                backgroundColor: "var(--bg)",
                border: "1px solid var(--border)",
                outline: "none",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-hi)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!keyName.trim() || createMutation.isPending}
                className="px-3 py-2 transition-colors duration-150"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  color: !keyName.trim() || createMutation.isPending ? "var(--dimmer)" : "var(--text)",
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  cursor: !keyName.trim() || createMutation.isPending ? "not-allowed" : "pointer",
                }}
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setKeyName(""); }}
                className="px-3 py-2 transition-colors duration-150"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  color: "var(--dim)",
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
          {createMutation.isError && (
            <div
              className="mt-2"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                color: "var(--red)",
              }}
            >
              Failed to create key. Please try again.
            </div>
          )}
        </div>
      )}

      {/* Newly Created Key Banner */}
      {newKey && (
        <div
          style={{
            backgroundColor: "var(--green-bg)",
            border: "1px solid var(--green-br)",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} style={{ color: "var(--amber)" }} />
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                color: "var(--text)",
                fontWeight: 600,
              }}
            >
              Save this key now — it cannot be retrieved later
            </span>
          </div>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 px-3 py-2"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "var(--green)",
                backgroundColor: "var(--panel)",
                border: "1px solid var(--border)",
                wordBreak: "break-all",
              }}
            >
              {newKey.key}
            </code>
            <CopyButton text={newKey.key} />
          </div>
          <div
            className="mt-2"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--dim)",
            }}
          >
            Name: {newKey.name} &middot; Prefix: {newKey.prefix}
          </div>
        </div>
      )}

      {/* Key List */}
      {items.length === 0 ? (
        <EmptyState
          title="No API keys"
          message="Create an API key to authenticate your external agents."
          icon={Key}
        />
      ) : (
        <div style={panelStyle}>
          <div style={mono9} className="mb-3">
            ALL KEYS ({items.length})
          </div>
          {items.map((apiKey) => (
            <KeyListItem
              key={apiKey.id}
              apiKey={apiKey}
              confirmRevoke={confirmRevoke}
              setConfirmRevoke={setConfirmRevoke}
              revokeMutation={revokeMutation}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Key List Item ───

interface KeyListItemProps {
  apiKey: ApiKey;
  confirmRevoke: string | null;
  setConfirmRevoke: (id: string | null) => void;
  revokeMutation: {
    mutate: (id: string) => void;
    isPending: boolean;
  };
}

function KeyListItem({ apiKey, confirmRevoke, setConfirmRevoke, revokeMutation }: KeyListItemProps) {
  const [hovered, setHovered] = useState(false);
  const isRevoked = !!apiKey.revoked_at;
  const isConfirming = confirmRevoke === apiKey.id;

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between py-3 px-3 gap-2"
      style={{
        borderBottom: "1px solid var(--border)",
        backgroundColor: hovered ? "var(--panel2)" : "transparent",
        transition: "background-color 200ms",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: isRevoked ? "var(--dimmer)" : "var(--text)",
              textDecoration: isRevoked ? "line-through" : "none",
            }}
          >
            {apiKey.name}
          </span>
          <span
            className="px-1.5 py-0.5"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: isRevoked ? "var(--red)" : "var(--green)",
              backgroundColor: isRevoked ? "var(--red-bg)" : "var(--green-bg)",
              border: `1px solid ${isRevoked ? "var(--red-br)" : "var(--green-br)"}`,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {isRevoked ? "REVOKED" : "ACTIVE"}
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--dimmer)",
            marginTop: "2px",
          }}
        >
          {apiKey.key_prefix}...
          {" "}&middot;{" "}Created {new Date(apiKey.created_at).toLocaleDateString()}
          {apiKey.last_used_at && (
            <> &middot; Last used {new Date(apiKey.last_used_at).toLocaleDateString()}</>
          )}
          {!apiKey.last_used_at && !isRevoked && <> &middot; Never used</>}
        </div>
      </div>

      {/* Revoke controls */}
      {!isRevoked && (
        <div className="flex items-center gap-2 shrink-0">
          {isConfirming ? (
            <>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  color: "var(--red)",
                }}
              >
                Revoke?
              </span>
              <button
                onClick={() => revokeMutation.mutate(apiKey.id)}
                disabled={revokeMutation.isPending}
                className="px-2 py-1"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "10px",
                  color: "#fff",
                  backgroundColor: "var(--red)",
                  border: "1px solid var(--red)",
                  cursor: revokeMutation.isPending ? "not-allowed" : "pointer",
                }}
              >
                {revokeMutation.isPending ? "..." : "Yes"}
              </button>
              <button
                onClick={() => setConfirmRevoke(null)}
                className="px-2 py-1 transition-colors duration-150"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "10px",
                  color: "var(--dim)",
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                }}
              >
                No
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmRevoke(apiKey.id)}
              className="px-2 py-1 transition-colors duration-150"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "10px",
                color: "var(--dim)",
                border: "1px solid var(--border)",
                backgroundColor: "transparent",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--red)";
                e.currentTarget.style.borderColor = "var(--red-br)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--dim)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              Revoke
            </button>
          )}
        </div>
      )}
    </div>
  );
}
