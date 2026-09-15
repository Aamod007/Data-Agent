"use client";

import {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BarChart2,
  BarChart3,
  Check,
  Database,
  Info,
  LoaderCircle,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { AgentKind, Dataset, DatasetProfile } from "@/lib/types";
import { useWorkspaceStore } from "@/stores/workspace-store";

/* ─────────── Constants ─────────── */

const stageColors: Record<string, string> = {
  raw: "#3b82f6",
  cleaned: "#22c55e",
  wrangled: "#f59e0b",
  engineered: "#a855f7",
};

type NodeStatus = "idle" | "running" | "success" | "error";

// Icons per agent type so each node reads at a glance.
const agentIcons: Record<string, typeof Sparkles> = {
  cleaning: Sparkles,
  wrangling: Wrench,
  feature_eng: Sparkles,
  viz: BarChart2,
};

const COL_W = 320; // horizontal gap between lineage levels
const ROW_H = 132; // vertical gap between siblings
const AGENT_X = 420; // agents hang off to the right of the dataset column
const AGENT_H = 118;

/* ─────────── Custom Node: Dataset ─────────── */

function DatasetNode({
  data,
  selected,
}: {
  data: {
    label: string;
    stage: string;
    shape: string;
    source: string;
    color: string;
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
        <span className="pipeline-node-name mono" title={data.label}>
          {data.label}
        </span>
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
      {data.source && (
        <div className="pipeline-node-source mono" title={data.source}>
          {data.source}
        </div>
      )}
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
    status?: NodeStatus;
    errorDetail?: string;
  };
  selected?: boolean;
}) {
  const status = data.status ?? "idle";
  const Icon = agentIcons[data.agentType] ?? Sparkles;

  const runIcon =
    status === "success" ? (
      <Check size={10} />
    ) : status === "error" ? (
      <AlertCircle size={10} />
    ) : status === "running" ? (
      <LoaderCircle className="spin" size={10} />
    ) : (
      <Play size={10} />
    );
  const runLabel =
    status === "success"
      ? "DONE"
      : status === "error"
        ? "FAILED"
        : status === "running"
          ? "RUNNING"
          : "RUN";

  return (
    <div className={`pipeline-agent-node status-${status} ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} className="pipeline-handle" />
      <div className="pipeline-node-header">
        <Icon size={13} className="pipeline-agent-icon" style={{ flexShrink: 0 }} />
        <span className="pipeline-node-name mono" title={data.label}>
          {data.label}
        </span>
        {status === "success" && (
          <Check size={12} className="pipeline-status-mark ok" aria-label="Succeeded" />
        )}
        {status === "error" && (
          <AlertCircle size={12} className="pipeline-status-mark bad" aria-label="Failed" />
        )}
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
          disabled={status === "running"}
        >
          {runIcon}
          <span>{runLabel}</span>
        </button>
      </div>
      {status === "error" && data.errorDetail && (
        <details className="pipeline-node-error mono">
          <summary>
            <AlertCircle size={9} /> Error
          </summary>
          <p>{data.errorDetail}</p>
        </details>
      )}
      <Handle type="source" position={Position.Right} className="pipeline-handle" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  datasetNode: DatasetNode,
  agentNode: AgentNode,
};

/* ─────────── Layout Helper ─────────── */

/** Place dataset nodes by lineage depth; agents stack in their own column. */
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
      position: { x: level * COL_W + 40, y: index * ROW_H + 60 },
      data: {
        label: ds.name,
        stage: ds.stage,
        shape: `${ds.shape[0].toLocaleString()} × ${ds.shape[1]}`,
        source: ds.source.replace(/^(upload|sample|agent) · /, ""),
        color,
      },
    };
  });

  const edges: Edge[] = datasets
    .filter((ds) => ds.parent_id)
    .map((ds) => ({
      id: `e-${ds.parent_id}-${ds.id}`,
      source: ds.parent_id!,
      target: ds.id,
      type: "smoothstep",
      animated: ds.id === activeDatasetId,
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
      style: { stroke: "#ef4444", strokeWidth: 1.5 },
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
  const [panelOpen, setPanelOpen] = useState(false);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[]);

  // Captured via onInit so we can re-fit after inserting a node. Nodes are
  // placed at fixed offsets from their source dataset, which lands outside the
  // viewport when the canvas is zoomed in from the mount-time fitView.
  const rfRef = useRef<ReactFlowInstance | null>(null);

  // Node `onRun` closures are created once and stored in node data, so they
  // would otherwise capture a stale `runAgentFromNode`. Route through a ref
  // that always points at the current render's handler.
  const runRef = useRef<(agentType: string, nodeId: string, datasetId: string) => void>(
    () => {},
  );

  const setNodeStatus = (nodeId: string, status: NodeStatus, errorDetail?: string) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, status, errorDetail } } : n,
      ),
    );
  };

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

  // Lazy-load profile for the selected dataset when the panel opens.
  useEffect(() => {
    if (!panelOpen || !selected) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    api
      .profile(selected.id)
      .then(setProfile)
      .catch((cause) =>
        setProfileError(cause instanceof Error ? cause.message : "Could not load profile."),
      )
      .finally(() => setProfileLoading(false));
  }, [panelOpen, selected]);

  // Rebuild dataset nodes/edges from lineage; keep user-added agent nodes.
  useEffect(() => {
    const layout = buildLayout(datasets, activeDatasetId);
    const known = new Set(datasets.map((d) => d.id));

    setNodes((prev) => {
      const agentNodes = prev.filter((n) => n.type === "agentNode");
      return [...layout.nodes, ...agentNodes];
    });
    setEdges((prev) => {
      // Drop agent edges whose source dataset was deleted.
      const agentEdges = prev.filter(
        (e) => e.id.startsWith("e-agent-") && known.has(e.source),
      );
      return [...layout.edges, ...agentEdges];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets, activeDatasetId]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
            style: { stroke: "#ef4444", strokeWidth: 1.5 },
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

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

  // Add an agent node, wired to the currently selected dataset.
  const addAgentNode = useCallback(
    (label: string, agentType: string) => {
      const source = selected ?? datasets[0] ?? null;
      if (!source) {
        setActionNotice("Load a dataset before adding an agent node.");
        return;
      }

      const id = `agent-${agentType}-${agentCounter}`;
      setAgentCounter((c) => c + 1);

      // Stack agents in a column to the right of their source dataset.
      const sourceNode = nodes.find((n) => n.id === source.id);
      const siblings = nodes.filter(
        (n) => n.type === "agentNode" && n.data?.datasetId === source.id,
      ).length;

      const newNode: Node = {
        id,
        type: "agentNode",
        position: {
          x: (sourceNode?.position.x ?? 40) + AGENT_X,
          y: (sourceNode?.position.y ?? 60) + siblings * AGENT_H,
        },
        data: {
          label,
          agentType,
          datasetId: source.id,
          status: "idle" as NodeStatus,
          onRun: () => runRef.current(agentType, id, source.id),
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [
        ...eds,
        {
          id: `e-agent-${source.id}-${id}`,
          source: source.id,
          target: id,
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
          style: { stroke: "#ef4444", strokeWidth: 1.5 },
        },
      ]);

      // Keep the new node in view: re-fit once the node has been laid out.
      window.setTimeout(() => {
        rfRef.current?.fitView({ padding: 0.25, duration: 300 });
      }, 80);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentCounter, selected, datasets, nodes, setNodes, setEdges],
  );

  // Run an agent node against its source dataset.
  const runAgentFromNode = async (
    agentType: string,
    nodeId: string,
    datasetId: string,
  ) => {
    const dataset = datasets.find((d) => d.id === datasetId);
    if (!dataset) {
      setActionNotice("The source dataset for this node is no longer loaded.");
      return;
    }
    setRunningAction(nodeId);
    setNodeStatus(nodeId, "running");

    const instructionMap: Record<string, string> = {
      cleaning:
        "Clean the dataset, handle missing values, standardize columns, and return cleaned data.",
      wrangling:
        "Wrangle and transform dataset into a clean analytical format.",
      feature_eng:
        "Engineer new features from existing columns using domain knowledge.",
      viz: "Generate insightful visualizations and plots from the dataset.",
    };

    const agentMap: Record<string, AgentKind> = {
      cleaning: "cleaning",
      wrangling: "wrangling",
      feature_eng: "wrangling",
      viz: "visualization",
    };

    setActionNotice(`Running ${agentType} agent on ${dataset.name}…`);

    try {
      const { run_id } = await api.invoke({
        dataset_id: dataset.id,
        agent: agentMap[agentType] ?? "cleaning",
        instructions: instructionMap[agentType] ?? instructionMap.cleaning,
      });

      const poll = window.setInterval(async () => {
        try {
          const run = await api.run(run_id);
          if (run.status === "completed" || run.status === "failed") {
            window.clearInterval(poll);
            setRunningAction(null);
            if (run.status === "completed") {
              setNodeStatus(nodeId, "success");
              setActionNotice("Agent completed — new derived dataset added.");
              setDatasets(await api.datasets());
            } else {
              setNodeStatus(nodeId, "error", run.message ?? "Agent run failed.");
              setActionNotice(`Agent run failed: ${run.message}`);
            }
          }
        } catch (err) {
          window.clearInterval(poll);
          setRunningAction(null);
          setNodeStatus(nodeId, "error", err instanceof Error ? err.message : String(err));
        }
      }, 800);
    } catch (err) {
      setRunningAction(null);
      const detail = err instanceof Error ? err.message : String(err);
      setNodeStatus(nodeId, "error", detail);
      setActionNotice(`Error: ${detail}`);
    }
  };

  // Keep the ref pointed at the current handler so node closures stay fresh.
  runRef.current = (agentType, nodeId, datasetId) => {
    void runAgentFromNode(agentType, nodeId, datasetId);
  };

  // Run an agent directly from the floating panel (selected dataset).
  const runPanelAction = async (agentName: "cleaning" | "wrangling") => {
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
              setActionNotice("Agent completed — new derived dataset added.");
              setDatasets(await api.datasets());
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
      setActionNotice(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Reset positions: datasets by lineage, agents stacked off their source.
  const resetLayout = useCallback(() => {
    const layout = buildLayout(datasets, activeDatasetId);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    const seen = new Map<string, number>();

    const agentNodes = nodes.filter((n) => n.type === "agentNode");
    const repositioned = agentNodes.map((n) => {
      const sourceId = String(n.data?.datasetId ?? "");
      const sourceNode = byId.get(sourceId);
      const index = seen.get(sourceId) ?? 0;
      seen.set(sourceId, index + 1);
      return {
        ...n,
        position: {
          x: (sourceNode?.position.x ?? 40) + AGENT_X,
          y: (sourceNode?.position.y ?? 60) + index * AGENT_H,
        },
      };
    });

    setNodes([...layout.nodes, ...repositioned]);
    setEdges((prev) => {
      const known = new Set(datasets.map((d) => d.id));
      const agentEdges = prev.filter(
        (e) => e.id.startsWith("e-agent-") && known.has(e.source),
      );
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
            <span>Clean Agent</span>
          </button>
          <button
            type="button"
            className="pipeline-toolbar-btn"
            onClick={() => addAgentNode("Wrangle Agent", "wrangling")}
          >
            <Plus size={12} />
            <span>Wrangle Agent</span>
          </button>
          <button
            type="button"
            className="pipeline-toolbar-btn"
            onClick={() => addAgentNode("Feature Eng", "feature_eng")}
          >
            <Plus size={12} />
            <span>Feature Eng</span>
          </button>
          <button
            type="button"
            className="pipeline-toolbar-btn"
            onClick={() => addAgentNode("Viz Node", "viz")}
          >
            <Plus size={12} />
            <span>Viz Node</span>
          </button>
        </div>
        <div className="pipeline-toolbar-group right">
          <button type="button" className="pipeline-toolbar-btn reset" onClick={resetLayout}>
            <RefreshCw size={12} />
            <span>Reset Layout</span>
          </button>
        </div>
      </div>

      {/* ─── Action Notice ─── */}
      {actionNotice && (
        <div className="pipeline-notice mono">
          <Zap size={13} style={{ color: "var(--accent-blue)" }} />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* ─── Canvas ─── */}
      {loading ? (
        <div className="empty" style={{ minHeight: 400 }}>
          <LoaderCircle className="spin" size={24} />
          <p className="mono">Loading pipeline graph…</p>
        </div>
      ) : (
        <div className="pipeline-body">
          <div className="pipeline-canvas-area">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onInit={(instance) => {
                rfRef.current = instance;
              }}
              fitView
              fitViewOptions={{ padding: 0.25 }}
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

            {/* Empty state — only when the workspace has no datasets. */}
            {datasets.length === 0 && (
              <div className="pipeline-empty-state">
                <Database size={26} style={{ color: "var(--text-dim)" }} />
                <p className="mono">
                  <strong>Build your data pipeline</strong>
                  <br />
                  Load a dataset to start.
                </p>
                <Link href="/datasets" className="button secondary">
                  Go to Datasets
                </Link>
              </div>
            )}

            {/* Floating trigger + panel (profile, run actions, chat). */}
            {selected && (
              <>
                <button
                  type="button"
                  className={`pipeline-profile-btn ${panelOpen ? "active" : ""}`}
                  onClick={() => setPanelOpen((o) => !o)}
                  title={panelOpen ? "Hide dataset panel" : "Show dataset panel"}
                  aria-label="Toggle dataset panel"
                  aria-expanded={panelOpen}
                >
                  {panelOpen ? <X size={14} /> : <Info size={14} />}
                </button>

                {panelOpen && (
                  <div className="pipeline-profile-panel" role="dialog" aria-label="Dataset panel">
                    <div className="pipeline-profile-header">
                      <span className="pipeline-profile-title mono">
                        <BarChart3 size={12} style={{ color: "var(--accent-blue)" }} />
                        PROFILE
                      </span>
                      <button
                        type="button"
                        className="topbar-collapse-btn"
                        onClick={() => setPanelOpen(false)}
                        aria-label="Close panel"
                      >
                        <X size={13} />
                      </button>
                    </div>

                    <div className="pipeline-profile-dataset mono" title={selected.name}>
                      {selected.name}
                      <span
                        className="pipeline-stage-badge"
                        style={{
                          color: stageColors[selected.stage] ?? stageColors.raw,
                          borderColor: stageColors[selected.stage] ?? stageColors.raw,
                          background: `${stageColors[selected.stage] ?? stageColors.raw}18`,
                          marginLeft: 6,
                        }}
                      >
                        {selected.stage.toUpperCase()}
                      </span>
                    </div>

                    {profileLoading ? (
                      <div className="pipeline-profile-state mono">
                        <LoaderCircle className="spin" size={13} />
                        <span>Profiling…</span>
                      </div>
                    ) : profileError ? (
                      <div className="pipeline-profile-state is-error mono">
                        <AlertCircle size={13} />
                        <span>{profileError}</span>
                      </div>
                    ) : profile ? (
                      <>
                        <div className="pipeline-profile-kpis">
                          <div className="pipeline-profile-kpi">
                            <span>ROWS</span>
                            <strong className="mono">
                              {profile.row_count.toLocaleString()}
                            </strong>
                          </div>
                          <div className="pipeline-profile-kpi">
                            <span>COLS</span>
                            <strong className="mono">{profile.col_count}</strong>
                          </div>
                          <div className="pipeline-profile-kpi">
                            <span>MISSING</span>
                            <strong
                              className="mono"
                              style={{
                                color:
                                  profile.missing_pct > 0
                                    ? "var(--warning)"
                                    : "var(--success)",
                              }}
                            >
                              {profile.missing_pct}%
                            </strong>
                          </div>
                          <div className="pipeline-profile-kpi">
                            <span>DUPES</span>
                            <strong className="mono">{profile.duplicate_rows}</strong>
                          </div>
                        </div>

                        <div className="pipeline-profile-cols">
                          {profile.columns.map((c) => (
                            <div key={c.name} className="pipeline-profile-col mono">
                              <span className="col-name" title={c.name}>
                                {c.name}
                              </span>
                              <span className="col-kind">{c.kind}</span>
                              <span
                                className={c.null_count > 0 ? "col-null warn" : "col-null"}
                              >
                                {c.null_count > 0 ? `${c.null_count} null` : "0"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}

                    <div className="pipeline-profile-actions">
                      <button
                        type="button"
                        className="button primary pipeline-action-btn"
                        disabled={Boolean(runningAction)}
                        onClick={() => void runPanelAction("cleaning")}
                      >
                        {runningAction === "cleaning" ? (
                          <LoaderCircle className="spin" size={13} />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        Clean Data
                      </button>
                      <button
                        type="button"
                        className="button secondary pipeline-action-btn"
                        disabled={Boolean(runningAction)}
                        onClick={() => void runPanelAction("wrangling")}
                      >
                        {runningAction === "wrangling" ? (
                          <LoaderCircle className="spin" size={13} />
                        ) : (
                          <Wrench size={13} />
                        )}
                        Wrangle Data
                      </button>
                      <Link href="/chat" className="button secondary pipeline-action-btn small">
                        <MessageSquare size={12} />
                        Chat
                      </Link>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}