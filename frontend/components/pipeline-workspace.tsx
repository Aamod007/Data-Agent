"use client";

import { Background, Controls, Handle, MiniMap, Position, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState } from "react";
import {
  Database,
  Download,
  FileChartColumnIncreasing,
  GitBranch,
  LoaderCircle,
  MessageSquare,
  Play,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Dataset } from "@/lib/types";
import { useWorkspaceStore } from "@/stores/workspace-store";

const colors: Record<string, string> = {
  raw: "#3b82f6",
  cleaned: "#22c55e",
  wrangled: "#f59e0b",
  engineered: "#a855f7",
};

// Custom Clean React Flow Node (Fixes Image #14 handle and text wrapping issues)
function CustomPipelineNode({
  data,
}: {
  data: {
    label: string;
    stage: string;
    shape: string;
    active: boolean;
    color: string;
  };
}) {
  return (
    <div
      className={`dag-node-card ${data.active ? "active" : ""}`}
      style={{ borderLeft: `3px solid ${data.color}` }}
    >
      <Handle type="target" position={Position.Top} className="dag-node-handle" />
      <div className="dag-node-header">
        <div className="dag-node-title mono">{data.label}</div>
        <span className="badge-stage-soft" style={{ fontSize: 8 }}>
          {data.stage}
        </span>
      </div>
      <div className="dag-node-meta mono">{data.shape}</div>
      <Handle type="source" position={Position.Bottom} className="dag-node-handle" />
    </div>
  );
}

const nodeTypes = {
  pipelineNode: CustomPipelineNode,
};

