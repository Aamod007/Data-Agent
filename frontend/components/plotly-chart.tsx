"use client";

import { useEffect, useRef } from "react";

type PlotlyModule = {
  react: (element: HTMLElement, data: unknown[], layout: object, config: object) => Promise<void>;
  purge: (element: HTMLElement) => void;
};

// Cache the heavy dynamic import so only the first chart pays the cost.
let _plotlyPromise: Promise<PlotlyModule> | null = null;
function getPlotly(): Promise<PlotlyModule> {
  if (!_plotlyPromise) {
    _plotlyPromise = import("plotly.js-dist-min").then((m) => m.default as PlotlyModule);
  }
  return _plotlyPromise;
}

export function PlotlyChart({ figure }: { figure: unknown }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    let plotly: PlotlyModule | undefined;

    const render = async () => {
      if (!container.current || !figure) return;
      plotly = await getPlotly();

      const fontColor = "#475569";
      const gridColor = "rgba(0, 0, 0, 0.06)";

      const normalized = figure as {
        data?: Record<string, unknown>[];
        layout?: Record<string, unknown>;
        config?: Record<string, unknown>;
      };

      const baseLayout: Record<string, unknown> = {
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        font: { family: "JetBrains Mono, Inter, monospace", color: fontColor, size: 11 },
        margin: { t: 30, l: 40, r: 20, b: 40 },
        xaxis: {
          gridcolor: gridColor,
          linecolor: gridColor,
          tickfont: { family: "JetBrains Mono, monospace", size: 9, color: fontColor },
        },
        yaxis: {
          gridcolor: gridColor,
          linecolor: gridColor,
          tickfont: { family: "JetBrains Mono, monospace", size: 9, color: fontColor },
        },
        hoverlabel: {
          bgcolor: "#ffffff",
          bordercolor: "rgba(0,0,0,0.15)",
          font: { family: "JetBrains Mono, monospace", size: 11, color: "#0f172a" },
        },
      };

      const mergedLayout = {
        ...baseLayout,
        ...(normalized.layout ?? {}),
        xaxis: {
          ...((baseLayout.xaxis as object) ?? {}),
          ...((normalized.layout?.xaxis as object) ?? {}),
        },
        yaxis: {
          ...((baseLayout.yaxis as object) ?? {}),
          ...((normalized.layout?.yaxis as object) ?? {}),
        },
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
      };

      if (mounted && container.current) {
        await plotly.react(container.current, normalized.data ?? [], mergedLayout, {
          responsive: true,
          displaylogo: false,
          modeBarButtonsToRemove: ["lasso2d", "select2d"],
          ...normalized.config,
        });
      }
    };

    void render();

    return () => {
      mounted = false;
      if (container.current && plotly) plotly.purge(container.current);
    };
  }, [figure]);

  return <div className="plotly" ref={container} aria-label="Interactive Plotly chart" />;
}
