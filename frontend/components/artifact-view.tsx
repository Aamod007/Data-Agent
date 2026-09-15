"use client";

import { useState } from "react";
import { AlertTriangle, Check, Code2, Copy, Download, FileText, Sparkles, TableProperties } from "lucide-react";
import { PlotlyChart } from "@/components/plotly-chart";
import type { Artifact } from "@/lib/types";

export function ArtifactView({ artifact }: { artifact: Artifact }) {
  const [copied, setCopied] = useState(false);

  const copyPayload = () => {
    let text = "";
    if (typeof artifact.payload === "string") {
      text = artifact.payload;
    } else {
      text = JSON.stringify(artifact.payload, null, 2);
    }
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (artifact.type === "chart") {
    return (
      <section className="artifact analysis-drawer-style">
        <ArtifactHeader artifact={artifact} onCopy={copyPayload} copied={copied} />
        <div style={{ padding: "8px 12px" }}>
          <PlotlyChart figure={artifact.payload} />
        </div>
      </section>
    );
  }

  if (artifact.type === "code") {
    return (
      <section className="artifact analysis-drawer-style">
        <ArtifactHeader artifact={artifact} onCopy={copyPayload} copied={copied} />
        <pre className="code-block">
          <code>{String(artifact.payload)}</code>
        </pre>
      </section>
    );
  }

  if (artifact.type === "table") {
    const table = artifact.payload as {
      columns: string[];
      rows: Record<string, unknown>[];
      shape: [number, number];
      truncated?: boolean;
    };
    return (
      <section className="artifact analysis-drawer-style">
        <ArtifactHeader artifact={artifact} onCopy={copyPayload} copied={copied} />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={index}>
                  {table.columns.map((column) => (
                    <td key={column}>
                      {row[column] == null ? <span className="null">null</span> : String(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {table.truncated && (
          <p className="artifact-note">
            Displaying first 250 rows · Total dataset dimension: {table.shape[0].toLocaleString()} × {table.shape[1]}
          </p>
        )}
      </section>
    );
  }

  if (artifact.type === "report") {
    return (
      <section className="artifact analysis-drawer-style">
        <ArtifactHeader artifact={artifact} onCopy={copyPayload} copied={copied} />
        <iframe
          className="report-frame"
          sandbox="allow-scripts"
          title={artifact.title}
          srcDoc={String((artifact.payload as { html?: string }).html ?? "")}
        />
      </section>
    );
  }

  const isError = artifact.type === "error" || artifact.type === "warning";
  return (
    <section className={`artifact analysis-drawer-style ${isError ? "notice" : ""}`}>
      <ArtifactHeader artifact={artifact} onCopy={copyPayload} copied={copied} />
      <p className="artifact-text">{String(artifact.payload)}</p>
    </section>
  );
}

function ArtifactHeader({
  artifact,
  onCopy,
  copied,
}: {
  artifact: Artifact;
  onCopy?: () => void;
  copied?: boolean;
}) {
  const Icon =
    artifact.type === "code"
      ? Code2
      : artifact.type === "table"
      ? TableProperties
      : artifact.type === "warning" || artifact.type === "error"
      ? AlertTriangle
      : FileText;

  return (
    <div className="artifact-header">
      <span>
        <Icon size={14} aria-hidden="true" style={{ color: "var(--primary)" }} />
        <span>{artifact.title.toUpperCase()}</span>
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {artifact.language && <code>{artifact.language}</code>}
        {onCopy && (
          <button
            className="table-icon"
            style={{ width: 24, height: 24 }}
            onClick={onCopy}
            title="Copy to clipboard"
            aria-label="Copy artifact content"
          >
            {copied ? <Check size={13} style={{ color: "var(--success)" }} /> : <Copy size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}