export function PipelineWorkspace() {
  const { datasets, setDatasets, activeDatasetId, setActive } = useWorkspaceStore();
  const [selected, setSelected] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(!datasets.length);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    api.datasets().then(setDatasets).catch(() => undefined).finally(() => setLoading(false));
  }, [setDatasets]);

  useEffect(() => {
    setSelected(datasets.find((dataset) => dataset.id === activeDatasetId) ?? datasets[0] ?? null);
  }, [activeDatasetId, datasets]);

  const { nodes, edges } = useMemo(
    () => buildPipelineGraph(datasets, activeDatasetId),
    [datasets, activeDatasetId]
  );

  const runAction = async (agentName: "cleaning" | "wrangling") => {
    if (!selected) return;
    setRunningAction(agentName);
    setActionNotice(`Executing ${agentName} agent on ${selected.name}…`);
    try {
      const instructions =
        agentName === "cleaning"
          ? "Clean the dataset, handle missing values, standardize columns, and return cleaned data."
          : "Wrangle and transform dataset into a clean analytical format.";
      const { run_id } = await api.invoke({
        dataset_id: selected.id,
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
              setActionNotice(`Agent completed: new derived dataset added to DAG.`);
              const updated = await api.datasets();
              setDatasets(updated);
            } else {
              setActionNotice(`Agent run failed: ${run.message}`);
            }
          }
        } catch {
          window.clearInterval(poll);
          setRunningAction(null);
        }
      }, 800);
    } catch (err) {
      setRunningAction(null);
      setActionNotice(`Error invoking agent: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="page pipeline-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow mono">DATA LINEAGE &amp; GRAPH</p>
          <h1>Pipeline Canvas</h1>
          <p className="muted">
            Visual DAG tracking dataset transformations across Python Data-Agent executions.
          </p>
        </div>
        <div className="heading-actions">
          <Link className="button primary" href="/chat">
            <Sparkles size={14} /> Open Agent Workbench
          </Link>
        </div>
      </div>

      {actionNotice && (
        <div
          className="error-banner mono"
          style={{
            color: "var(--text)",
            background: "var(--surface-raised)",
            borderColor: "var(--border-strong)",
          }}
        >
          <Zap size={14} style={{ color: "var(--accent-blue)" }} />
          <span>{actionNotice}</span>
        </div>
      )}

      {loading ? (
        <div className="empty">
          <LoaderCircle className="spin" size={24} />
          <p className="mono">Loading workspace DAG…</p>
        </div>
      ) : !datasets.length ? (
        <section className="empty">
          <GitBranch size={28} aria-hidden="true" />
          <p className="mono">
            <strong>No pipeline nodes.</strong>
            <br />
            Upload a dataset or load a sample to create the root node in the transformation DAG.
          </p>
          <Link className="button primary" href="/datasets">
            Upload Dataset
          </Link>
        </section>
      ) : (
        <div className="pipeline-layout">
          <section className="pipeline-canvas card">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              onNodeClick={(_, node) => {
                const data = datasets.find((dataset) => dataset.id === node.id);
                if (data) {
                  setSelected(data);
                  setActive(data.id);
                }
              }}
            >
              <MiniMap
                nodeColor={(node) => String(node.data?.color ?? colors.raw)}
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              />
              <Controls showInteractive={false} />
              <Background gap={18} color="var(--border)" />
            </ReactFlow>
          </section>

          <aside className="node-detail card">
            {selected && (
              <>
                <div className="card-header">
                  <div>
                    <h2 className="mono" style={{ fontSize: 13 }}>{selected.name}</h2>
                    <span className="badge-stage-soft" style={{ marginTop: 4 }}>{selected.stage}</span>
                  </div>
                </div>

                <div className="node-meta">
                  <span>DIMENSIONS</span>
                  <strong className="mono">
                    {selected.shape[0].toLocaleString()} rows × {selected.shape[1]} cols
                  </strong>

                  <span>SOURCE</span>
                  <strong className="mono" style={{ fontSize: 11 }}>{selected.source}</strong>

                  {selected.parent_id && (
                    <>
                      <span>PARENT NODE</span>
                      <strong className="mono">{selected.parent_id.slice(0, 12)}</strong>
                    </>
                  )}

                  {selected.operation && (
                    <>
                      <span>TRANSFORMATION</span>
                      <strong className="mono">{selected.operation.toUpperCase()} AGENT</strong>
                    </>
                  )}
                </div>

                <div className="node-actions">
                  <p className="muted mono" style={{ margin: "0 0 4px", fontSize: 10, color: "var(--text-dim)" }}>
                    RUN AGENT TRANSFORMATION:
                  </p>
                  <button
                    className="button primary"
                    disabled={Boolean(runningAction)}
                    onClick={() => void runAction("cleaning")}
                  >
                    {runningAction === "cleaning" ? (
                      <LoaderCircle className="spin" size={13} />
                    ) : (
                      <Play size={13} />
                    )}
                    Clean Data
                  </button>
                  <button
                    className="button secondary"
                    disabled={Boolean(runningAction)}
                    onClick={() => void runAction("wrangling")}
                  >
                    {runningAction === "wrangling" ? (
                      <LoaderCircle className="spin" size={13} />
                    ) : (
                      <Wrench size={13} />
                    )}
                    Wrangle &amp; Transform
                  </button>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4 }}>
                    <Link href="/explorer" className="button secondary" style={{ fontSize: 10 }}>
                      <FileChartColumnIncreasing size={12} /> Profile
                    </Link>
                    <Link href="/chat" className="button secondary" style={{ fontSize: 10 }}>
                      <MessageSquare size={12} /> Workbench
                    </Link>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function buildPipelineGraph(
  datasets: Dataset[],
  active: string | null
): { nodes: Node[]; edges: Edge[] } {
  const levels = new Map<string, number>();
  const depth = (dataset: Dataset): number => {
    if (levels.has(dataset.id)) return levels.get(dataset.id)!;
    const parent = datasets.find((item) => item.id === dataset.parent_id);
    const value = parent ? depth(parent) + 1 : 0;
    levels.set(dataset.id, value);
    return value;
  };

  const buckets = new Map<number, number>();
  const nodes: Node[] = datasets.map((dataset) => {
    const level = depth(dataset);
    const index = buckets.get(level) ?? 0;
    buckets.set(level, index + 1);
    const stageColor = colors[dataset.stage] ?? colors.raw;
    const isNodeActive = dataset.id === active;

    return {
      id: dataset.id,
      type: "pipelineNode",
      position: { x: level * 240 + 30, y: index * 120 + 30 },
      data: {
        label: dataset.name,
        stage: dataset.stage,
        shape: `${dataset.shape[0].toLocaleString()} × ${dataset.shape[1]}`,
        active: isNodeActive,
        color: stageColor,
      },
    };
  });

  const edges: Edge[] = datasets
    .filter((dataset) => dataset.parent_id)
    .map((dataset) => ({
      id: `${dataset.parent_id}-${dataset.id}`,
      source: dataset.parent_id!,
      target: dataset.id,
      type: "smoothstep",
      animated: dataset.id === active,
      style: { stroke: colors[dataset.stage] ?? "var(--border-strong)", strokeWidth: 2 },
    }));

  return { nodes, edges };
}
