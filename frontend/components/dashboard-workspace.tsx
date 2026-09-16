"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Filter,
  Grid,
  HardDrive,
  Info,
  Layers,
  Lightbulb,
  LoaderCircle,
  Maximize2,
  PieChart as PieChartIcon,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TableProperties,
  Target,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { PlotlyChart } from "@/components/plotly-chart";
import { PowerBiDashboard } from "@/components/power-bi-dashboard";
import { GraphicWalkerBoard } from "@/components/graphic-walker-board";
import {
  ChartSkeleton,
  MetricCardSkeleton,
  Skeleton,
  TableSkeleton,
} from "@/components/skeleton";
import { api } from "@/lib/api";
import type { ColumnProfile, DatasetPreview, DatasetProfile } from "@/lib/types";
import { useWorkspaceStore } from "@/stores/workspace-store";

const SUPPORTED_EXTENSIONS = [".csv", ".tsv", ".json", ".parquet", ".xlsx", ".xls"];

export function DashboardWorkspace() {
  const { datasets, activeDatasetId, setDatasets, setActive } = useWorkspaceStore();
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Dashboard mode: "powerbi" (default), "studio" (GraphicWalker), or "eda"
  const [dashboardMode, setDashboardMode] = useState<"powerbi" | "studio" | "eda">("powerbi");

  // Active section tab
  const [activeSection, setActiveSection] = useState<
    "overview" | "quality" | "univariate" | "bivariate" | "correlation" | "outliers" | "insights" | "data"
  >("overview");

  // Univariate controls
  const [selectedNumCol, setSelectedNumCol] = useState<string>("");
  const [selectedCatCol, setSelectedCatCol] = useState<string>("");

  // Bivariate controls
  const [bivariateX, setBivariateX] = useState<string>("");
  const [bivariateY, setBivariateY] = useState<string>("");

  // Data table search
  const [searchQuery, setSearchQuery] = useState("");
  const [tablePage, setTablePage] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ensure datasets list is loaded
  useEffect(() => {
    if (!datasets.length) {
      api.datasets().then(setDatasets).catch(() => undefined);
    }
  }, [datasets.length, setDatasets]);

  const activeDataset = useMemo(
    () => datasets.find((d) => d.id === activeDatasetId) ?? datasets[0] ?? null,
    [datasets, activeDatasetId]
  );

  const datasetId = activeDataset?.id ?? null;

  // Automated profiling and EDA pipeline runner
  const runAutoEDA = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const [prof, prev] = await Promise.all([
        api.profile(id),
        api.preview(id, { limit: 100 }),
      ]);
      setProfile(prof);
      setPreview(prev);

      // Default univariate selectors
      const numCols = prof.columns.filter((c) => c.kind === "numeric");
      const catCols = prof.columns.filter((c) => c.kind === "categorical" || c.kind === "boolean");
      if (numCols.length > 0) setSelectedNumCol(numCols[0].name);
      if (catCols.length > 0) setSelectedCatCol(catCols[0].name);

      // Default bivariate selectors
      if (numCols.length >= 2) {
        setBivariateX(numCols[0].name);
        setBivariateY(numCols[1].name);
      } else if (numCols.length === 1 && catCols.length > 0) {
        setBivariateX(catCols[0].name);
        setBivariateY(numCols[0].name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute automated EDA pipeline.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (datasetId) {
      void runAutoEDA(datasetId);
    } else {
      setProfile(null);
      setPreview(null);
      setLoading(false);
    }
  }, [datasetId]);

  // Automated Upload & EDA Execution Flow
  const handleUploadFile = async (file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file format: ${file.name}. Supported formats: CSV, Excel (.xlsx, .xls), JSON, Parquet.`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      // Step 1 & 2: Detect, validate and load file into memory via backend
      const uploaded = await api.upload(file);
      const list = await api.datasets();
      setDatasets(list);
      setActive(uploaded.id);

      // Step 3, 4, 5: Automatically run profiling and full EDA pipeline immediately
      await runAutoEDA(uploaded.id);
      setActiveSection("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload or automated EDA pipeline failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleUploadFile(file);
  };

  const handleLoadSample = async (sampleId: string) => {
    try {
      setLoading(true);
      const loaded = await api.loadSample(sampleId);
      const list = await api.datasets();
      setDatasets(list);
      setActive(loaded.id);
      await runAutoEDA(loaded.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sample dataset");
    } finally {
      setLoading(false);
    }
  };

  // Live Metrics derived from active calibrated profile
  const stats = useMemo(() => {
    if (!profile) return null;
    const totalCells = profile.total_cells || profile.row_count * profile.col_count || 1;
    const missingCells = profile.total_missing_cells || 0;
    const healthScore = profile.health_score ?? Math.round(((totalCells - missingCells) / totalCells) * 100);

    const numericCols = profile.columns.filter((c) => c.kind === "numeric");
    const categoricalCols = profile.columns.filter((c) => c.kind === "categorical");
    const datetimeCols = profile.columns.filter((c) => c.kind === "datetime");
    const booleanCols = profile.columns.filter((c) => c.kind === "boolean");

    const memFormatted =
      profile.memory_usage_bytes > 1024 * 1024
        ? `${(profile.memory_usage_bytes / (1024 * 1024)).toFixed(2)} MB`
        : `${Math.round(profile.memory_usage_bytes / 1024)} KB`;

    return {
      rowCount: profile.row_count,
      colCount: profile.col_count,
      totalCells,
      missingCells,
      missingPct: profile.missing_pct,
      healthScore,
      healthSummary: profile.health_summary || "Healthy",
      numericCols,
      categoricalCols,
      datetimeCols,
      booleanCols,
      duplicateRows: profile.duplicate_rows,
      memory: memFormatted,
      fileType: profile.file_type || "csv",
      detectedTarget: profile.detected_target,
      constantCols: profile.constant_columns || [],
      nearConstantCols: profile.near_constant_columns || [],
      qualityWarnings: profile.quality_warnings || [],
      outliers: profile.outlier_summary || [],
      totalOutliers: profile.total_outliers || 0,
      insights: profile.insights || { factual_findings: [], recommendations: [] },
      agentSummary: profile.agent_summary,
    };
  }, [profile]);

  // Selected column profiles
  const activeNumColProfile = useMemo(
    () => profile?.columns.find((c) => c.name === selectedNumCol) || null,
    [profile, selectedNumCol]
  );

  const activeCatColProfile = useMemo(
    () => profile?.columns.find((c) => c.name === selectedCatCol) || null,
    [profile, selectedCatCol]
  );

  // ── Plotly Visual EDA Figures ──

  // 1. Overview Schema Donut
  const schemaDonutFigure = useMemo(() => {
    if (!stats) return null;
    return {
      data: [
        {
          type: "pie",
          hole: 0.65,
          labels: ["Numerical", "Categorical", "Datetime", "Boolean"],
          values: [
            stats.numericCols.length,
            stats.categoricalCols.length,
            stats.datetimeCols.length,
            stats.booleanCols.length,
          ],
          marker: {
            colors: ["#3b82f6", "#a855f7", "#f59e0b", "#10b981"],
          },
          textinfo: "label+value",
          textposition: "outside",
        },
      ],
      layout: {
        title: { text: "Column Type Composition", font: { size: 12, color: "var(--text)" } },
        margin: { t: 30, l: 20, r: 20, b: 20 },
        height: 280,
        paper_bgcolor: "transparent",
        showlegend: false,
        annotations: [
          {
            text: `<b>${stats.colCount}</b><br><span style="font-size:10px">Cols</span>`,
            showarrow: false,
            font: { size: 14, color: "var(--text)" },
          },
        ],
      },
    };
  }, [stats]);

  // 2. Data Quality Missing Values Bar Plot
  const missingBarFigure = useMemo(() => {
    if (!profile?.missing_by_col) return null;
    const missingOnly = profile.missing_by_col.filter((c) => c.missing_count > 0);
    const displayList = missingOnly.length > 0 ? missingOnly : profile.missing_by_col.slice(0, 15);
    const cols = displayList.map((c) => c.column);
    const counts = displayList.map((c) => c.missing_count);
    const pcts = displayList.map((c) => c.missing_pct);

    return {
      data: [
        {
          type: "bar",
          x: cols,
          y: counts,
          text: pcts.map((p) => `${p}%`),
          textposition: "auto",
          marker: {
            color: counts.map((c) => (c > 0 ? "#ef4444" : "#22c55e")),
          },
        },
      ],
      layout: {
        title: {
          text: missingOnly.length > 0 ? "Missing Values per Column" : "Missingness per Column (All Complete: 0 Nulls)",
          font: { size: 12, color: "var(--text)" },
        },
        xaxis: { tickangle: -30, automargin: true },
        yaxis: { title: "Missing Count", gridcolor: "var(--border)" },
        margin: { t: 35, l: 50, r: 20, b: 60 },
        height: 300,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
      },
    };
  }, [profile]);

  // 3. Univariate Numerical: Histogram with Box/Violin
  const univariateNumFigure = useMemo(() => {
    if (!preview?.rows.length || !selectedNumCol) return null;
    const values = preview.rows
      .map((r) => Number(r[selectedNumCol]))
      .filter((v) => !isNaN(v) && v !== null);

    if (!values.length) return null;

    return {
      data: [
        {
          type: "histogram",
          x: values,
          name: "Distribution",
          nbinsx: 25,
          marker: { color: "rgba(59, 130, 246, 0.7)", line: { color: "#2563eb", width: 1 } },
        },
      ],
      layout: {
        title: { text: `Histogram & Distribution: ${selectedNumCol}`, font: { size: 12, color: "var(--text)" } },
        xaxis: { title: selectedNumCol, gridcolor: "var(--border)" },
        yaxis: { title: "Frequency", gridcolor: "var(--border)" },
        margin: { t: 35, l: 50, r: 20, b: 40 },
        height: 290,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
      },
    };
  }, [preview, selectedNumCol]);

  // 4. Univariate Numerical Box / Outlier Plot
  const univariateBoxFigure = useMemo(() => {
    if (!preview?.rows.length || !selectedNumCol) return null;
    const values = preview.rows
      .map((r) => Number(r[selectedNumCol]))
      .filter((v) => !isNaN(v) && v !== null);

    return {
      data: [
        {
          type: "box",
          y: values,
          name: selectedNumCol,
          boxpoints: "outliers",
          marker: { color: "#ec4899", size: 5 },
          line: { width: 1.5 },
        },
      ],
      layout: {
        title: { text: `Box & Outlier Plot: ${selectedNumCol}`, font: { size: 12, color: "var(--text)" } },
        yaxis: { title: "Value", gridcolor: "var(--border)" },
        margin: { t: 35, l: 50, r: 20, b: 40 },
        height: 290,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
      },
    };
  }, [preview, selectedNumCol]);

  // 5. Univariate Categorical: Count / Frequency Bar
  const univariateCatFigure = useMemo(() => {
    if (!preview?.rows.length || !selectedCatCol) return null;
    const counts: Record<string, number> = {};
    for (const r of preview.rows) {
      const val = String(r[selectedCatCol] ?? "null");
      counts[val] = (counts[val] || 0) + 1;
    }
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    return {
      data: [
        {
          type: "bar",
          x: entries.map((e) => e[0]),
          y: entries.map((e) => e[1]),
          marker: { color: "#a855f7" },
          text: entries.map((e) => String(e[1])),
          textposition: "auto",
        },
      ],
      layout: {
        title: { text: `Frequency Distribution: ${selectedCatCol}`, font: { size: 12, color: "var(--text)" } },
        xaxis: { tickangle: -25, automargin: true },
        yaxis: { title: "Count", gridcolor: "var(--border)" },
        margin: { t: 35, l: 50, r: 20, b: 60 },
        height: 290,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
      },
    };
  }, [preview, selectedCatCol]);

  // 6. Bivariate Scatter Plot
  const bivariateScatterFigure = useMemo(() => {
    if (!preview?.rows.length || !bivariateX || !bivariateY) return null;
    const xVals = preview.rows.map((r) => r[bivariateX]);
    const yVals = preview.rows.map((r) => Number(r[bivariateY]) || 0);

    return {
      data: [
        {
          type: "scatter",
          mode: "markers",
          x: xVals,
          y: yVals,
          marker: {
            size: 6,
            color: "rgba(59, 130, 246, 0.75)",
            line: { color: "#1d4ed8", width: 1 },
          },
        },
      ],
      layout: {
        title: {
          text: `Bivariate Analysis: ${bivariateX} vs ${bivariateY}`,
          font: { size: 12, color: "var(--text)" },
        },
        xaxis: { title: bivariateX, gridcolor: "var(--border)" },
        yaxis: { title: bivariateY, gridcolor: "var(--border)" },
        margin: { t: 35, l: 55, r: 20, b: 50 },
        height: 320,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
      },
    };
  }, [preview, bivariateX, bivariateY]);

  // 7. Target Variable Relationship Figure (if detected)
  const targetRelationshipFigure = useMemo(() => {
    if (!preview?.rows.length || !stats?.detectedTarget || !selectedNumCol) return null;
    const targetCol = stats.detectedTarget;
    if (targetCol === selectedNumCol) return null;

    return {
      data: [
        {
          type: "box",
          x: preview.rows.map((r) => String(r[targetCol] ?? "null")),
          y: preview.rows.map((r) => Number(r[selectedNumCol]) || 0),
          color: "#06b6d4",
          boxpoints: "outliers",
        },
      ],
      layout: {
        title: {
          text: `Target Relationship: ${selectedNumCol} by ${targetCol}`,
          font: { size: 12, color: "var(--text)" },
        },
        xaxis: { title: `Target (${targetCol})` },
        yaxis: { title: selectedNumCol, gridcolor: "var(--border)" },
        margin: { t: 35, l: 55, r: 20, b: 50 },
        height: 320,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
      },
    };
  }, [preview, stats?.detectedTarget, selectedNumCol]);

  // 8. Correlation Heatmap Matrix
  const correlationHeatmapFigure = useMemo(() => {
    if (!profile?.correlations) return null;
    const { columns, z } = profile.correlations;
    return {
      data: [
        {
          type: "heatmap",
          z,
          x: columns,
          y: columns,
          colorscale: "Blues",
          hoverongaps: false,
        },
      ],
      layout: {
        title: { text: "Pearson Correlation Matrix", font: { size: 12, color: "var(--text)" } },
        margin: { t: 35, l: 80, r: 30, b: 80 },
        height: 380,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
      },
    };
  }, [profile]);

  // Filtered live preview rows for data table
  const filteredRows = useMemo(() => {
    if (!preview?.rows) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return preview.rows;
    return preview.rows.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [preview, searchQuery]);

  const pagedRows = useMemo(() => {
    const start = tablePage * 20;
    return filteredRows.slice(start, start + 20);
  }, [filteredRows, tablePage]);

  if (dashboardMode === "powerbi") {
    return (
      <div style={{ padding: "10px 16px 24px", width: "100%" }}>
        {error && <div className="error-banner" style={{ marginBottom: 10 }}>{error}</div>}
        <PowerBiDashboard
          dataset={activeDataset}
          datasets={datasets}
          profile={profile}
          preview={preview}
          loading={loading || refreshing}
          onSelectDataset={(id) => {
            void api
              .setActive(id)
              .then(() => {
                setActive(id);
                return api.datasets();
              })
              .then(setDatasets);
          }}
          onUploadFile={handleUploadFile}
          onLoadSample={handleLoadSample}
          onRefresh={() => {
            if (datasetId) {
              setRefreshing(true);
              void runAutoEDA(datasetId);
            }
          }}
          onToggleEdaMode={() => setDashboardMode("eda")}
          onSwitchToStudio={() => setDashboardMode("studio")}
        />
      </div>
    );
  }

  if (dashboardMode === "studio") {
    return (
      <div style={{ padding: "10px 16px 24px", width: "100%" }}>
        {error && <div className="error-banner" style={{ marginBottom: 10 }}>{error}</div>}
        <GraphicWalkerBoard
          dataset={activeDataset}
          preview={preview}
          profile={profile}
          onSwitchToPowerBi={() => setDashboardMode("powerbi")}
          onSwitchToEda={() => setDashboardMode("eda")}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* ── 1. AUTOMATED UPLOAD & WORKFLOW DROP ZONE ── */}
      <div
        className={`dashboard-upload-zone ${isDragging ? "is-dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        title="Upload CSV, Excel, JSON, or Parquet dataset for automated EDA"
      >
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept=".csv,.tsv,.json,.parquet,.xlsx,.xls"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUploadFile(file);
            e.currentTarget.value = "";
          }}
        />
        <div className="dashboard-upload-left">
          <div className="dashboard-upload-icon">
            {uploading ? <LoaderCircle className="spin" size={18} /> : <Upload size={18} />}
          </div>
          <div className="dashboard-upload-text">
            <strong>
              {uploading
                ? "Validating file & running automated EDA pipeline…"
                : "Upload dataset for instant automated EDA pipeline"}
            </strong>
            <span>
              Supports CSV, Excel (.xlsx/.xls), JSON, and Parquet. Automatically detects schema, profiles health, and computes statistics.
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="rail-btn small primary"
            disabled={uploading}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <Upload size={12} />
            <span>{uploading ? "Analyzing…" : "Choose File"}</span>
          </button>

          {activeDataset && (
            <button
              type="button"
              className="rail-btn small"
              onClick={(e) => {
                e.stopPropagation();
                if (datasetId) {
                  setRefreshing(true);
                  void runAutoEDA(datasetId);
                }
              }}
              disabled={refreshing || loading}
              title="Refresh automated EDA"
            >
              <RefreshCw size={12} className={refreshing ? "spin" : ""} />
              <span>Rerun EDA</span>
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* ── 2. DATASET SELECTOR & HEADER ── */}
      <div className="dashboard-header" style={{ marginBottom: 0 }}>
        <div className="dashboard-title-group">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h1>Automated EDA &amp; Intelligence Dashboard</h1>
            {stats && (
              <span className={`dashboard-badge-pill ${stats.healthScore >= 90 ? "success" : "warning"}`}>
                {stats.healthScore}% {stats.healthSummary}
              </span>
            )}
          </div>
          <p>
            Zero-config exploratory data analysis pipeline running automatically on uploaded data.
          </p>
        </div>

        <div className="dashboard-header-actions">
          {/* Active Dataset Select */}
          <div className="dashboard-select-badge">
            <Database size={13} style={{ color: "var(--accent-blue)" }} />
            <select
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text)",
                outline: "none",
                fontWeight: 600,
                cursor: "pointer",
              }}
              value={activeDataset?.id || ""}
              onChange={(e) => {
                const id = e.target.value;
                if (id) {
                  void api.setActive(id).then(() => {
                    setActive(id);
                    return api.datasets();
                  }).then(setDatasets);
                }
              }}
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.stage.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="rail-btn small primary"
            onClick={() => setDashboardMode("powerbi")}
            title="Switch to Power BI Studio View"
          >
            <BarChart3 size={12} />
            <span>Power BI Canvas</span>
          </button>

          <button
            type="button"
            className="rail-btn small"
            onClick={() => setDashboardMode("studio")}
            title="Switch to GraphicWalker Drag-and-Drop Visual Studio"
          >
            <Grid size={12} style={{ color: "#f59e0b" }} />
            <span>Visual Studio</span>
          </button>

          {activeDataset && (
            <a
              href={`/api/datasets/${activeDataset.id}/download?format=csv`}
              className="rail-btn small"
              title="Export CSV"
            >
              <Download size={12} />
              <span>Export CSV</span>
            </a>
          )}
        </div>
      </div>

      {/* ── 3. 8 DASHBOARD SECTION TABS ── */}
      <div className="dashboard-section-tabs">
        {[
          { id: "overview", label: "1. Overview", icon: Layers },
          { id: "quality", label: "2. Data Quality", icon: ShieldCheck },
          { id: "univariate", label: "3. Univariate Analysis", icon: BarChart3 },
          { id: "bivariate", label: "4. Bivariate Analysis", icon: Activity },
          { id: "correlation", label: "5. Correlation", icon: TrendingUp },
          { id: "outliers", label: "6. Outlier Analysis", icon: AlertTriangle },
          { id: "insights", label: "7. Automated Insights", icon: Lightbulb },
          { id: "data", label: "8. Data Inspection", icon: TableProperties },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`dashboard-section-tab ${isActive ? "active" : ""}`}
              onClick={() => setActiveSection(tab.id as any)}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── SECTION 1: OVERVIEW ── */}
      {activeSection === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Summary KPI Cards Grid */}
          <div className="dashboard-kpi-grid">
            {loading || !stats ? (
              <>
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
              </>
            ) : (
              <>
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-top">
                    <span className="dashboard-kpi-title">Total Records</span>
                    <div className="dashboard-kpi-icon-wrap" style={{ background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6" }}>
                      <Layers size={16} />
                    </div>
                  </div>
                  <div className="dashboard-kpi-value">{stats.rowCount.toLocaleString()}</div>
                  <div className="dashboard-kpi-sub">
                    <span className="dashboard-badge-trend info">{stats.fileType.toUpperCase()}</span>
                    <span>Loaded in-memory</span>
                  </div>
                </div>

                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-top">
                    <span className="dashboard-kpi-title">Features &amp; Cols</span>
                    <div className="dashboard-kpi-icon-wrap" style={{ background: "rgba(168, 85, 247, 0.12)", color: "#a855f7" }}>
                      <BarChart3 size={16} />
                    </div>
                  </div>
                  <div className="dashboard-kpi-value">{stats.colCount}</div>
                  <div className="dashboard-kpi-sub">
                    <span className="dashboard-badge-trend info">
                      {stats.numericCols.length} num · {stats.categoricalCols.length} cat
                    </span>
                  </div>
                </div>

                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-top">
                    <span className="dashboard-kpi-title">Health Score</span>
                    <div
                      className="dashboard-kpi-icon-wrap"
                      style={{
                        background: stats.healthScore >= 90 ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                        color: stats.healthScore >= 90 ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {stats.healthScore >= 90 ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                    </div>
                  </div>
                  <div className="dashboard-kpi-value">{stats.healthScore}%</div>
                  <div className="dashboard-kpi-sub">
                    <span className={`dashboard-badge-trend ${stats.healthScore >= 90 ? "success" : "warning"}`}>
                      {stats.healthSummary}
                    </span>
                    <span>Quality rating</span>
                  </div>
                </div>

                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-top">
                    <span className="dashboard-kpi-title">Missing Cells</span>
                    <div
                      className="dashboard-kpi-icon-wrap"
                      style={{
                        background: stats.missingCells > 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(34, 197, 94, 0.12)",
                        color: stats.missingCells > 0 ? "#ef4444" : "#22c55e",
                      }}
                    >
                      {stats.missingCells > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                    </div>
                  </div>
                  <div className="dashboard-kpi-value">{stats.missingCells.toLocaleString()}</div>
                  <div className="dashboard-kpi-sub">
                    <span className={`dashboard-badge-trend ${stats.missingCells > 0 ? "danger" : "success"}`}>
                      {stats.missingPct.toFixed(1)}%
                    </span>
                    <span>Total missingness</span>
                  </div>
                </div>

                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-top">
                    <span className="dashboard-kpi-title">Target &amp; Memory</span>
                    <div className="dashboard-kpi-icon-wrap" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }}>
                      <Target size={16} />
                    </div>
                  </div>
                  <div className="dashboard-kpi-value" style={{ fontSize: 18 }}>
                    {stats.detectedTarget || "None detected"}
                  </div>
                  <div className="dashboard-kpi-sub">
                    <span>{stats.memory}</span>
                    <span>· {stats.duplicateRows} duplicates</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Overview Visualizations */}
          <div className="dashboard-charts-grid">
            <div className="dashboard-chart-card">
              <div className="dashboard-chart-header">
                <div>
                  <h3 className="dashboard-chart-title">Schema &amp; Attribute Types</h3>
                  <span className="dashboard-chart-subtitle">Distribution of feature semantics</span>
                </div>
              </div>
              {loading || !schemaDonutFigure ? <ChartSkeleton height={280} /> : <PlotlyChart figure={schemaDonutFigure} />}
            </div>

            <div className="dashboard-chart-card">
              <div className="dashboard-chart-header">
                <div>
                  <h3 className="dashboard-chart-title">Automated Insights Preview</h3>
                  <span className="dashboard-chart-subtitle">Key findings detected by automated EDA pipeline</span>
                </div>
                <button
                  type="button"
                  className="rail-btn small"
                  onClick={() => setActiveSection("insights")}
                >
                  <span>View All ({stats?.insights.factual_findings.length || 0})</span>
                </button>
              </div>

              <div className="dashboard-insight-list" style={{ marginTop: 8 }}>
                {stats?.insights.factual_findings.slice(0, 4).map((f, i) => (
                  <div key={i} className="dashboard-insight-item finding">
                    <Info size={14} className="dashboard-insight-icon" style={{ color: "#3b82f6" }} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 2: DATA QUALITY ANALYSIS ── */}
      {activeSection === "quality" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {stats?.qualityWarnings.length ? (
            <div className="dashboard-insight-panel" style={{ borderLeft: "4px solid #f59e0b" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={16} style={{ color: "#f59e0b" }} />
                <h4 style={{ margin: 0, fontSize: 13, color: "var(--text)" }}>
                  Data Quality Warnings ({stats.qualityWarnings.length})
                </h4>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {stats.qualityWarnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 11, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="dashboard-charts-grid">
            <div className="dashboard-chart-card">
              <div className="dashboard-chart-header">
                <div>
                  <h3 className="dashboard-chart-title">Missing Values per Column</h3>
                  <span className="dashboard-chart-subtitle">Null counts and percentages</span>
                </div>
              </div>
              {loading || !missingBarFigure ? <ChartSkeleton height={300} /> : <PlotlyChart figure={missingBarFigure} />}
            </div>

            <div className="dashboard-chart-card">
              <div className="dashboard-chart-header">
                <div>
                  <h3 className="dashboard-chart-title">Quality Metrics Breakdown</h3>
                  <span className="dashboard-chart-subtitle">Duplicates, constant &amp; near-constant columns</span>
                </div>
              </div>

              <div className="dashboard-stats-grid">
                <div className="dashboard-stat-box">
                  <span>Duplicate Rows</span>
                  <strong style={{ color: (stats?.duplicateRows || 0) > 0 ? "var(--danger)" : "var(--success)" }}>
                    {stats?.duplicateRows.toLocaleString() || 0}
                  </strong>
                </div>
                <div className="dashboard-stat-box">
                  <span>Constant Cols</span>
                  <strong style={{ color: (stats?.constantCols.length || 0) > 0 ? "var(--danger)" : "var(--success)" }}>
                    {stats?.constantCols.length || 0}
                  </strong>
                </div>
                <div className="dashboard-stat-box">
                  <span>Near-Constant Cols</span>
                  <strong style={{ color: (stats?.nearConstantCols.length || 0) > 0 ? "var(--warning)" : "var(--success)" }}>
                    {stats?.nearConstantCols.length || 0}
                  </strong>
                </div>
                <div className="dashboard-stat-box">
                  <span>Total Outliers</span>
                  <strong style={{ color: (stats?.totalOutliers || 0) > 0 ? "var(--warning)" : "var(--success)" }}>
                    {stats?.totalOutliers.toLocaleString() || 0}
                  </strong>
                </div>
              </div>

              {stats?.constantCols.length ? (
                <div style={{ marginTop: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                    Constant Columns (Zero Variance):
                  </span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {stats.constantCols.map((c) => (
                      <span key={c} className="stage-tag warning mono">{c}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              {stats?.nearConstantCols.length ? (
                <div style={{ marginTop: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                    Near-Constant Columns (&gt;95% single value):
                  </span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {stats.nearConstantCols.map((c) => (
                      <span key={c} className="stage-tag info mono">{c}</span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 3: UNIVARIATE ANALYSIS ── */}
      {activeSection === "univariate" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Numerical Univariate Analysis */}
          <div className="dashboard-chart-card">
            <div className="dashboard-chart-header">
              <div>
                <h3 className="dashboard-chart-title">Numerical Feature Distributions &amp; Statistics</h3>
                <span className="dashboard-chart-subtitle">Select a numerical feature to inspect distribution, box plot, and statistical moments</span>
              </div>
              <select
                className="rail-select small mono"
                value={selectedNumCol}
                onChange={(e) => setSelectedNumCol(e.target.value)}
              >
                {stats?.numericCols.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {activeNumColProfile && (
              <div className="dashboard-stats-grid" style={{ marginBottom: 12 }}>
                <div className="dashboard-stat-box"><span>Mean</span><strong>{activeNumColProfile.mean_val ?? "N/A"}</strong></div>
                <div className="dashboard-stat-box"><span>Median</span><strong>{activeNumColProfile.median_val ?? "N/A"}</strong></div>
                <div className="dashboard-stat-box"><span>Mode</span><strong>{String(activeNumColProfile.mode_val ?? "N/A")}</strong></div>
                <div className="dashboard-stat-box"><span>Std Dev</span><strong>{activeNumColProfile.std_val ?? "N/A"}</strong></div>
                <div className="dashboard-stat-box"><span>Variance</span><strong>{activeNumColProfile.variance_val ?? "N/A"}</strong></div>
                <div className="dashboard-stat-box"><span>Min / Max</span><strong>{activeNumColProfile.min_val} / {activeNumColProfile.max_val}</strong></div>
                <div className="dashboard-stat-box"><span>IQR (Q75 - Q25)</span><strong>{activeNumColProfile.iqr ?? "N/A"}</strong></div>
                <div className="dashboard-stat-box"><span>Skewness</span><strong>{activeNumColProfile.skewness ?? "N/A"}</strong></div>
                <div className="dashboard-stat-box"><span>Kurtosis</span><strong>{activeNumColProfile.kurtosis ?? "N/A"}</strong></div>
                <div className="dashboard-stat-box"><span>Outliers</span><strong>{activeNumColProfile.outliers_count ?? 0}</strong></div>
              </div>
            )}

            <div className="dashboard-charts-grid" style={{ minHeight: 290 }}>
              <div>{univariateNumFigure ? <PlotlyChart figure={univariateNumFigure} /> : null}</div>
              <div>{univariateBoxFigure ? <PlotlyChart figure={univariateBoxFigure} /> : null}</div>
            </div>
          </div>

          {/* Categorical Univariate Analysis */}
          {stats?.categoricalCols.length ? (
            <div className="dashboard-chart-card">
              <div className="dashboard-chart-header">
                <div>
                  <h3 className="dashboard-chart-title">Categorical Feature Distributions</h3>
                  <span className="dashboard-chart-subtitle">Frequency breakdown, cardinality, and rare categories</span>
                </div>
                <select
                  className="rail-select small mono"
                  value={selectedCatCol}
                  onChange={(e) => setSelectedCatCol(e.target.value)}
                >
                  {stats?.categoricalCols.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {activeCatColProfile && (
                <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap", fontSize: 11 }}>
                  <span><strong>Cardinality:</strong> {activeCatColProfile.unique_count} unique values</span>
                  <span><strong>Mode:</strong> {String(activeCatColProfile.mode_val ?? "N/A")}</span>
                  <span><strong>Missing:</strong> {activeCatColProfile.null_pct}%</span>
                </div>
              )}

              {univariateCatFigure ? <PlotlyChart figure={univariateCatFigure} /> : null}
            </div>
          ) : null}
        </div>
      )}

      {/* ── SECTION 4: BIVARIATE ANALYSIS ── */}
      {activeSection === "bivariate" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="dashboard-chart-card">
            <div className="dashboard-chart-header">
              <div>
                <h3 className="dashboard-chart-title">Bivariate Relationship &amp; Scatter Analysis</h3>
                <span className="dashboard-chart-subtitle">Examine cross-feature interaction and co-variation</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  className="rail-select small mono"
                  value={bivariateX}
                  onChange={(e) => setBivariateX(e.target.value)}
                >
                  {profile?.columns.map((c) => (
                    <option key={c.name} value={c.name}>X: {c.name}</option>
                  ))}
                </select>
                <select
                  className="rail-select small mono"
                  value={bivariateY}
                  onChange={(e) => setBivariateY(e.target.value)}
                >
                  {stats?.numericCols.map((c) => (
                    <option key={c.name} value={c.name}>Y: {c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {bivariateScatterFigure ? <PlotlyChart figure={bivariateScatterFigure} /> : null}
          </div>

          {targetRelationshipFigure && stats?.detectedTarget ? (
            <div className="dashboard-chart-card">
              <div className="dashboard-chart-header">
                <div>
                  <h3 className="dashboard-chart-title">Target Variable Relationship ({stats.detectedTarget})</h3>
                  <span className="dashboard-chart-subtitle">Behavior of {selectedNumCol} across target classes</span>
                </div>
              </div>
              <PlotlyChart figure={targetRelationshipFigure} />
            </div>
          ) : null}
        </div>
      )}

      {/* ── SECTION 5: CORRELATION & RELATIONSHIPS ── */}
      {activeSection === "correlation" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="dashboard-chart-card">
            <div className="dashboard-chart-header">
              <div>
                <h3 className="dashboard-chart-title">Feature Correlation Matrix (Pearson r)</h3>
                <span className="dashboard-chart-subtitle">Pairwise correlation between all continuous features</span>
              </div>
            </div>
            {correlationHeatmapFigure ? <PlotlyChart figure={correlationHeatmapFigure} /> : (
              <p className="mono" style={{ padding: 20, color: "var(--text-dim)" }}>
                Not enough numerical features to calculate correlation matrix.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── SECTION 6: OUTLIER ANALYSIS ── */}
      {activeSection === "outliers" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="dashboard-table-card">
            <div className="dashboard-table-header">
              <div>
                <h3 className="dashboard-chart-title">
                  Outlier Detection Summary ({stats?.totalOutliers.toLocaleString() || 0} Total Outliers)
                </h3>
                <span className="dashboard-chart-subtitle">
                  Calculated using Tukey&apos;s 1.5×IQR fences [Q25 - 1.5×IQR, Q75 + 1.5×IQR]
                </span>
              </div>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>COLUMN</th>
                    <th>OUTLIER COUNT</th>
                    <th>OUTLIER %</th>
                    <th>LOWER BOUND</th>
                    <th>UPPER BOUND</th>
                    <th>SEVERITY</th>
                  </tr>
                </thead>
                <tbody>
                  {!stats?.outliers.length ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 24 }}>
                        <span style={{ color: "var(--success)", fontWeight: 600 }}>
                          No significant statistical outliers detected in numerical features.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    stats.outliers.map((o) => (
                      <tr key={o.column}>
                        <td><strong>{o.column}</strong></td>
                        <td className="mono">{o.outlier_count}</td>
                        <td className="mono">{o.outlier_pct}%</td>
                        <td className="mono">{o.lower_bound ?? "N/A"}</td>
                        <td className="mono">{o.upper_bound ?? "N/A"}</td>
                        <td>
                          <span className={`stage-tag ${o.outlier_pct > 5 ? "danger" : "warning"}`}>
                            {o.outlier_pct > 5 ? "Severe" : "Moderate"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 7: AUTOMATED INSIGHTS ── */}
      {activeSection === "insights" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="dashboard-insights-grid">
            {/* Factual Findings */}
            <div className="dashboard-insight-panel">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} style={{ color: "#3b82f6" }} />
                <h3 style={{ margin: 0, fontSize: 13, color: "var(--text)" }}>
                  Factual Findings ({stats?.insights.factual_findings.length || 0})
                </h3>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                Direct statistical and schema observations computed from data.
              </p>
              <div className="dashboard-insight-list">
                {stats?.insights.factual_findings.map((f, i) => (
                  <div key={i} className="dashboard-insight-item finding">
                    <Info size={14} className="dashboard-insight-icon" style={{ color: "#3b82f6" }} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actionable Recommendations */}
            <div className="dashboard-insight-panel">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={16} style={{ color: "#10b981" }} />
                <h3 style={{ margin: 0, fontSize: 13, color: "var(--text)" }}>
                  Actionable Recommendations ({stats?.insights.recommendations.length || 0})
                </h3>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                Prescriptive next steps for cleaning, feature engineering, and modeling.
              </p>
              <div className="dashboard-insight-list">
                {stats?.insights.recommendations.map((r, i) => (
                  <div key={i} className="dashboard-insight-item recommendation">
                    <Lightbulb size={14} className="dashboard-insight-icon" style={{ color: "#10b981" }} />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Calibrated Data Agents Summary */}
          {stats?.agentSummary && (
            <div className="dashboard-chart-card">
              <div className="dashboard-chart-header">
                <div>
                  <h3 className="dashboard-chart-title">Data Agent Calibrated Narrative</h3>
                  <span className="dashboard-chart-subtitle">Synthesized from data_agnets tools</span>
                </div>
              </div>
              <pre
                className="mono"
                style={{
                  background: "var(--surface-raised)",
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 10,
                  maxHeight: 250,
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  color: "var(--text)",
                }}
              >
                {stats.agentSummary}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 8: DATA INSPECTION ── */}
      {activeSection === "data" && (
        <div className="dashboard-table-card">
          <div className="dashboard-table-header">
            <div>
              <h3 className="dashboard-chart-title">Live Dataset Records</h3>
              <span className="dashboard-chart-subtitle">
                Inspecting {preview?.total_rows.toLocaleString() || 0} total rows across {preview?.columns.length || 0} columns
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="dashboard-table-search">
                <Search size={12} style={{ color: "var(--text-dim)" }} />
                <input
                  type="text"
                  placeholder="Search live records..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setTablePage(0);
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button
                  type="button"
                  className="rail-btn small"
                  disabled={tablePage === 0}
                  onClick={() => setTablePage((p) => Math.max(0, p - 1))}
                >
                  Prev
                </button>
                <span className="mono" style={{ fontSize: 10, padding: "0 6px" }}>
                  Page {tablePage + 1} of {Math.max(1, Math.ceil(filteredRows.length / 20))}
                </span>
                <button
                  type="button"
                  className="rail-btn small"
                  disabled={(tablePage + 1) * 20 >= filteredRows.length}
                  onClick={() => setTablePage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {loading || !preview ? (
            <TableSkeleton rows={8} cols={7} />
          ) : (
            <div className="table-scroll" style={{ maxHeight: 420 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 45 }}>#</th>
                    {preview.columns.map((col) => (
                      <th key={col.name}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span>{col.name}</span>
                          <span style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "lowercase" }}>
                            {col.dtype}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td colSpan={preview.columns.length + 1} style={{ textAlign: "center", padding: 24 }}>
                        <p className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
                          No records matching filter.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
                          {tablePage * 20 + idx + 1}
                        </td>
                        {preview.columns.map((col) => {
                          const val = row[col.name];
                          const isNull = val === null || val === undefined || val === "";
                          return (
                            <td key={col.name} className="mono" style={{ fontSize: 11 }}>
                              {isNull ? (
                                <span style={{ color: "var(--danger)", opacity: 0.7 }}>null</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

