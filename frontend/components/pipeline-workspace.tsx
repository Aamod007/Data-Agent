"use client";

import {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart2,
  Database,
  FileChartColumnIncreasing,
  LoaderCircle,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Dataset } from "@/lib/types";
import { useWorkspaceStore } from "@/stores/workspace-store";

/* ─────────── Color Palette ─────────── */

const stageColors: Record<string, string> = {
  raw: "#3b82f6",
  cleaned: "#22c55e",
  wrangled: "#f59e0b",
  engineered: "#a855f7",
};

/* ─────────── Custom Node: Dataset ─────────── */

function DatasetNode({
  data,
  selected,
}: {
  data: {
    label: string;
    stage: string;
    shape: string;
    color: string;
    datasetId: string;
  };
  selected?: boolean;
}) {
  return (
    <div
      className={`pipeline-dataset-node ${selected ? "selected" : ""}`}
      style={{ borderColor: data.color }}
    >
      <Handle type="target" position={Position.Left} className="pipeline-handle" />
      <div className="pipeline-node-header">
        <Database size={13} style={{ color: data.color, flexShrink: 0 }} />
        <span className="pipeline-node-name mono">{data.label}</span>
      </div>
      <div className="pipeline-node-badges">
        <span
          className="pipeline-stage-badge"
          style={{
            color: data.color,
            borderColor: data.color,
            background: `${data.color}18`,
          }}
        >
          {data.stage.toUpperCase()}
        </span>
        <span className="pipeline-node-dim mono">{data.shape}</span>
      </div>
      <Handle type="source" position={Position.Right} className="pipeline-handle" />
    </div>
  );
}

/* ─────────── Custom Node: Agent/Transform ─────────── */

