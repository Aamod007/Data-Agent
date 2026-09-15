"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Code2,
  Database,
  FileText,
  Grid,
  LoaderCircle,
  TableProperties,
  X,
  Zap,
} from "lucide-react";
import { PlotlyChart } from "@/components/plotly-chart";
import { api } from "@/lib/api";
import type { Dataset, DatasetDetails, DatasetProfile } from "@/lib/types";
import { type InspectorTabType, useWorkspaceStore } from "@/stores/workspace-store";

const stageColors: Record<string, string> = {
  raw: "#3b82f6",
  cleaned: "#22c55e",
  wrangled: "#f59e0b",
  engineered: "#a855f7",
};

export function InspectorPanel() {
  const {
    datasets,
    activeDatasetId,
    inspectorOpen,
    inspectorTab,
    setInspectorOpen,
    setInspectorTab,
    setDatasets,
    setActive,
  } = useWorkspaceStore();

  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [details, setDetails] = useState<DatasetDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const activeDataset = useMemo(
    () => datasets.find((d) => d.id === activeDatasetId) ?? datasets[0] ?? null,
    [datasets, activeDatasetId]
  );

  useEffect(() => {
    if (!activeDataset) {
      setProfile(null);
      setDetails(null);
      return;
    }
    setLoading(true);
    Promise.all([
      api.profile(activeDataset.id).catch(() => null),
      api.details(activeDataset.id).catch(() => null),
    ])
      .then(([p, d]) => {
        setProfile(p);
        setDetails(d);
      })
      .finally(() => setLoading(false));
  }, [activeDataset]);



  // Missing values figure (Clean styled for theme.png)
  const missingFigure = useMemo(() => {
    if (!profile?.missing_by_col) return null;
    const cols = profile.missing_by_col.map((c) => c.column);
    const counts = profile.missing_by_col.map((c) => c.missing_count);

    return {
      data: [
        {
          type: "bar",
          x: cols,
          y: counts,
          marker: {
            color: "rgba(96, 165, 250, 0.4)",
            line: { color: "rgba(96, 165, 250, 0.8)", width: 1 },
          },
        },
      ],
      layout: {
        margin: { t: 10, l: 30, r: 10, b: 60 },
        height: 140,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        xaxis: {
          tickangle: -35,
          tickfont: { size: 9, family: "JetBrains Mono, monospace", color: "#475569" },
          gridcolor: "rgba(255, 255, 255, 0.05)",
          zerolinecolor: "rgba(255, 255, 255, 0.1)",
        },
        yaxis: {
          tickfont: { size: 9, family: "JetBrains Mono, monospace", color: "#475569" },
          gridcolor: "rgba(255, 255, 255, 0.05)",
          zerolinecolor: "rgba(255, 255, 255, 0.1)",
        },
      },
    };
  }, [profile]);

  // Correlation matrix heatmap (Clean styled for theme.png)
  const correlationFigure = useMemo(() => {
    if (!profile?.correlations) return null;
    const { columns, z } = profile.correlations;
    return {
      data: [
        {
          type: "heatmap",
          z: z,
          x: columns,
          y: columns,
          colorscale: [
            [0, "#f8fafc"],
            [0.5, "#93c5fd"],
            [1, "#1d4ed8"],
          ],
          reversescale: false,
          hoverongaps: false,
          colorbar: {
            thickness: 8,
            tickfont: { size: 8, family: "JetBrains Mono, monospace", color: "#475569" },
            len: 0.9,
          },
        },
      ],
      layout: {
        margin: { t: 10, l: 65, r: 10, b: 65 },
        height: 160,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        xaxis: {
          tickangle: -35,
          tickfont: { size: 8, family: "JetBrains Mono, monospace", color: "#475569" },
        },
        yaxis: {
          tickfont: { size: 8, family: "JetBrains Mono, monospace", color: "#475569" },
        },
      },
    };
  }, [profile]);



  if (!inspectorOpen) return null;

  return (
    <aside className="theme-right-inspector" aria-label="Inspector Panel">
      {/* 1. Header Tabs (Exact from theme.png) */}
      <div className="inspector-top-tabs">
        <div className="inspector-tab-group">
          <button
            type="button"
            className={`inspector-header-tab ${inspectorTab === "overview" ? "active" : ""}`}
            onClick={() => setInspectorTab("overview")}
          >
            Inspector
          </button>
          <button
            type="button"
            className={`inspector-header-tab ${inspectorTab === "eda" ? "active" : ""}`}
            onClick={() => setInspectorTab("eda")}
          >
            EDA &amp; Metrics
          </button>
          <button
            type="button"
            className={`inspector-header-tab ${inspectorTab === "schema" ? "active" : ""}`}
            onClick={() => setInspectorTab("schema")}
          >
            Schema
          </button>
        </div>

        <button
          type="button"
          className="topbar-collapse-btn"
          onClick={() => setInspectorOpen(false)}
          title="Close Inspector"
          aria-label="Close Inspector"
        >
          <X size={14} />
        </button>
      </div>

      {/* 2. Scrollable Body Content */}
      <div className="inspector-scroll-area">
        {actionNotice && (
          <div className="inspector-notice">
            <Zap size={13} style={{ color: "var(--primary)" }} />
            <span>{actionNotice}</span>
          </div>
        )}

        {!activeDataset ? (
          <div className="inspector-empty">
            <Database size={24} />
            <p>Select or upload a dataset to inspect its properties.</p>
          </div>
        ) : loading ? (
          <div className="inspector-empty">
            <LoaderCircle className="spin" size={22} />
            <p>Profiling {activeDataset.name}…</p>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB (Default as shown in theme.png) */}
            {inspectorTab === "overview" && profile && (
              <>
                {/* 1. Dataset Overview (2x2 KPI box) */}
                <div className="inspector-card-group">
                  <div className="inspector-group-title">
                    <Database size={13} style={{ color: "var(--text-muted)" }} />
                    <span>Dataset Overview</span>
                  </div>

                  <div className="inspector-kpi-row">
                    <div className="theme-kpi-box">
                      <span className="kpi-title">Rows</span>
                      <span className="kpi-number mono">{profile.row_count.toLocaleString()}</span>
                    </div>
                    <div className="theme-kpi-box">
                      <span className="kpi-title">Columns</span>
                      <span className="kpi-number mono">{profile.col_count}</span>
                    </div>
                    <div className="theme-kpi-box">
                      <span className="kpi-title">Missing Values</span>
                      <span
                        className="kpi-number mono"
                        style={{ color: profile.missing_pct > 0 ? "var(--warning)" : "var(--success)" }}
                      >
                        {profile.missing_pct}%
                      </span>
                    </div>
                    <div className="theme-kpi-box">
                      <span className="kpi-title">Duplicates</span>
                      <span className="kpi-number mono">{profile.duplicate_rows}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Column Missing Counts Chart */}
                {missingFigure && (
                  <div className="inspector-card-group">
                    <div className="inspector-group-title">
                      <BarChart3 size={13} style={{ color: "var(--text-muted)" }} />
                      <span>Column Missing Counts</span>
                    </div>
                    <div className="theme-chart-box">
                      <PlotlyChart figure={missingFigure} />
                    </div>
                  </div>
                )}

                {/* 3. Correlation Matrix Heatmap */}
                {correlationFigure && (
                  <div className="inspector-card-group">
                    <div className="inspector-group-title">
                      <Grid size={13} style={{ color: "var(--text-muted)" }} />
                      <span>Correlation Matrix</span>
                    </div>
                    <div className="theme-chart-box">
                      <PlotlyChart figure={correlationFigure} />
                    </div>
                  </div>
                )}

                {/* 4. Dataset Info Key-Values */}
                <div className="inspector-card-group">
                  <div className="inspector-group-title">
                    <FileText size={13} style={{ color: "var(--text-muted)" }} />
                    <span>Dataset Info</span>
                  </div>

                  <div className="theme-meta-list mono">
                    <div className="meta-row">
                      <span className="meta-label">Name</span>
                      <span className="meta-value">{activeDataset.name}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Shape</span>
                      <span className="meta-value">{activeDataset.shape[0].toLocaleString()} × {activeDataset.shape[1]}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Source</span>
                      <span className="meta-value" style={{ fontSize: 10 }}>{activeDataset.source}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Stage</span>
                      <span className="badge-stage">{activeDataset.stage}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Created</span>
                      <span className="meta-value">Just now</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* EDA & METRICS TAB */}
            {inspectorTab === "eda" && profile && (
              <div className="inspector-card-group">
                <div className="inspector-group-title">
                  <BarChart3 size={13} />
                  <span>Column Attributes ({profile.columns.length})</span>
                </div>

                <div className="inspector-col-list">
                  {profile.columns.map((c) => (
                    <div key={c.name} className="inspector-col-row">
                      <div className="inspector-col-left">
                        <strong className="mono">{c.name}</strong>
                        <span className="badge-stage" style={{ fontSize: 8 }}>{c.kind}</span>
                      </div>
                      <div className="inspector-col-right mono">
                        <span>{c.unique_count} uniq</span>
                        {c.null_count > 0 ? (
                          <span style={{ color: "var(--warning)" }}>{c.null_count} null</span>
                        ) : (
                          <span style={{ color: "var(--success)" }}>0 null</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}


            {/* SCHEMA TAB */}
            {inspectorTab === "schema" && details && (
              <div className="inspector-card-group">
                <div className="inspector-group-title">
                  <TableProperties size={13} />
                  <span>Schema &amp; Types</span>
                </div>

                <div className="inspector-schema-table-wrap">
                  <table className="inspector-table">
                    <thead>
                      <tr>
                        <th>COLUMN</th>
                        <th>TYPE</th>
                        <th>NULLS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.columns.map((c) => (
                        <tr key={c.name}>
                          <td className="mono"><strong>{c.name}</strong></td>
                          <td className="mono"><code>{c.dtype}</code></td>
                          <td className="mono">{c.nulls}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="inspector-group-title" style={{ marginTop: 12 }}>
                  <Code2 size={13} />
                  <span>Load Code</span>
                </div>
                <pre className="code-block" style={{ minHeight: 70, fontSize: 10, padding: 10 }}>
                  <code>{details.load_code}</code>
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

