"use client";

import { useEffect, useMemo, useState } from "react";
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  AlertCircle,
  BarChart3,
  Code2,
  Database,
  FileCode2,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Grid,
  Layers,
  LoaderCircle,
  PanelRightClose,
  Play,
  TableProperties,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { PlotlyChart } from "@/components/plotly-chart";
import { api } from "@/lib/api";
import type { Dataset, DatasetDetails, DatasetPreview, DatasetProfile } from "@/lib/types";
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
  const [runningAction, setRunningAction] = useState<string | null>(null);
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

  // DAG nodes and edges
  const { nodes, edges } = useMemo(
    () => buildDagGraph(datasets, activeDatasetId),
    [datasets, activeDatasetId]
  );

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
          tickfont: { size: 9, family: "JetBrains Mono, monospace", color: "#8b95a5" },
          gridcolor: "rgba(255, 255, 255, 0.05)",
          zerolinecolor: "rgba(255, 255, 255, 0.1)",
        },
        yaxis: {
          tickfont: { size: 9, family: "JetBrains Mono, monospace", color: "#8b95a5" },
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
            [0, "#0b1329"],
            [0.5, "#1e3a8a"],
            [1, "#93c5fd"],
          ],
          reversescale: false,
          hoverongaps: false,
          colorbar: {
            thickness: 8,
            tickfont: { size: 8, family: "JetBrains Mono, monospace", color: "#8b95a5" },
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
          tickfont: { size: 8, family: "JetBrains Mono, monospace", color: "#8b95a5" },
        },
        yaxis: {
          tickfont: { size: 8, family: "JetBrains Mono, monospace", color: "#8b95a5" },
        },
      },
    };
  }, [profile]);

  const runTransformAction = async (agentName: "cleaning" | "wrangling") => {
    if (!activeDataset) return;
    setRunningAction(agentName);
    setActionNotice(`Executing ${agentName} agent on ${activeDataset.name}…`);
    try {
      const instructions =
        agentName === "cleaning"
          ? "Clean this dataset: handle missing values, format dates and numerics, and return cleaned data."
          : "Wrangle and transform dataset into a clean analytical format.";
      const { run_id } = await api.invoke({
        dataset_id: activeDataset.id,
        agent: agentName,
        instructions,
      });
      const poll = window.setInterval(async () => {
        try {
          const run = await api.run(run_id);
          if (run.status === "completed" || run.status === "failed") {
            window.clearInterval(poll);
            setRunningAction(null);
            if (run.status === "completed") {
              setActionNotice(`Generated new ${agentName} dataset.`);
              const updated = await api.datasets();
              setDatasets(updated);
            } else {
              setActionNotice(`Run failed: ${run.message}`);
            }
          }
        } catch {
          window.clearInterval(poll);
          setRunningAction(null);
        }
      }, 800);
    } catch (err) {
      setRunningAction(null);
      setActionNotice(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

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
            className={`inspector-header-tab ${inspectorTab === "pipeline" ? "active" : ""}`}
            onClick={() => setInspectorTab("pipeline")}
          >
            Pipeline DAG
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

            {/* PIPELINE DAG TAB */}
            {inspectorTab === "pipeline" && (
              <div className="inspector-card-group">
                <div className="inspector-group-title">
                  <GitBranch size={13} />
                  <span>Transformation DAG</span>
                </div>

                <div className="inspector-dag-canvas">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    fitView
                    onNodeClick={(_, node) => {
                      const found = datasets.find((d) => d.id === node.id);
                      if (found) setActive(found.id);
                    }}
                  >
                    <Controls showInteractive={false} />
                    <Background gap={16} color="var(--border)" />
                  </ReactFlow>
                </div>

                <div className="inspector-actions-row">
                  <button
                    type="button"
                    className="button primary"
                    style={{ flex: 1, minHeight: 32, fontSize: 10 }}
                    disabled={Boolean(runningAction)}
                    onClick={() => void runTransformAction("cleaning")}
                  >
                    {runningAction === "cleaning" ? <LoaderCircle className="spin" size={12} /> : <Play size={12} />}
                    CLEAN
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    style={{ flex: 1, minHeight: 32, fontSize: 10 }}
                    disabled={Boolean(runningAction)}
                    onClick={() => void runTransformAction("wrangling")}
                  >
                    {runningAction === "wrangling" ? <LoaderCircle className="spin" size={12} /> : <Wrench size={12} />}
                    WRANGLE
                  </button>
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

function buildDagGraph(datasets: Dataset[], active: string | null): { nodes: Node[]; edges: Edge[] } {
  const levels = new Map<string, number>();
  const depth = (dataset: Dataset): number => {
    if (levels.has(dataset.id)) return levels.get(dataset.id)!;
    const parent = datasets.find((item) => item.id === dataset.parent_id);
    const val = parent ? depth(parent) + 1 : 0;
    levels.set(dataset.id, val);
    return val;
  };

  const buckets = new Map<number, number>();
  const nodes = datasets.map((dataset) => {
    const level = depth(dataset);
    const index = buckets.get(level) ?? 0;
    buckets.set(level, index + 1);
    const color = stageColors[dataset.stage] ?? stageColors.raw;
    const isActive = dataset.id === active;

    return {
      id: dataset.id,
      position: { x: level * 160 + 15, y: index * 80 + 15 },
      data: {
        label: (
          <div className="dag-node-pill">
            <span className="dag-dot" style={{ background: color }} />
            <span className="mono" style={{ fontSize: 10, fontWeight: 600 }}>{dataset.name}</span>
          </div>
        ),
      },
      style: {
        border: `1px solid ${isActive ? "var(--primary)" : "var(--border-strong)"}`,
        borderRadius: 6,
        background: "var(--surface)",
        color: "var(--text)",
        width: 140,
        padding: "4px 8px",
        boxShadow: isActive ? "0 0 0 2px rgba(59, 130, 246, 0.4)" : "none",
      },
    };
  });

  return {
    nodes,
    edges: datasets
      .filter((d) => d.parent_id)
      .map((d) => ({
        id: `${d.parent_id}-${d.id}`,
        source: d.parent_id!,
        target: d.id,
        animated: d.id === active,
        style: { stroke: "var(--border-strong)", strokeWidth: 1.5 },
      })),
  };
}
