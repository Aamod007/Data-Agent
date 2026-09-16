"use client";

import { useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart2,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Grid,
  Hash,
  HelpCircle,
  Layers,
  LineChart as LineChartIcon,
  Maximize2,
  PieChart as PieChartIcon,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Sliders,
  Sparkles,
  Table as TableIcon,
  TrendingUp,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { PlotlyChart } from "@/components/plotly-chart";
import { ChartSkeleton } from "@/components/skeleton";
import type { Dataset, DatasetPreview, DatasetProfile } from "@/lib/types";

// Power BI compact number formatter (e.g. 2.30M, 38K, 286.40K)
function formatPowerBINumber(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n) || !isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 1 : 2)}K`;
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
}

// 24 Power BI Visual Type Icons
const VISUAL_ICONS = [
  { id: "stacked_bar", label: "Stacked bar chart", icon: "📊" },
  { id: "stacked_column", label: "Stacked column chart", icon: "📶" },
  { id: "clustered_bar", label: "Clustered bar chart", icon: "📉" },
  { id: "clustered_column", label: "Clustered column chart", icon: "📊" },
  { id: "percent_bar", label: "100% Stacked bar chart", icon: "📈" },
  { id: "percent_column", label: "100% Stacked column chart", icon: "📶" },
  { id: "line", label: "Line chart", icon: "📈" },
  { id: "area", label: "Area chart", icon: "⛰️" },
  { id: "stacked_area", label: "Stacked area chart", icon: "🏔️" },
  { id: "combo", label: "Line and stacked column chart", icon: "📊" },
  { id: "waterfall", label: "Waterfall chart", icon: "📶" },
  { id: "funnel", label: "Funnel chart", icon: "🔻" },
  { id: "scatter", label: "Scatter chart", icon: "⁘" },
  { id: "pie", label: "Pie chart", icon: "🥧" },
  { id: "donut", label: "Donut chart", icon: "🍩" },
  { id: "treemap", label: "Treemap", icon: "🔲" },
  { id: "map", label: "Map", icon: "🗺️" },
  { id: "gauge", label: "Gauge", icon: "⏱️" },
  { id: "card", label: "Card", icon: "🗂️" },
  { id: "multi_card", label: "Multi-row card", icon: "📋" },
  { id: "kpi", label: "KPI", icon: "🎯" },
  { id: "slicer", label: "Slicer", icon: "✂️" },
  { id: "table", label: "Table", icon: "📑" },
  { id: "matrix", label: "Matrix", icon: "🧮" },
];

interface PowerBiDashboardProps {
  dataset: Dataset | null;
  datasets: Dataset[];
  profile: DatasetProfile | null;
  preview: DatasetPreview | null;
  loading: boolean;
  onSelectDataset: (id: string) => void;
  onUploadFile: (file: File) => void;
  onLoadSample: (sampleId: string) => void;
  onRefresh: () => void;
  onToggleEdaMode: () => void;
  onSwitchToStudio?: () => void;
}

export function PowerBiDashboard({
  dataset,
  datasets,
  profile,
  preview,
  loading,
  onSelectDataset,
  onUploadFile,
  onLoadSample,
  onRefresh,
  onToggleEdaMode,
  onSwitchToStudio,
}: PowerBiDashboardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Power BI Studio State
  const [activeRibbonTab, setActiveRibbonTab] = useState<
    "File" | "Home" | "Insert" | "Modeling" | "View" | "Optimize" | "Help"
  >("Home");
  const [activePage, setActivePage] = useState("Page 1");
  const [zoomLevel, setZoomLevel] = useState(85);
  const [activeVisualId, setActiveVisualId] = useState<string>("vis-clustered-bar");
  const [selectedVisType, setSelectedVisType] = useState<string>("clustered_bar");
  const [dataSearch, setDataSearch] = useState("");
  const [tableExpanded, setTableExpanded] = useState(true);

  // Slicer State
  const [slicerColumn, setSlicerColumn] = useState<string>("");
  const [slicerValue, setSlicerValue] = useState<string>("all");

  // Custom visual overrides
  const [customX, setCustomX] = useState<string>("");
  const [customY, setCustomY] = useState<string>("");

  // Categorize columns by semantics
  const cols = useMemo(() => {
    if (!profile?.columns?.length) {
      return { numeric: [], categorical: [], datetime: [] };
    }
    const numeric = profile.columns.filter((c) => c.kind === "numeric").map((c) => c.name);
    const categorical = profile.columns
      .filter((c) => c.kind === "categorical" || c.kind === "boolean")
      .map((c) => c.name);
    const datetime = profile.columns.filter((c) => c.kind === "datetime").map((c) => c.name);
    return { numeric, categorical, datetime };
  }, [profile]);

  // Primary and secondary measures
  const primaryMeasure = customY || cols.numeric[0] || "";
  const secondaryMeasure = cols.numeric[1] || cols.numeric[0] || "";
  const tertiaryMeasure = cols.numeric[2] || cols.numeric[0] || "";

  // Dimensions
  const primaryDimension = customX || cols.categorical[0] || "";
  const secondaryDimension = cols.categorical[1] || cols.categorical[0] || "";
  const dateDimension = cols.datetime[0] || "";

  // Auto-init slicer column if not set
  useMemo(() => {
    if (!slicerColumn && (cols.categorical.length > 0 || cols.datetime.length > 0)) {
      setSlicerColumn(cols.datetime[0] || cols.categorical[0] || "");
    }
  }, [cols, slicerColumn]);

  // Slicer Options from dataset rows
  const slicerOptions = useMemo(() => {
    if (!preview?.rows?.length || !slicerColumn) return [];
    const values = new Set<string>();
    for (const r of preview.rows) {
      const v = r[slicerColumn];
      if (v !== undefined && v !== null && String(v).trim()) {
        values.add(String(v));
      }
    }
    return Array.from(values).sort().slice(0, 30);
  }, [preview, slicerColumn]);

  // Dynamically filtered rows based on Slicer selection
  const filteredRows = useMemo(() => {
    if (!preview?.rows?.length) return [];
    if (!slicerColumn || slicerValue === "all") return preview.rows;
    return preview.rows.filter((r) => String(r[slicerColumn] ?? "") === slicerValue);
  }, [preview, slicerColumn, slicerValue]);

  // ── 1. Top KPI Metrics (Power BI style: 2.30M, 38K, 286.40K, etc.) ──
  const kpiData = useMemo(() => {
    if (!filteredRows.length) {
      return {
        totalSales: "0",
        totalQty: "0",
        totalProfit: "0",
        totalOrders: "0",
        avgMargin: "0.00",
        salesLabel: "Total Metric",
        qtyLabel: "Total Units",
        profitLabel: "Secondary Metric",
      };
    }

    let sum1 = 0;
    let sum2 = 0;
    let sum3 = 0;

    for (const r of filteredRows) {
      if (primaryMeasure) sum1 += Number(r[primaryMeasure]) || 0;
      if (secondaryMeasure) sum2 += Number(r[secondaryMeasure]) || 0;
      if (tertiaryMeasure) sum3 += Number(r[tertiaryMeasure]) || 0;
    }

    const margin = sum1 > 0 ? (sum3 / sum1) * 100 : sum2 > 0 ? (sum1 / sum2) : 12.03;

    return {
      totalSales: formatPowerBINumber(sum1),
      totalQty: formatPowerBINumber(sum2 || filteredRows.length),
      totalProfit: formatPowerBINumber(sum3 || sum1 * 0.15),
      totalOrders: formatPowerBINumber(filteredRows.length),
      avgMargin: isFinite(margin) ? Math.abs(margin).toFixed(2) : "12.03",
      salesLabel: primaryMeasure ? `Total ${primaryMeasure.replace(/_/g, " ")}` : "Total Sales",
      qtyLabel: secondaryMeasure ? `Total ${secondaryMeasure.replace(/_/g, " ")}` : "Total Qty",
      profitLabel: tertiaryMeasure ? `Total ${tertiaryMeasure.replace(/_/g, " ")}` : "Total Profit",
    };
  }, [filteredRows, primaryMeasure, secondaryMeasure, tertiaryMeasure]);

  // ── 2. Matrix Visual (Cross-tab grid with row, column, and grand totals) ──
  const matrixData = useMemo(() => {
    if (!filteredRows.length) return null;
    const rowDim = primaryDimension || "Row";
    const colDim = secondaryDimension !== primaryDimension ? secondaryDimension : "Col";
    const measure = primaryMeasure || "";

    const rowMap = new Map<string, Record<string, number>>();
    const colSet = new Set<string>();

    for (const r of filteredRows) {
      const rowVal = String(r[rowDim] ?? "Other").slice(0, 15);
      const colVal = String(r[colDim] ?? "General").slice(0, 15);
      const val = measure ? Number(r[measure]) || 0 : 1;

      colSet.add(colVal);
      if (!rowMap.has(rowVal)) {
        rowMap.set(rowVal, {});
      }
      const rowObj = rowMap.get(rowVal)!;
      rowObj[colVal] = (rowObj[colVal] || 0) + val;
    }

    const colsList = Array.from(colSet).slice(0, 3);
    const rowsList = Array.from(rowMap.keys()).slice(0, 4);

    const colTotals: Record<string, number> = {};
    let grandTotal = 0;

    for (const c of colsList) colTotals[c] = 0;

    const rowsWithTotals = rowsList.map((rowName) => {
      const rowObj = rowMap.get(rowName) || {};
      let rowTotal = 0;
      const cells: Record<string, number> = {};
      for (const colName of colsList) {
        const v = rowObj[colName] || 0;
        cells[colName] = v;
        rowTotal += v;
        colTotals[colName] = (colTotals[colName] || 0) + v;
      }
      grandTotal += rowTotal;
      return { name: rowName, cells, total: rowTotal };
    });

    return {
      rowDim,
      colDim,
      colsList,
      rows: rowsWithTotals,
      colTotals,
      grandTotal,
    };
  }, [filteredRows, primaryDimension, secondaryDimension, primaryMeasure]);

  // ── 3. Visual 1: Horizontal Clustered Bar Chart (Total Profit & Sales by Dimension) ──
  const clusteredBarFigure = useMemo(() => {
    if (!filteredRows.length || !primaryDimension) return null;
    const groups: Record<string, { m1: number; m2: number }> = {};

    for (const r of filteredRows) {
      const key = String(r[primaryDimension] ?? "Unknown").slice(0, 16);
      if (!groups[key]) groups[key] = { m1: 0, m2: 0 };
      groups[key].m1 += Number(r[primaryMeasure]) || 0;
      groups[key].m2 += Number(r[secondaryMeasure]) || (Number(r[primaryMeasure]) || 0) * 0.4;
    }

    const entries = Object.entries(groups).slice(0, 6).reverse();
    const yKeys = entries.map((e) => e[0]);
    const m1Vals = entries.map((e) => Math.round(e[1].m1));
    const m2Vals = entries.map((e) => Math.round(e[1].m2));

    return {
      data: [
        {
          type: "bar",
          orientation: "h",
          name: primaryMeasure ? `Total ${primaryMeasure}` : "Total Profit",
          y: yKeys,
          x: m2Vals,
          marker: { color: "#0078d4" },
        },
        {
          type: "bar",
          orientation: "h",
          name: secondaryMeasure ? `Total ${secondaryMeasure}` : "Total Sales",
          y: yKeys,
          x: m1Vals,
          marker: { color: "#103f91" },
        },
      ],
      layout: {
        barmode: "group",
        margin: { t: 25, l: 80, r: 20, b: 35 },
        height: 230,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        legend: { orientation: "h", y: 1.15, x: 0, font: { size: 10 } },
        xaxis: { gridcolor: "#e2e8f0", tickfont: { size: 9 } },
        yaxis: { automargin: true, tickfont: { size: 10 } },
      },
    };
  }, [filteredRows, primaryDimension, primaryMeasure, secondaryMeasure]);

  // ── 4. Visual 2: Donut Chart (Total Sales by Segment) ──
  const donutSegmentFigure = useMemo(() => {
    if (!filteredRows.length || !primaryDimension) return null;
    const counts: Record<string, number> = {};

    for (const r of filteredRows) {
      const key = String(r[primaryDimension] ?? "Other").slice(0, 15);
      counts[key] = (counts[key] || 0) + (Number(r[primaryMeasure]) || 1);
    }

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      data: [
        {
          type: "pie",
          hole: 0.55,
          labels: entries.map((e) => e[0]),
          values: entries.map((e) => Math.round(e[1])),
          marker: {
            colors: ["#103f91", "#0078d4", "#d83b01", "#008272", "#7160e8"],
          },
          textinfo: "percent",
          textposition: "inside",
          hoverinfo: "label+value+percent",
        },
      ],
      layout: {
        margin: { t: 15, l: 15, r: 15, b: 15 },
        height: 230,
        paper_bgcolor: "transparent",
        showlegend: true,
        legend: { orientation: "v", x: 1.0, y: 0.5, font: { size: 9 } },
      },
    };
  }, [filteredRows, primaryDimension, primaryMeasure]);

  // ── 5. Visual 3: Trend Line Chart (Total Sales and Total Profit by Year/Time) ──
  const trendLineFigure = useMemo(() => {
    if (!filteredRows.length) return null;
    const timeCol = dateDimension || primaryDimension || "index";
    const groups: Record<string, { s1: number; s2: number }> = {};

    filteredRows.forEach((r, idx) => {
      const raw = timeCol === "index" ? `Step ${idx + 1}` : String(r[timeCol] ?? `T${idx}`);
      const key = raw.length > 10 ? raw.slice(0, 10) : raw;
      if (!groups[key]) groups[key] = { s1: 0, s2: 0 };
      groups[key].s1 += Number(r[primaryMeasure]) || (idx + 1) * 10;
      groups[key].s2 += Number(r[secondaryMeasure]) || (idx + 1) * 4;
    });

    const entries = Object.entries(groups).slice(0, 12);
    const xVals = entries.map((e) => e[0]);
    const y1Vals = entries.map((e) => Math.round(e[1].s1));
    const y2Vals = entries.map((e) => Math.round(e[1].s2));

    return {
      data: [
        {
          type: "scatter",
          mode: "lines+markers",
          name: primaryMeasure ? `Total ${primaryMeasure}` : "Total Sales",
          x: xVals,
          y: y1Vals,
          line: { color: "#0078d4", width: 2.5 },
          marker: { size: 5, color: "#0078d4" },
        },
        {
          type: "scatter",
          mode: "lines+markers",
          name: secondaryMeasure ? `Total ${secondaryMeasure}` : "Total Profit",
          x: xVals,
          y: y2Vals,
          line: { color: "#103f91", width: 2 },
          marker: { size: 5, color: "#103f91" },
        },
      ],
      layout: {
        margin: { t: 25, l: 45, r: 20, b: 35 },
        height: 230,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        legend: { orientation: "h", y: 1.15, x: 0, font: { size: 10 } },
        xaxis: { gridcolor: "#e2e8f0", tickfont: { size: 9 } },
        yaxis: { gridcolor: "#e2e8f0", tickfont: { size: 9 } },
      },
    };
  }, [filteredRows, dateDimension, primaryDimension, primaryMeasure, secondaryMeasure]);

  // ── 6. Visual 4: Donut Chart (Total Sales by Category) ──
  const donutCategoryFigure = useMemo(() => {
    if (!filteredRows.length) return null;
    const catCol = secondaryDimension || primaryDimension;
    if (!catCol) return null;
    const counts: Record<string, number> = {};

    for (const r of filteredRows) {
      const key = String(r[catCol] ?? "General").slice(0, 16);
      counts[key] = (counts[key] || 0) + (Number(r[primaryMeasure]) || 1);
    }

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);

    return {
      data: [
        {
          type: "pie",
          hole: 0.65,
          labels: entries.map((e) => e[0]),
          values: entries.map((e) => Math.round(e[1])),
          marker: {
            colors: ["#0078d4", "#d83b01", "#f2c811", "#008272"],
          },
          textinfo: "percent",
          textposition: "outside",
          hoverinfo: "label+value",
        },
      ],
      layout: {
        margin: { t: 15, l: 15, r: 15, b: 15 },
        height: 230,
        paper_bgcolor: "transparent",
        showlegend: true,
        legend: { orientation: "v", x: 1.0, y: 0.5, font: { size: 9 } },
      },
    };
  }, [filteredRows, secondaryDimension, primaryDimension, primaryMeasure]);

  // ── 7. Visual 5: Clustered Column Chart (Total Profit & Sales by Region) ──
  const clusteredColumnFigure = useMemo(() => {
    if (!filteredRows.length) return null;
    const dim = primaryDimension || "Region";
    const groups: Record<string, { m1: number; m2: number }> = {};

    for (const r of filteredRows) {
      const key = String(r[dim] ?? "Region").slice(0, 12);
      if (!groups[key]) groups[key] = { m1: 0, m2: 0 };
      groups[key].m1 += Number(r[primaryMeasure]) || 0;
      groups[key].m2 += Number(r[secondaryMeasure]) || (Number(r[primaryMeasure]) || 0) * 0.35;
    }

    const entries = Object.entries(groups).slice(0, 5);
    const xKeys = entries.map((e) => e[0]);
    const m1Vals = entries.map((e) => Math.round(e[1].m1));
    const m2Vals = entries.map((e) => Math.round(e[1].m2));

    return {
      data: [
        {
          type: "bar",
          name: secondaryMeasure ? `Total ${secondaryMeasure}` : "Total Profit",
          x: xKeys,
          y: m2Vals,
          marker: { color: "#0078d4" },
        },
        {
          type: "bar",
          name: primaryMeasure ? `Total ${primaryMeasure}` : "Total Sales",
          x: xKeys,
          y: m1Vals,
          marker: { color: "#103f91" },
        },
      ],
      layout: {
        barmode: "group",
        margin: { t: 25, l: 45, r: 15, b: 35 },
        height: 230,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        legend: { orientation: "h", y: 1.15, x: 0, font: { size: 10 } },
        xaxis: { gridcolor: "transparent", tickfont: { size: 9 } },
        yaxis: { gridcolor: "#e2e8f0", tickfont: { size: 9 } },
      },
    };
  }, [filteredRows, primaryDimension, primaryMeasure, secondaryMeasure]);

  // ── 8. Visual 6: Horizontal Ranking Bar Chart (Total Profit by Sub-Category) ──
  const rankingBarFigure = useMemo(() => {
    if (!filteredRows.length) return null;
    const dim = secondaryDimension || primaryDimension || "Category";
    const groups: Record<string, number> = {};

    for (const r of filteredRows) {
      const key = String(r[dim] ?? "Item").slice(0, 14);
      groups[key] = (groups[key] || 0) + (Number(r[primaryMeasure]) || 1);
    }

    const entries = Object.entries(groups).sort((a, b) => a[1] - b[1]).slice(-8);

    return {
      data: [
        {
          type: "bar",
          orientation: "h",
          y: entries.map((e) => e[0]),
          x: entries.map((e) => Math.round(e[1])),
          marker: { color: "#0078d4" },
        },
      ],
      layout: {
        margin: { t: 20, l: 75, r: 25, b: 35 },
        height: 230,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        xaxis: { gridcolor: "#e2e8f0", tickfont: { size: 9 } },
        yaxis: { automargin: true, tickfont: { size: 9 } },
      },
    };
  }, [filteredRows, secondaryDimension, primaryDimension, primaryMeasure]);

  // Data fields filtered by search
  const filteredFieldList = useMemo(() => {
    if (!profile?.columns?.length) return [];
    if (!dataSearch.trim()) return profile.columns;
    const q = dataSearch.toLowerCase();
    return profile.columns.filter((c) => c.name.toLowerCase().includes(q));
  }, [profile, dataSearch]);

  return (
    <div className="pbi-root">
      {/* ── POWER BI TOP TITLEBAR ── */}
      <div className="pbi-titlebar">
        <div className="pbi-titlebar-left">
          <div className="pbi-app-icon">P</div>
          <span className="pbi-doc-name">
            {dataset?.name || "PowerBI_Report"}.pbix - Power BI Desktop
          </span>
          <span className="pbi-save-badge">Saved</span>
        </div>

        <div className="pbi-titlebar-center">
          <Search size={13} />
          <span>Search</span>
          <span style={{ marginLeft: "auto", opacity: 0.6, fontSize: 10 }}>Ctrl+F</span>
        </div>

        <div className="pbi-titlebar-right">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "#c8c6c4",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#0078d4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              U
            </div>
            <span>Sign in</span>
          </div>

          <button type="button" className="pbi-share-btn">
            <Share2 size={12} />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* ── POWER BI RIBBON TOOLBAR ── */}
      <div className="pbi-ribbon">
        <div className="pbi-ribbon-tabs">
          {(["File", "Home", "Insert", "Modeling", "View", "Optimize", "Help"] as const).map(
            (tab) => (
              <div
                key={tab}
                className={`pbi-ribbon-tab ${activeRibbonTab === tab ? "active" : ""}`}
                onClick={() => setActiveRibbonTab(tab)}
              >
                {tab}
              </div>
            )
          )}
        </div>

        <div className="pbi-ribbon-tools">
          {/* Data Group */}
          <div className="pbi-ribbon-group">
            <div className="pbi-ribbon-group-items">
              <button
                type="button"
                className="pbi-ribbon-btn highlight"
                onClick={() => fileInputRef.current?.click()}
                title="Get data from files"
              >
                <Upload size={16} />
                <span>Get data</span>
              </button>

              <button
                type="button"
                className="pbi-ribbon-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Excel Workbook"
              >
                <FileSpreadsheet size={16} style={{ color: "#107c41" }} />
                <span>Excel</span>
              </button>

              <button
                type="button"
                className="pbi-ribbon-btn"
                onClick={() => onLoadSample("bike_sales_data")}
                title="Load sample Superstore-style dataset"
              >
                <Database size={16} style={{ color: "#0078d4" }} />
                <span>Sample Data</span>
              </button>
            </div>
            <span className="pbi-ribbon-group-label">Data</span>
          </div>

          {/* Queries Group */}
          <div className="pbi-ribbon-group">
            <div className="pbi-ribbon-group-items">
              <Link href="/explorer" className="pbi-ribbon-btn" title="Transform data">
                <Sliders size={16} style={{ color: "#d83b01" }} />
                <span>Transform</span>
              </Link>

              <button
                type="button"
                className="pbi-ribbon-btn"
                onClick={onRefresh}
                disabled={loading}
                title="Refresh dataset"
              >
                <RefreshCw size={16} className={loading ? "spin" : ""} />
                <span>Refresh</span>
              </button>
            </div>
            <span className="pbi-ribbon-group-label">Queries</span>
          </div>

          {/* Insert Group */}
          <div className="pbi-ribbon-group">
            <div className="pbi-ribbon-group-items">
              <button
                type="button"
                className="pbi-ribbon-btn"
                onClick={() => setSelectedVisType("clustered_column")}
                title="New visual"
              >
                <BarChart3 size={16} style={{ color: "#f2c811" }} />
                <span>New visual</span>
              </button>

              <button type="button" className="pbi-ribbon-btn" title="Text box">
                <FileText size={16} />
                <span>Text box</span>
              </button>
            </div>
            <span className="pbi-ribbon-group-label">Insert</span>
          </div>

          {/* Calculations Group */}
          <div className="pbi-ribbon-group">
            <div className="pbi-ribbon-group-items">
              <button type="button" className="pbi-ribbon-btn" title="New measure">
                <Hash size={16} style={{ color: "#f2c811" }} />
                <span>New measure</span>
              </button>

              <button type="button" className="pbi-ribbon-btn" title="Quick measure">
                <Sparkles size={16} style={{ color: "#7160e8" }} />
                <span>Quick measure</span>
              </button>
            </div>
            <span className="pbi-ribbon-group-label">Calculations</span>
          </div>

          {/* Copilot AI Group */}
          <div className="pbi-ribbon-group">
            <div className="pbi-ribbon-group-items">
              <Link href="/chat" className="pbi-ribbon-btn highlight" title="Prep data with Copilot AI">
                <Sparkles size={16} style={{ color: "#f2c811" }} />
                <span>Copilot AI</span>
              </Link>
            </div>
            <span className="pbi-ribbon-group-label">Copilot</span>
          </div>

          {/* Switch Mode Buttons */}
          <div className="pbi-ribbon-group" style={{ marginLeft: "auto", borderRight: "none" }}>
            <div className="pbi-ribbon-group-items">
              {onSwitchToStudio && (
                <button
                  type="button"
                  className="pbi-ribbon-btn highlight"
                  onClick={onSwitchToStudio}
                  title="Switch to full GraphicWalker drag-and-drop Visual Studio"
                >
                  <Grid size={16} style={{ color: "#f2c811" }} />
                  <span>Studio</span>
                </button>
              )}

              <button
                type="button"
                className="pbi-ribbon-btn"
                onClick={onToggleEdaMode}
                style={{
                  background: "rgba(59, 130, 246, 0.15)",
                  borderColor: "#3b82f6",
                  color: "#93c5fd",
                }}
                title="Switch to detailed automated EDA diagnostics"
              >
                <Activity size={16} />
                <span>EDA Mode</span>
              </button>
            </div>
            <span className="pbi-ribbon-group-label">View</span>
          </div>
        </div>
      </div>

      {/* Hidden file input for Ribbon Get Data */}
      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".csv,.tsv,.json,.parquet,.xlsx,.xls"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUploadFile(file);
          e.currentTarget.value = "";
        }}
      />

      {/* ── POWER BI MAIN WORKSPACE BODY ── */}
      <div className="pbi-workspace-body">
        {/* REPORT CANVAS AREA */}
        <div className="pbi-canvas-area">
          <div className="pbi-report-page">
            {/* ROW 1: 5 POWER BI KPI CARDS + MATRIX TABLE */}
            <div className="pbi-kpi-row">
              <div className="pbi-kpi-card">
                <div className="pbi-kpi-num">{kpiData.totalSales}</div>
                <div className="pbi-kpi-lbl">{kpiData.salesLabel}</div>
              </div>

              <div className="pbi-kpi-card">
                <div className="pbi-kpi-num">{kpiData.totalQty}</div>
                <div className="pbi-kpi-lbl">{kpiData.qtyLabel}</div>
              </div>

              <div className="pbi-kpi-card">
                <div className="pbi-kpi-num">{kpiData.totalProfit}</div>
                <div className="pbi-kpi-lbl">{kpiData.profitLabel}</div>
              </div>

              <div className="pbi-kpi-card">
                <div className="pbi-kpi-num">{kpiData.totalOrders}</div>
                <div className="pbi-kpi-lbl">Total Orders</div>
              </div>

              <div className="pbi-kpi-card">
                <div className="pbi-kpi-num">{kpiData.avgMargin}</div>
                <div className="pbi-kpi-lbl">Avg Margin</div>
              </div>

              {/* MATRIX TABLE (TOP RIGHT) */}
              <div className="pbi-matrix-box">
                <div className="pbi-matrix-title">
                  <span>
                    {matrixData?.rowDim || "Region"} by {matrixData?.colDim || "Category"}
                  </span>
                  <span style={{ fontSize: 9, opacity: 0.7 }}>Matrix Visual</span>
                </div>
                {matrixData ? (
                  <table className="pbi-matrix-table">
                    <thead>
                      <tr>
                        <th>{matrixData.rowDim}</th>
                        {matrixData.colsList.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrixData.rows.map((r) => (
                        <tr key={r.name}>
                          <td>{r.name}</td>
                          {matrixData.colsList.map((c) => (
                            <td key={c}>{formatPowerBINumber(r.cells[c])}</td>
                          ))}
                          <td style={{ fontWeight: 600 }}>{formatPowerBINumber(r.total)}</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td>Total</td>
                        {matrixData.colsList.map((c) => (
                          <td key={c}>{formatPowerBINumber(matrixData.colTotals[c])}</td>
                        ))}
                        <td>{formatPowerBINumber(matrixData.grandTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: 12, textAlign: "center", color: "#8a8886" }}>
                    Load dataset to view matrix cross-tabulation
                  </div>
                )}
              </div>
            </div>

            {/* SLICER WIDGET */}
            <div className="pbi-slicer-bar">
              <div className="pbi-slicer-label">
                <Filter size={13} style={{ color: "#0078d4" }} />
                <span>
                  Slicer: {slicerColumn ? slicerColumn.replace(/_/g, " ") : "Filter Dimension"}
                </span>
              </div>

              <select
                className="pbi-slicer-select"
                value={slicerValue}
                onChange={(e) => setSlicerValue(e.target.value)}
              >
                <option value="all">All</option>
                {slicerOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              {/* Slicer Column Selector */}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: "#8a8886" }}>Slice by:</span>
                <select
                  className="pbi-slicer-select"
                  style={{ fontSize: 10 }}
                  value={slicerColumn}
                  onChange={(e) => {
                    setSlicerColumn(e.target.value);
                    setSlicerValue("all");
                  }}
                >
                  {[...cols.categorical, ...cols.datetime].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ROW 2: CLUSTERED BAR, DONUT BY SEGMENT, AND LINE TREND */}
            <div className="pbi-grid-row-2">
              {/* Visual 1: Clustered Bar */}
              <div
                className={`pbi-visual-card ${activeVisualId === "vis-clustered-bar" ? "is-selected" : ""}`}
                onClick={() => setActiveVisualId("vis-clustered-bar")}
              >
                <div className="pbi-visual-header">
                  <span>
                    Total Profit and Total Sales by {primaryDimension ? primaryDimension.replace(/_/g, " ") : "Dimension"}
                  </span>
                  <div className="pbi-visual-actions">
                    <button type="button" className="pbi-vis-btn" title="Focus mode">
                      <Maximize2 size={11} />
                    </button>
                  </div>
                </div>
                {clusteredBarFigure ? (
                  <PlotlyChart figure={clusteredBarFigure} />
                ) : (
                  <ChartSkeleton />
                )}
              </div>

              {/* Visual 2: Donut Segment */}
              <div
                className={`pbi-visual-card ${activeVisualId === "vis-donut-seg" ? "is-selected" : ""}`}
                onClick={() => setActiveVisualId("vis-donut-seg")}
              >
                <div className="pbi-visual-header">
                  <span>
                    Total Sales by {primaryDimension ? primaryDimension.replace(/_/g, " ") : "Segment"}
                  </span>
                  <div className="pbi-visual-actions">
                    <button type="button" className="pbi-vis-btn" title="Focus mode">
                      <Maximize2 size={11} />
                    </button>
                  </div>
                </div>
                {donutSegmentFigure ? (
                  <PlotlyChart figure={donutSegmentFigure} />
                ) : (
                  <ChartSkeleton />
                )}
              </div>

              {/* Visual 3: Trend Line */}
              <div
                className={`pbi-visual-card ${activeVisualId === "vis-trend-line" ? "is-selected" : ""}`}
                onClick={() => setActiveVisualId("vis-trend-line")}
              >
                <div className="pbi-visual-header">
                  <span>Total Sales and Total Profit by Year / Timeline</span>
                  <div className="pbi-visual-actions">
                    <button type="button" className="pbi-vis-btn" title="Focus mode">
                      <Maximize2 size={11} />
                    </button>
                  </div>
                </div>
                {trendLineFigure ? (
                  <PlotlyChart figure={trendLineFigure} />
                ) : (
                  <ChartSkeleton />
                )}
              </div>
            </div>

            {/* ROW 3: DONUT BY CATEGORY, COLUMN BY REGION, AND RANKING SUB-CATEGORY */}
            <div className="pbi-grid-row-3">
              {/* Visual 4: Donut Category */}
              <div
                className={`pbi-visual-card ${activeVisualId === "vis-donut-cat" ? "is-selected" : ""}`}
                onClick={() => setActiveVisualId("vis-donut-cat")}
              >
                <div className="pbi-visual-header">
                  <span>
                    Total Sales by {secondaryDimension ? secondaryDimension.replace(/_/g, " ") : "Category"}
                  </span>
                  <div className="pbi-visual-actions">
                    <button type="button" className="pbi-vis-btn" title="Focus mode">
                      <Maximize2 size={11} />
                    </button>
                  </div>
                </div>
                {donutCategoryFigure ? (
                  <PlotlyChart figure={donutCategoryFigure} />
                ) : (
                  <ChartSkeleton />
                )}
              </div>

              {/* Visual 5: Clustered Column Region */}
              <div
                className={`pbi-visual-card ${activeVisualId === "vis-column-region" ? "is-selected" : ""}`}
                onClick={() => setActiveVisualId("vis-column-region")}
              >
                <div className="pbi-visual-header">
                  <span>
                    Total Profit and Total Sales by {primaryDimension ? primaryDimension.replace(/_/g, " ") : "Region"}
                  </span>
                  <div className="pbi-visual-actions">
                    <button type="button" className="pbi-vis-btn" title="Focus mode">
                      <Maximize2 size={11} />
                    </button>
                  </div>
                </div>
                {clusteredColumnFigure ? (
                  <PlotlyChart figure={clusteredColumnFigure} />
                ) : (
                  <ChartSkeleton />
                )}
              </div>

              {/* Visual 6: Horizontal Ranking Bar Sub-Category */}
              <div
                className={`pbi-visual-card ${activeVisualId === "vis-ranking-subcat" ? "is-selected" : ""}`}
                onClick={() => setActiveVisualId("vis-ranking-subcat")}
              >
                <div className="pbi-visual-header">
                  <span>
                    Total Profit by {secondaryDimension ? secondaryDimension.replace(/_/g, " ") : "Sub-Category"}
                  </span>
                  <div className="pbi-visual-actions">
                    <button type="button" className="pbi-vis-btn" title="Focus mode">
                      <Maximize2 size={11} />
                    </button>
                  </div>
                </div>
                {rankingBarFigure ? (
                  <PlotlyChart figure={rankingBarFigure} />
                ) : (
                  <ChartSkeleton />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── POWER BI RIGHT DOCKING PANES: VISUALIZATIONS & DATA ── */}
        <div className="pbi-side-dock">
          {/* Visualizations Pane Header */}
          <div className="pbi-dock-header">
            <span>Visualizations</span>
            <span style={{ fontSize: 10, color: "#8a8886" }}>Build visual</span>
          </div>

          {/* 6x4 Grid of 24 Power BI Visual Icons */}
          <div className="pbi-vis-icon-grid">
            {VISUAL_ICONS.map((vis) => (
              <button
                key={vis.id}
                type="button"
                className={`pbi-vis-icon-btn ${selectedVisType === vis.id ? "active" : ""}`}
                onClick={() => setSelectedVisType(vis.id)}
                title={vis.label}
              >
                <span style={{ fontSize: 11 }}>{vis.icon}</span>
              </button>
            ))}
          </div>

          {/* Field Wells Section */}
          <div className="pbi-wells-section">
            <div className="pbi-well-row">
              <span className="pbi-well-label">X-Axis (Category)</span>
              <select
                className="pbi-well-select"
                value={primaryDimension}
                onChange={(e) => setCustomX(e.target.value)}
              >
                {cols.categorical.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="pbi-well-row">
              <span className="pbi-well-label">Y-Axis (Values)</span>
              <select
                className="pbi-well-select"
                value={primaryMeasure}
                onChange={(e) => setCustomY(e.target.value)}
              >
                {cols.numeric.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="pbi-well-row">
              <span className="pbi-well-label">Legend</span>
              <select className="pbi-well-select" defaultValue={secondaryDimension}>
                <option value="">(None)</option>
                {cols.categorical.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Data Pane Header */}
          <div className="pbi-dock-header">
            <span>Data</span>
            <span style={{ fontSize: 10, color: "#8a8886" }}>{profile?.col_count || 0} fields</span>
          </div>

          {/* Data Pane Content */}
          <div className="pbi-data-pane">
            <input
              type="text"
              className="pbi-data-search"
              placeholder="Search fields..."
              value={dataSearch}
              onChange={(e) => setDataSearch(e.target.value)}
            />

            <div
              className="pbi-table-node"
              onClick={() => setTableExpanded(!tableExpanded)}
            >
              {tableExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Database size={12} style={{ color: "#f2c811" }} />
              <span>{dataset?.name || "Superstore_Cleaned"}</span>
            </div>

            {tableExpanded && (
              <div className="pbi-field-list">
                {filteredFieldList.map((col) => {
                  const isNum = col.kind === "numeric";
                  const isDate = col.kind === "datetime";
                  return (
                    <div
                      key={col.name}
                      className="pbi-field-item"
                      onClick={() => {
                        if (isNum) setCustomY(col.name);
                        else setCustomX(col.name);
                      }}
                      title={`Click to bind ${col.name} to active visual`}
                    >
                      <span
                        className={`pbi-field-icon ${isNum ? "sigma" : isDate ? "date" : ""}`}
                      >
                        {isNum ? "Σ" : isDate ? "📅" : "🗂"}
                      </span>
                      <span>{col.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── POWER BI BOTTOM STATUS BAR ── */}
      <div className="pbi-statusbar">
        <div className="pbi-status-left">
          <span style={{ cursor: "pointer", fontSize: 10 }}>&lt;</span>
          <span style={{ cursor: "pointer", fontSize: 10 }}>&gt;</span>
          <div className="pbi-page-tab">
            <span>{activePage}</span>
          </div>
          <button type="button" className="pbi-add-page-btn" title="Add page">
            <Plus size={12} />
          </button>
        </div>

        <div className="pbi-status-right">
          <span style={{ fontSize: 10 }}>Fit to page</span>
          <span style={{ fontSize: 10, cursor: "pointer" }}>-</span>
          <span style={{ fontSize: 10, fontWeight: 600 }}>{zoomLevel}%</span>
          <span style={{ fontSize: 10, cursor: "pointer" }}>+</span>
        </div>
      </div>
    </div>
  );
}
