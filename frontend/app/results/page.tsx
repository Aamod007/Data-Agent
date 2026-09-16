"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Bot, FileCode2, LayoutDashboard, MessageSquare, Sparkles, TableProperties } from "lucide-react";
import Link from "next/link";
import { ArtifactView } from "@/components/artifact-view";
import { ChartSkeleton } from "@/components/skeleton";
import { api } from "@/lib/api";
import type { AgentRun } from "@/lib/types";

const icons = { chart: BarChart3, table: TableProperties, code: FileCode2 };

export default function ResultsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "chart" | "table" | "code">("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.runs()
      .then(setRuns)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load workspace results."))
      .finally(() => setLoading(false));
  }, []);

  const artifacts = useMemo(
    () =>
      runs
        .flatMap((run) => run.artifacts.map((artifact) => ({ ...artifact, runId: run.run_id })))
        .filter((artifact) => filter === "all" || artifact.type === filter),
    [runs, filter]
  );

  return (
    <div className="page results-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace Output Gallery</p>
          <h1>Analysis & Model Results</h1>
          <p className="muted">
            All interactive charts, wrangled tables, and generated code produced by Data-Agent runs.
          </p>
        </div>
        <div className="heading-actions">
          <Link href="/chat" className="button primary">
            <Sparkles size={15} /> Run New Analysis
          </Link>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="results-tabs">
        {(["all", "chart", "table", "code"] as const).map((item) => {
          const Icon = item === "all" ? LayoutDashboard : icons[item];
          return (
            <button
              key={item}
              className={filter === item ? "result-tab active" : "result-tab"}
              onClick={() => setFilter(item)}
            >
              <Icon size={14} /> {item.toUpperCase()}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="artifact-grid">
          <ChartSkeleton height={260} />
          <ChartSkeleton height={260} />
          <ChartSkeleton height={260} />
        </div>
      ) : artifacts.length ? (
        <div className="artifact-grid">
          {artifacts.map((artifact, index) => (
            <ArtifactView key={`${artifact.runId}-${artifact.type}-${index}`} artifact={artifact} />
          ))}
        </div>
      ) : (
        <section className="empty">
          <Bot size={34} aria-hidden="true" />
          <p>
            <strong>No artifact outputs in gallery yet.</strong>
            <br />
            Run an analysis in Agent Chat, Clean data in Pipeline, or generate an EDA chart.
          </p>
          <Link href="/chat" className="button primary">
            <MessageSquare size={15} /> Open Agent Chat
          </Link>
        </section>
      )}
    </div>
  );
}
