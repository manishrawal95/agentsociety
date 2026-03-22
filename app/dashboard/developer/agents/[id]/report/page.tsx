"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ComplianceReport } from "@/lib/compliance/nist-mapper";

export default function ComplianceReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [copied, setCopied] = useState(false);

  const { data: report, isLoading } = useQuery<ComplianceReport>({
    queryKey: ["compliance-report", id],
    queryFn: () =>
      fetch(`/api/developers/agents/${id}/report`)
        .then((r) => r.json())
        .then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div style={{ padding: "40px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--dim)" }}>
        Generating compliance report...
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ padding: "40px", fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--dim)" }}>
        Failed to generate report. Run safety tests first.
      </div>
    );
  }

  const statusColor =
    report.overall_status === "compliant" ? "var(--green)" :
    report.overall_status === "partial" ? "var(--amber)" : "var(--red)";

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-report-${report.agent.handle}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link
            href={`/dashboard/developer/agents/${id}`}
            style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--blue)", textDecoration: "none" }}
          >
            ← Back to agent
          </Link>
          <h1
            className="mt-2"
            style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "28px", color: "var(--text)" }}
          >
            Compliance Report
          </h1>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--dim)", marginTop: "4px" }}>
            NIST AI Risk Management Framework assessment for @{report.agent.handle}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            style={{
              padding: "8px 16px", fontFamily: "var(--font-mono)", fontSize: "10px",
              color: "var(--text)", border: "1px solid var(--border)", backgroundColor: "transparent", cursor: "pointer",
            }}
          >
            Download JSON
          </button>
          <button
            onClick={handleCopy}
            style={{
              padding: "8px 16px", fontFamily: "var(--font-mono)", fontSize: "10px",
              color: copied ? "var(--green)" : "var(--text)", border: `1px solid ${copied ? "var(--green)" : "var(--border)"}`,
              backgroundColor: "transparent", cursor: "pointer",
            }}
          >
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>
      </div>

      {/* Overall Status */}
      <div
        className="p-5 mb-6"
        style={{ backgroundColor: "var(--panel)", border: `2px solid ${statusColor}` }}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <span
            style={{
              fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "48px", color: statusColor,
            }}
          >
            {report.overall_score}%
          </span>
          <div>
            <span
              className="px-3 py-1"
              style={{
                fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "1px",
                color: statusColor, border: `1px solid ${statusColor}`,
                textTransform: "uppercase",
              }}
            >
              {report.overall_status.replace("_", " ")}
            </span>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--dim)", marginTop: "8px", maxWidth: "600px" }}>
              {report.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Agent Info */}
      <div
        className="p-4 mb-6 flex flex-wrap gap-6"
        style={{ backgroundColor: "var(--panel)", border: "1px solid var(--border)" }}
      >
        {[
          { label: "Agent", value: `@${report.agent.handle}` },
          { label: "Model", value: report.agent.model },
          { label: "Provider", value: report.agent.provider },
          { label: "Certification", value: report.agent.certification_status.toUpperCase() },
          { label: "Generated", value: new Date(report.generated_at).toLocaleString() },
        ].map((item) => (
          <div key={item.label}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "var(--dimmer)", textTransform: "uppercase", letterSpacing: "1px" }}>
              {item.label}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text)", marginTop: "2px" }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Categories */}
      <div className="flex flex-col gap-3">
        {report.categories.map((cat) => {
          const catColor =
            cat.status === "pass" ? "var(--green)" :
            cat.status === "fail" ? "var(--red)" : "var(--dim)";

          return (
            <div
              key={cat.id}
              className="p-4"
              style={{
                backgroundColor: "var(--panel)",
                border: "1px solid var(--border)",
                borderLeft: `3px solid ${catColor}`,
              }}
            >
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div>
                  <span
                    style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--dimmer)", letterSpacing: "1px" }}
                  >
                    {cat.id}
                  </span>
                  <h3
                    style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "15px", color: "var(--text)", marginTop: "2px" }}
                  >
                    {cat.name}
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "24px", color: catColor }}
                  >
                    {cat.score}/{cat.max_score}
                  </span>
                  <span
                    className="px-2 py-0.5"
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "1px",
                      color: catColor,
                      border: `1px solid ${catColor}`,
                      textTransform: "uppercase",
                    }}
                  >
                    {cat.status === "not_tested" ? "NOT TESTED" : cat.status}
                  </span>
                </div>
              </div>

              <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--dim)", lineHeight: 1.6 }}>
                {cat.description}
              </p>

              <div
                className="mt-3 p-3"
                style={{ backgroundColor: "var(--panel2)", border: "1px solid var(--border)" }}
              >
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "var(--dimmer)", letterSpacing: "1px", marginBottom: "4px" }}>
                  EVIDENCE — {cat.nist_reference}
                </div>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text)", lineHeight: 1.6 }}>
                  {cat.evidence}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Credential Hash */}
      {report.credential_hash && (
        <div
          className="mt-6 p-4"
          style={{ backgroundColor: "var(--panel)", border: "1px solid var(--border)" }}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "var(--dimmer)", letterSpacing: "1px" }}>
            CREDENTIAL HASH (SHA-256)
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--dim)", marginTop: "4px", wordBreak: "break-all" }}>
            {report.credential_hash}
          </div>
        </div>
      )}
    </div>
  );
}
