"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, Database, FileChartColumnIncreasing, FileText, Layers, LoaderCircle, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { PlotlyChart } from "@/components/plotly-chart";
import { api } from "@/lib/api";
import type { ColumnProfile, Dataset, DatasetProfile } from "@/lib/types";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function ExplorerWorkspace() {
  const { datasets, activeDatasetId, setDatasets, setActive } = useWorkspaceStore();
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "columns" | "correlations" | "missing">("overview");
  const [columnFilter, setColumnFilter] = useState<"all" | "numeric" | "categorical" | "datetime" | "boolean">("all");

  useEffect(() => {
    if (!datasets.length) {
      api.datasets().then(setDatasets).catch(() => undefined);
    }
  }, [datasets.length, setDatasets]);

  const activeDataset = useMemo(
    () => datasets.find((d) => d.id === activeDatasetId) ?? datasets[0] ?? null,
    [datasets, activeDatasetId]
  );

  useEffect(() => {
    if (!activeDataset) {
      setProfile(null);
      return;
    }
    setLoading(true);
    setError(null);
    api.profile(activeDataset.id)
      .then(setProfile)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load dataset profile."))
      .finally(() => setLoading(false));
  }, [activeDataset]);

  const filteredColumns = useMemo(() => {
    if (!profile) return [];
    if (columnFilter === "all") return profile.columns;
    return profile.columns.filter((c) => c.kind === columnFilter);
  }, [profile, columnFilter]);

  // Correlation heatmap figure for Plotly
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
          colorscale: "Blues",
          reversescale: false,
          hoverongaps: false,
        },
      ],
      layout: {
        title: { text: "Feature Correlation Matrix" },
        margin: { t: 40, l: 80, r: 40, b: 80 },
        height: 480,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
      },
    };
  }, [profile]);

  // Missing values figure for Plotly
  const missingFigure = useMemo(() => {
    if (!profile?.missing_by_col) return null;
    const missingOnly = profile.missing_by_col.filter((c) => c.missing_count > 0);
    const cols = (missingOnly.length ? missingOnly : profile.missing_by_col.slice(0, 20)).map((c) => c.column);
    const counts = (missingOnly.length ? missingOnly : profile.missing_by_col.slice(0, 20)).map((c) => c.missing_count);
    const pcts = (missingOnly.length ? missingOnly : profile.missing_by_col.slice(0, 20)).map((c) => c.missing_pct);

    return {
      data: [
        {
          type: "bar",
          x: cols,
          y: counts,
          text: pcts.map((p) => `${p}%`),
          textposition: "auto",
          marker: { color: "#D97706" },
        },
      ],
      layout: {
        title: { text: missingOnly.length ? "Missing Values per Column" : "Missing Value Count (All 0 = Complete Dataset)" },
        xaxis: { title: "Column", tickangle: -35 },
        yaxis: { title: "Missing Count" },
        margin: { t: 40, l: 50, r: 30, b: 90 },
        height: 380,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
      },
    };
  }, [profile]);

  return (
    <div className="page explorer-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Data Intelligence</p>
          <h1>Exploratory Data Analysis (EDA)</h1>
          <p className="muted">Automated schema discovery, statistical summaries, missingness analysis, and correlation mapping.</p>
        </div>
        {activeDataset && (
          <div className="heading-actions">
            <Link href="/chat" className="button primary">
              <Sparkles size={16} /> Ask AI about this dataset
            </Link>
          </div>
        )}
      </div>

      {error && <div role="alert" className="error-banner">{error}</div>}

      {!activeDataset ? (
        <section className="empty">
          <Database size={32} aria-hidden="true" />
          <p>
            <strong>No active dataset.</strong>
            <br />
            Upload a dataset or load a sample first to view the exploratory dashboard.
          </p>
          <Link href="/datasets" className="button primary">
            Go to Datasets
          </Link>
        </section>
      ) : (
        <>
          {/* Dataset Selector Bar */}
          <section className="chat-context">
            <span className="context-label">Analyzing dataset</span>
            <select
              className="context-select"
              value={activeDataset.id}
              onChange={(e) => {
                const id = e.target.value;
                void api.setActive(id).then(() => {
                  setActive(id);
                  return api.datasets();
                }).then(setDatasets);
              }}
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.shape[0].toLocaleString()} rows × {d.shape[1]} cols · {d.stage}
                </option>
              ))}
            </select>
            <span className="online"><span /> active</span>
          </section>

          {loading ? (
            <div className="empty">
              <LoaderCircle className="spin" size={28} />
              <p>Profiling dataset metrics…</p>
            </div>
          ) : profile ? (
            <>
              {/* Stat Tiles KPI Grid */}
              <div className="kpi-grid">
                <div className="kpi-card card">
                  <span className="kpi-label">Total Rows</span>
                  <strong className="kpi-value">{profile.row_count.toLocaleString()}</strong>
                  <span className="kpi-sub">Data instances</span>
                </div>
                <div className="kpi-card card">
                  <span className="kpi-label">Columns</span>
                  <strong className="kpi-value">{profile.col_count}</strong>
                  <span className="kpi-sub">
                    {profile.columns.filter((c) => c.kind === "numeric").length} num · {profile.columns.filter((c) => c.kind === "categorical").length} cat
                  </span>
                </div>
                <div className="kpi-card card">
                  <span className="kpi-label">Missing Cells</span>
                  <strong className="kpi-value" style={{ color: profile.missing_pct > 0 ? "var(--accent)" : "var(--success)" }}>
                    {profile.missing_pct}%
                  </strong>
                  <span className="kpi-sub">{profile.total_missing_cells.toLocaleString()} of {profile.total_cells.toLocaleString()}</span>
                </div>
                <div className="kpi-card card">
                  <span className="kpi-label">Duplicates</span>
                  <strong className="kpi-value" style={{ color: profile.duplicate_rows > 0 ? "var(--danger)" : "var(--success)" }}>
                    {profile.duplicate_rows}
                  </strong>
                  <span className="kpi-sub">Duplicate rows detected</span>
                </div>
                <div className="kpi-card card">
                  <span className="kpi-label">Memory</span>
                  <strong className="kpi-value">
                    {(profile.memory_usage_bytes / (1024 * 1024)).toFixed(2)} MB
                  </strong>
                  <span className="kpi-sub">In-memory footprint</span>
                </div>
              </div>

              {/* View Navigation Tabs */}
              <div className="results-tabs" style={{ marginTop: 20 }}>
                <button
                  className={`result-tab ${activeTab === "overview" ? "active" : ""}`}
                  onClick={() => setActiveTab("overview")}
                >
                  <BarChart3 size={15} /> Overview & Visuals
                </button>
                <button
                  className={`result-tab ${activeTab === "columns" ? "active" : ""}`}
                  onClick={() => setActiveTab("columns")}
                >
                  <Layers size={15} /> Column Profiles ({profile.col_count})
                </button>
                <button
                  className={`result-tab ${activeTab === "correlations" ? "active" : ""}`}
                  onClick={() => setActiveTab("correlations")}
                >
                  <Zap size={15} /> Correlation Matrix
                </button>
                <button
                  className={`result-tab ${activeTab === "missing" ? "active" : ""}`}
                  onClick={() => setActiveTab("missing")}
                >
                  <AlertCircle size={15} /> Missing Data Breakdown
                </button>
              </div>

              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="eda-overview-grid">
                  <section className="card">
                    <div className="card-header">
                      <h2>Missing Value Distribution</h2>
                    </div>
                    <div style={{ padding: 12 }}>
                      {missingFigure && <PlotlyChart figure={missingFigure} />}
                    </div>
                  </section>

                  {correlationFigure ? (
                    <section className="card">
                      <div className="card-header">
                        <h2>Numeric Correlation Matrix</h2>
                      </div>
                      <div style={{ padding: 12 }}>
                        <PlotlyChart figure={correlationFigure} />
                      </div>
                    </section>
                  ) : (
                    <section className="card" style={{ display: "grid", placeItems: "center", padding: 40 }}>
                      <div className="empty">
                        <FileText size={28} />
                        <p>Not enough numeric columns to compute a correlation matrix.</p>
                      </div>
                    </section>
                  )}
                </div>
              )}

              {/* TAB 2: COLUMN PROFILES */}
              {activeTab === "columns" && (
                <section className="card" style={{ marginTop: 12 }}>
                  <div className="card-header" style={{ flexWrap: "wrap", gap: 12 }}>
                    <h2>Column Attributes & Statistics</h2>
                    <div className="tabs">
                      {(["all", "numeric", "categorical", "datetime", "boolean"] as const).map((k) => (
                        <button
                          key={k}
                          className={`tab ${columnFilter === k ? "active" : ""}`}
                          onClick={() => setColumnFilter(k)}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Column</th>
                          <th>Kind</th>
                          <th>Data Type</th>
                          <th>Unique</th>
                          <th>Missing</th>
                          <th>Summary / Samples</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredColumns.map((c) => (
                          <tr key={c.name}>
                            <td><strong>{c.name}</strong></td>
                            <td><span className={`badge badge-${c.kind}`}>{c.kind}</span></td>
                            <td><code>{c.dtype}</code></td>
                            <td>{c.unique_count.toLocaleString()}</td>
                            <td>
                              {c.null_count > 0 ? (
                                <span className="warn-nulls">{c.null_count.toLocaleString()} ({c.null_pct}%)</span>
                              ) : (
                                <span className="no-nulls">0%</span>
                              )}
                            </td>
                            <td style={{ maxWidth: 350, overflow: "hidden", textOverflow: "ellipsis" }}>
                              {c.kind === "numeric" && c.min_val != null ? (
                                <span className="mono" style={{ fontSize: 11 }}>
                                  min: {c.min_val} · max: {c.max_val} · μ: {c.mean_val} · σ: {c.std_val}
                                </span>
                              ) : (
                                <span className="muted" style={{ fontSize: 11 }}>
                                  {c.sample_values.map((v) => String(v)).slice(0, 4).join(", ")}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* TAB 3: CORRELATIONS */}
              {activeTab === "correlations" && (
                <section className="card" style={{ marginTop: 12, padding: 16 }}>
                  {correlationFigure ? (
                    <PlotlyChart figure={correlationFigure} />
                  ) : (
                    <div className="empty">
                      <p>At least 2 numeric columns are required to generate a correlation heatmap.</p>
                    </div>
                  )}
                </section>
              )}

              {/* TAB 4: MISSING DATA */}
              {activeTab === "missing" && (
                <section className="card" style={{ marginTop: 12 }}>
                  <div className="card-header">
                    <h2>Missing Values per Column Breakdown</h2>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Column</th>
                          <th>Missing Count</th>
                          <th>Missing %</th>
                          <th>Present Count</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.missing_by_col.map((row) => (
                          <tr key={row.column}>
                            <td><strong>{row.column}</strong></td>
                            <td>{row.missing_count.toLocaleString()}</td>
                            <td>{row.missing_pct}%</td>
                            <td>{row.present_count.toLocaleString()}</td>
                            <td>
                              {row.missing_count === 0 ? (
                                <span className="no-nulls">Complete (100%)</span>
                              ) : (
                                <span className="warn-nulls">{row.missing_pct}% Missing</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
