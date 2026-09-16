"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { BarChart3, LayoutDashboard, Sliders } from "lucide-react";
import type { Dataset, DatasetPreview, DatasetProfile } from "@/lib/types";

// Import GraphicWalker styling
import "@kanaries/graphic-walker/dist/style.css";

// Dynamic import because GraphicWalker relies on window, DOM, canvas, and WebGL
const GraphicWalker = dynamic(
  () => import("@kanaries/graphic-walker").then((mod) => mod.GraphicWalker),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "650px",
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 8,
          color: "var(--text-muted, #64748b)",
          fontSize: 14,
        }}
      >
        Initializing Interactive Visual Analytics Studio (GraphicWalker)...
      </div>
    ),
  }
) as any;

interface GraphicWalkerBoardProps {
  dataset: Dataset | null;
  preview: DatasetPreview | null;
  profile: DatasetProfile | null;
  onSwitchToPowerBi: () => void;
  onSwitchToEda: () => void;
}

export function GraphicWalkerBoard({
  dataset,
  preview,
  profile,
  onSwitchToPowerBi,
  onSwitchToEda,
}: GraphicWalkerBoardProps) {
  const fields = useMemo(() => {
    if (!profile?.columns?.length) return [];
    return profile.columns.map((c) => {
      const isNum = c.kind === "numeric";
      const isDate = c.kind === "datetime";
      return {
        fid: c.name,
        name: c.name,
        semanticType: (isNum ? "quantitative" : isDate ? "temporal" : "nominal") as
          | "quantitative"
          | "temporal"
          | "nominal",
        analyticType: (isNum ? "measure" : "dimension") as "measure" | "dimension",
      };
    });
  }, [profile]);

  const dataSource = useMemo(() => {
    if (!preview?.rows?.length) return [];
    return preview.rows;
  }, [preview]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      {/* Top Banner Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          background: "#181818",
          color: "#ffffff",
          borderRadius: 6,
          fontSize: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              background: "#0078d4",
              color: "#fff",
              padding: "2px 6px",
              borderRadius: 3,
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            STUDIO
          </span>
          <span style={{ fontWeight: 600 }}>
            {dataset?.name || "Dataset"} &mdash; Interactive Drag-and-Drop Visual Studio (Power BI / Tableau Engine)
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={onSwitchToPowerBi}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "#2b2b2b",
              color: "#f3f2f1",
              border: "1px solid #444",
              borderRadius: 4,
              padding: "4px 10px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            <LayoutDashboard size={13} style={{ color: "#f2c811" }} />
            <span>Power BI Canvas</span>
          </button>

          <button
            type="button"
            onClick={onSwitchToEda}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "#2b2b2b",
              color: "#f3f2f1",
              border: "1px solid #444",
              borderRadius: 4,
              padding: "4px 10px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            <Sliders size={13} style={{ color: "#3b82f6" }} />
            <span>EDA Diagnostics</span>
          </button>
        </div>
      </div>

      {/* Main GraphicWalker Container */}
      <div
        style={{
          width: "100%",
          minHeight: "860px",
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
      >
        {dataSource.length > 0 && fields.length > 0 ? (
          <GraphicWalker
            data={dataSource}
            dataSource={dataSource}
            rawFields={fields}
            i18nLang="en-US"
            appearance="light"
          />
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
            Upload or select a dataset to open the interactive Visual Studio.
          </div>
        )}
      </div>
    </div>
  );
}