function AgentNode({
  data,
  selected,
}: {
  data: {
    label: string;
    agentType: string;
    onRun?: () => void;
    running?: boolean;
  };
  selected?: boolean;
}) {
  return (
    <div className={`pipeline-agent-node ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} className="pipeline-handle" />
      <div className="pipeline-node-header">
        <Sparkles size={13} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
        <span className="pipeline-node-name mono">{data.label}</span>
      </div>
      <div className="pipeline-agent-bottom">
        <span className="pipeline-transform-badge">TRANSFORM</span>
        <button
          type="button"
          className="pipeline-run-btn"
          onClick={(e) => {
            e.stopPropagation();
            data.onRun?.();
          }}
          disabled={data.running}
        >
          {data.running ? (
            <LoaderCircle className="spin" size={10} />
          ) : (
            <Play size={10} />
          )}
          <span>RUN</span>
        </button>
      </div>
      <Handle type="source" position={Position.Right} className="pipeline-handle" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  datasetNode: DatasetNode,
  agentNode: AgentNode,
};

/* ─────────── Layout Helper ─────────── */

function buildLayout(
  datasets: Dataset[],
  activeDatasetId: string | null,
): { nodes: Node[]; edges: Edge[] } {
  const levels = new Map<string, number>();
  const depth = (ds: Dataset): number => {
    if (levels.has(ds.id)) return levels.get(ds.id)!;
    const parent = datasets.find((d) => d.id === ds.parent_id);
    const v = parent ? depth(parent) + 1 : 0;
    levels.set(ds.id, v);
    return v;
  };

  const buckets = new Map<number, number>();
  const nodes: Node[] = datasets.map((ds) => {
    const level = depth(ds);
    const index = buckets.get(level) ?? 0;
    buckets.set(level, index + 1);
    const color = stageColors[ds.stage] ?? stageColors.raw;

    return {
      id: ds.id,
      type: "datasetNode",
      position: { x: level * 280 + 40, y: index * 140 + 40 },
      data: {
        label: ds.name,
        stage: ds.stage,
        shape: `${ds.shape[0].toLocaleString()} × ${ds.shape[1]}`,
        color,
        datasetId: ds.id,
      },
    };
  });

  const edges: Edge[] = datasets
    .filter((ds) => ds.parent_id)
    .map((ds) => ({
      id: `e-${ds.parent_id}-${ds.id}`,
      source: ds.parent_id!,
      target: ds.id,
      type: "default",
      animated: ds.id === activeDatasetId,
      style: {
        stroke: "#ef4444",
        strokeWidth: 2,
        strokeDasharray: "6 4",
      },
    }));

  return { nodes, edges };
}

/* ─────────── Main Component ─────────── */

export function PipelineWorkspace() {
  const { datasets, setDatasets, activeDatasetId, setActive } = useWorkspaceStore();
  const [selected, setSelected] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(!datasets.length);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [agentCounter, setAgentCounter] = useState(0);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[]);

  // Load datasets
  useEffect(() => {
    api
      .datasets()
      .then(setDatasets)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [setDatasets]);

  // Sync selected dataset
  useEffect(() => {
    setSelected(
      datasets.find((d) => d.id === activeDatasetId) ?? datasets[0] ?? null,
    );
  }, [activeDatasetId, datasets]);

  // Build initial graph from datasets
  useEffect(() => {
    const layout = buildLayout(datasets, activeDatasetId);
    // Preserve any user-added agent nodes
    setNodes((prev) => {
      const agentNodes = prev.filter((n) => n.type === "agentNode");
      return [...layout.nodes, ...agentNodes];
    });
    setEdges((prev) => {
      const agentEdges = prev.filter((e) => e.id.startsWith("e-agent-"));
      return [...layout.edges, ...agentEdges];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets, activeDatasetId]);

  // Connect handler
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges],
  );

  // Click node handler
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "datasetNode") {
        const ds = datasets.find((d) => d.id === node.id);
        if (ds) {
          setSelected(ds);
          setActive(ds.id);
        }
      }
    },
    [datasets, setActive],
  );

  // Add agent node
  const addAgentNode = useCallback(
    (label: string, agentType: string) => {
      const id = `agent-${agentType}-${agentCounter}`;
      setAgentCounter((c) => c + 1);

      // Position near the center of the canvas
      const baseX = 300 + agentCounter * 40;
      const baseY = 200 + agentCounter * 30;

      const newNode: Node = {
        id,
        type: "agentNode",
        position: { x: baseX, y: baseY },
        data: {
          label,
          agentType,
          running: false,
          onRun: () => void runAgentFromNode(agentType, id),
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentCounter, setNodes],
  );

  // Run agent from a node
  const runAgentFromNode = async (agentType: string, nodeId: string) => {
    if (!selected) {
      setActionNotice("Select a dataset node first to run an agent on.");
      return;
    }
    setRunningAction(nodeId);

    // Mark node as running
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, running: true } } : n,
      ),
    );

    const instructionMap: Record<string, string> = {
      cleaning:
        "Clean the dataset, handle missing values, standardize columns, and return cleaned data.",
      wrangling:
        "Wrangle and transform dataset into a clean analytical format.",
      feature_eng:
        "Engineer new features from existing columns using domain knowledge.",
      viz: "Generate insightful visualizations and plots from the dataset.",
    };

    const agentMap: Record<string, string> = {
      cleaning: "cleaning",
      wrangling: "wrangling",
      feature_eng: "wrangling",
      viz: "visualization",
    };

    setActionNotice(
      `Running ${agentType} agent on ${selected.name}…`,
    );

    try {
      const { run_id } = await api.invoke({
        dataset_id: selected.id,
        agent: agentMap[agentType] ?? "cleaning",
        instructions: instructionMap[agentType] ?? instructionMap.cleaning,
      });

      const poll = window.setInterval(async () => {
        try {
          const run = await api.run(run_id);
          if (run.status === "completed" || run.status === "failed") {
            window.clearInterval(poll);
            setRunningAction(null);
            setNodes((nds) =>
              nds.map((n) =>
                n.id === nodeId
                  ? { ...n, data: { ...n.data, running: false } }
                  : n,
              ),
            );
            if (run.status === "completed") {
              setActionNotice(`Agent completed — new derived dataset added.`);
              const updated = await api.datasets();
              setDatasets(updated);
            } else {
              setActionNotice(`Agent run failed: ${run.message}`);
            }
          }
        } catch {
          window.clearInterval(poll);
          setRunningAction(null);
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? { ...n, data: { ...n.data, running: false } }
                : n,
            ),
          );
        }
      }, 800);
    } catch (err) {
      setRunningAction(null);
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, running: false } }
            : n,
        ),
      );
      setActionNotice(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  // Run actions from sidebar
  const runSidebarAction = async (agentName: "cleaning" | "wrangling") => {
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
              setActionNotice(`Agent completed — new derived dataset added.`);
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
      setActionNotice(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  // Reset layout
  const resetLayout = useCallback(() => {
    const layout = buildLayout(datasets, activeDatasetId);

    // Reposition agent nodes below dataset nodes
    const agentNodes = nodes.filter((n) => n.type === "agentNode");
    const repositioned = agentNodes.map((n, i) => ({
      ...n,
      position: { x: 320 + i * 200, y: 350 + (i % 2) * 100 },
    }));

    setNodes([...layout.nodes, ...repositioned]);
    setEdges((prev) => {
      const agentEdges = prev.filter((e) => e.id.startsWith("e-agent-"));
      return [...layout.edges, ...agentEdges];
    });
  }, [datasets, activeDatasetId, nodes, setNodes, setEdges]);

  return (
    <div className="pipeline-workspace-root">
      {/* ─── Toolbar ─── */}
      <div className="pipeline-toolbar">
        <div className="pipeline-toolbar-group">
          <button
            type="button"
            className="pipeline-toolbar-btn"
            onClick={() => addAgentNode("Clean Agent", "cleaning")}
          >
            <Plus size={12} />
            <Sparkles size={12} />
            <span>Clean Agent</span>
          </button>
          <span className="pipeline-toolbar-sep">+</span>
          <button
            type="button"
            className="pipeline-toolbar-btn"
            onClick={() => addAgentNode("Wrangle Agent", "wrangling")}
          >
            <Plus size={12} />
            <Wrench size={12} />
            <span>Wrangle Agent</span>
          </button>
          <span className="pipeline-toolbar-sep">+</span>
          <button
            type="button"
            className="pipeline-toolbar-btn"
            onClick={() => addAgentNode("Feature Eng", "feature_eng")}
          >
            <Plus size={12} />
            <Sparkles size={12} />
            <span>Feature Eng</span>
          </button>
          <span className="pipeline-toolbar-sep">+</span>
          <button
            type="button"
            className="pipeline-toolbar-btn"
            onClick={() => addAgentNode("Viz Node", "viz")}
          >
            <Plus size={12} />
            <BarChart2 size={12} />
            <span>Viz Node</span>
          </button>
        </div>
        <button
          type="button"
          className="pipeline-toolbar-btn reset"
          onClick={resetLayout}
        >
          <RefreshCw size={12} />
          <span>Reset Layout</span>
        </button>
      </div>

      {/* ─── Action Notice ─── */}
      {actionNotice && (
        <div className="pipeline-notice mono">
          <Zap size={13} style={{ color: "var(--accent-blue)" }} />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* ─── Canvas + Sidebar ─── */}
      {loading ? (
        <div className="empty" style={{ minHeight: 400 }}>
          <LoaderCircle className="spin" size={24} />
          <p className="mono">Loading pipeline graph…</p>
        </div>
      ) : (
        <div className="pipeline-body">
          {/* React Flow Canvas */}
          <div className="pipeline-canvas-area">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              fitView
              snapToGrid
              snapGrid={[16, 16]}
              deleteKeyCode="Delete"
              className="pipeline-flow"
            >
              <MiniMap
                nodeColor={(node) =>
                  node.type === "agentNode"
                    ? "#a855f7"
                    : String(node.data?.color ?? stageColors.raw)
                }
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              />
              <Controls showInteractive={false} />
              <Background gap={18} color="var(--border)" />
            </ReactFlow>
          </div>

          {/* ─── Right Detail Sidebar ─── */}
          <aside className="pipeline-detail-sidebar">
            {selected ? (
              <>
                <div className="pipeline-sidebar-header">
                  <h2 className="mono" style={{ fontSize: 14 }}>
                    {selected.name}
                  </h2>
                  <span
                    className="pipeline-stage-badge"
                    style={{
                      color: stageColors[selected.stage] ?? stageColors.raw,
                      borderColor:
                        stageColors[selected.stage] ?? stageColors.raw,
                      background: `${stageColors[selected.stage] ?? stageColors.raw}18`,
                    }}
                  >
                    {selected.stage.toUpperCase()}
                  </span>
                </div>

                <div className="pipeline-sidebar-meta">
                  <span className="pipeline-meta-label">SHAPE</span>
                  <strong className="mono">
                    {selected.shape[0].toLocaleString()} ×{" "}
                    {selected.shape[1]}
                  </strong>
                </div>

                <div className="pipeline-sidebar-meta">
                  <span className="pipeline-meta-label">SOURCE</span>
                  <strong className="mono" style={{ fontSize: 11 }}>
                    {selected.source}
                  </strong>
                </div>

                <div className="pipeline-sidebar-actions">
                  <button
                    className="button primary pipeline-action-btn"
                    disabled={Boolean(runningAction)}
                    onClick={() => void runSidebarAction("cleaning")}
                  >
                    {runningAction === "cleaning" ? (
                      <LoaderCircle className="spin" size={13} />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    Clean Data
                  </button>
                  <button
                    className="button secondary pipeline-action-btn"
                    disabled={Boolean(runningAction)}
                    onClick={() => void runSidebarAction("wrangling")}
                  >
                    {runningAction === "wrangling" ? (
                      <LoaderCircle className="spin" size={13} />
                    ) : (
                      <Wrench size={13} />
                    )}
                    Wrangle Data
                  </button>

                  <div className="pipeline-sidebar-row">
                    <Link
                      href="/explorer"
                      className="button secondary pipeline-action-btn small"
                    >
                      <FileChartColumnIncreasing size={12} />
                      Profile
                    </Link>
                    <Link
                      href="/chat"
                      className="button secondary pipeline-action-btn small"
                    >
                      <MessageSquare size={12} />
                      Chat
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <div className="pipeline-sidebar-empty">
                <Database size={22} style={{ color: "var(--text-dim)" }} />
                <p className="mono" style={{ color: "var(--text-dim)" }}>
                  Click a dataset node to inspect
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
