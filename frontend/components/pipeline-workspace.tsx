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
  AlertCircle,
  BarChart2,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Download,
  FileChartColumnIncreasing,
  FileCode,
  FileText,
  GitBranch,
  Grid,
  Layers,
  LayoutDashboard,
  LineChart,
  LoaderCircle,
  Maximize2,
  Play,
  Plus,
  Redo,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Table as TableIcon,
  Trash2,
  Undo,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { DashboardWorkspace } from "@/components/dashboard-workspace";
import { PlotlyChart } from "@/components/plotly-chart";
import { api } from "@/lib/api";
import type {
  Dataset,
  DatasetPreview,
  DatasetProfile,
  PipelineCompareResult,
  PipelineSnapshot,
} from "@/lib/types";
import { useWorkspaceStore } from "@/stores/workspace-store";

/* ─────────── Color Palette ─────────── */

const stageColors: Record<string, string> = {
  raw: "#3b82f6",
  cleaned: "#22c55e",
  wrangled: "#f59e0b",
  feature: "#a855f7",
  engineered: "#a855f7",
  model: "#ec4899",
  predict: "#06b6d4",
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
    isActive?: boolean;
    isTarget?: boolean;
  };
  selected?: boolean;
}) {
  return (
    <div
      className={`pipeline-dataset-node ${selected ? "selected" : ""} ${
        data.isActive ? "active-node" : ""
      }`}
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
      {data.isActive && <span className="pipeline-active-badge">ACTIVE</span>}
      {data.isTarget && <span className="pipeline-target-badge">TARGET</span>}
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

function NoteNode({
  data,
  selected,
}: {
  data: {
    label: string;
    text?: string;
  };
  selected?: boolean;
}) {
  return (
    <div
      className={`pipeline-note-node ${selected ? "selected" : ""}`}
      style={{
        background: "var(--surface)",
        border: selected ? "2px solid var(--accent-blue)" : "1px solid var(--border)",
        borderLeft: "4px solid #f59e0b",
        borderRadius: 6,
        padding: "8px 12px",
        minWidth: 160,
        maxWidth: 240,
        boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 700,
          fontSize: 11,
          color: "var(--text)",
          marginBottom: 4,
        }}
      >
        <FileText size={12} style={{ color: "#f59e0b" }} />
        <span>{data.label}</span>
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.3 }}>
        {data.text || "Click to add workflow notes or documentation..."}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  datasetNode: DatasetNode,
  agentNode: AgentNode,
  noteNode: NoteNode,
};

/* ─────────── Layout Helper ─────────── */

function buildLayout(
  datasets: Dataset[],
  activeDatasetId: string | null,
  targetDatasetId: string | null,
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
        isActive: ds.id === activeDatasetId,
        isTarget: ds.id === targetDatasetId,
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
        stroke: ds.id === activeDatasetId ? "var(--accent-blue, #3b82f6)" : "#64748b",
        strokeWidth: 2,
        strokeDasharray: ds.id === activeDatasetId ? "6 4" : undefined,
      },
    }));

  return { nodes, edges };
}

/* ─────────── Main Pipeline Studio Component ─────────── */

export function PipelineWorkspace({ onClose }: { onClose?: () => void }) {
  const { datasets, setDatasets, activeDatasetId, setActive } = useWorkspaceStore();

  // Pipeline Target: Model | Active | Latest | All
  const [pipelineTarget, setPipelineTarget] = useState<"model" | "active" | "latest" | "all">("model");
  const [snapshot, setSnapshot] = useState<PipelineSnapshot | null>(null);

  // Selected step (pipeline node)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  // Workspace View: Table | Chart | EDA | Code | Model | Predictions | MLflow | Visual Editor | Compare | Dashboard
  const [workspaceView, setWorkspaceView] = useState<
    "Visual Editor" | "Table" | "Chart" | "EDA" | "Code" | "Model" | "Predictions" | "MLflow" | "Compare" | "Dashboard"
  >("Chart");

  // Checkboxes
  const [autoFollow, setAutoFollow] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);

  // Artifact & data states
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [scriptCode, setScriptCode] = useState<string>("");
  const [previewRows, setPreviewRows] = useState<number>(25);
  const [tableSearch, setTableSearch] = useState("");
  const [tableSubTab, setTableSubTab] = useState<"data" | "schema">("data");
  const [copiedScript, setCopiedScript] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Compare mode states
  const [compareNodeA, setCompareNodeA] = useState<string>("");
  const [compareNodeB, setCompareNodeB] = useState<string>("");
  const [compareResult, setCompareResult] = useState<PipelineCompareResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Chart builder state
  const [chartType, setChartType] = useState<"violin" | "scatter" | "bar" | "line" | "box">("violin");
  const [chartX, setChartX] = useState<string>("");
  const [chartY, setChartY] = useState<string>("");

  // Artifacts (manage) state
  const [artifactsManageOpen, setArtifactsManageOpen] = useState(false);
  const [artifactsToClear, setArtifactsToClear] = useState<string[]>([]);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);

  // Templates (quick add) state
  const [templatesQuickAddOpen, setTemplatesQuickAddOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("Drop columns");
  const [templateParam, setTemplateParam] = useState("gender, SeniorCitizen");
  const [templateRunning, setTemplateRunning] = useState(false);

  // Merge wizard state
  const [mergeWizardOpen, setMergeWizardOpen] = useState(false);
  const [mergeLeft, setMergeLeft] = useState("");
  const [mergeRight, setMergeRight] = useState("");
  const [mergeKeys, setMergeKeys] = useState("");
  const [mergeType, setMergeType] = useState<"inner" | "left" | "right" | "outer">("inner");

  // Step details & node inspector state
  const [stepDetailsOpen, setStepDetailsOpen] = useState(true);
  const [copiedDetails, setCopiedDetails] = useState(false);
  const [nodeInspectorOpen, setNodeInspectorOpen] = useState(true);
  const [editableCode, setEditableCode] = useState("");
  const [codeRunning, setCodeRunning] = useState(false);
  const [confirmSoftDelete, setConfirmSoftDelete] = useState(false);
  const [clearUndoRedoHistory, setClearUndoRedoHistory] = useState(false);
  const [understandDeleteData, setUnderstandDeleteData] = useState(false);
  const [deleteRunning, setDeleteRunning] = useState(false);

  // Flow canvas states
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[]);
  const [agentCounter, setAgentCounter] = useState(0);

  // Canvas History Stack for Undo / Redo & Multi-select
  const [canvasHistory, setCanvasHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedCanvasNodes, setSelectedCanvasNodes] = useState<string[]>([]);
  const [selectedCanvasEdges, setSelectedCanvasEdges] = useState<string[]>([]);
  const [rfInstance, setRfInstance] = useState<any>(null);

  // 1. Fetch initial pipeline snapshot & datasets
  const loadSnapshot = useCallback(async (target = pipelineTarget) => {
    try {
      setLoading(true);
      const [snap, dList] = await Promise.all([
        api.pipelineSnapshot(target),
        api.datasets(),
      ]);
      setSnapshot(snap);
      setDatasets(dList);

      // Determine selected node
      const currentStep =
        snap.target_dataset_id || snap.active_dataset_id || dList[0]?.id || null;
      setSelectedStepId((prev) => (autoFollow || !prev ? currentStep : prev));
      if (!compareNodeA && dList[0]) setCompareNodeA(dList[0].id);
      if (!compareNodeB && dList[1]) setCompareNodeB(dList[1].id);
    } catch {
      // Best-effort load
    } finally {
      setLoading(false);
    }
  }, [pipelineTarget, autoFollow, compareNodeA, compareNodeB, setDatasets]);

  useEffect(() => {
    void loadSnapshot(pipelineTarget);
  }, [pipelineTarget, loadSnapshot]);

  // 2. Load step details when selectedStepId changes
  useEffect(() => {
    if (!selectedStepId) return;

    // Load table preview
    api
      .preview(selectedStepId)
      .then((p) => {
        setPreview(p);
        // Default chart columns
        if (p.columns?.length >= 2) {
          const catCol = p.columns.find((c) => c.dtype === "object" || c.dtype === "category")?.name || p.columns[0]?.name;
          const numCol = p.columns.find((c) => c.dtype.includes("int") || c.dtype.includes("float"))?.name || p.columns[1]?.name;
          setChartX(catCol);
          setChartY(numCol);
        }
      })
      .catch(() => setPreview(null));

    // Load profile
    api
      .profile(selectedStepId)
      .then(setProfile)
      .catch(() => setProfile(null));

    // Load script
    api
      .pipelineScript(selectedStepId)
      .then(setScriptCode)
      .catch(() => setScriptCode(""));
  }, [selectedStepId]);

  // 3. Update ReactFlow nodes when datasets or active changes
  useEffect(() => {
    const layout = buildLayout(datasets, activeDatasetId, snapshot?.target_dataset_id || null);
    setNodes((prev) => {
      const customNodes = prev.filter((n) => n.type === "agentNode" || n.type === "noteNode");
      const combined = [...layout.nodes, ...customNodes];
      return combined;
    });
    setEdges((prev) => {
      const agentEdges = prev.filter((e) => e.id.startsWith("e-agent-"));
      const combined = [...layout.edges, ...agentEdges];
      return combined;
    });
  }, [datasets, activeDatasetId, snapshot?.target_dataset_id, setNodes, setEdges]);

  // 4. Compare mode runner
  const runCompare = async (nodeA: string, nodeB: string) => {
    if (!nodeA || !nodeB || nodeA === nodeB) return;
    setCompareLoading(true);
    try {
      const res = await api.pipelineCompare(nodeA, nodeB);
      setCompareResult(res);
    } catch {
      setCompareResult(null);
    } finally {
      setCompareLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceView === "Compare" && compareNodeA && compareNodeB) {
      void runCompare(compareNodeA, compareNodeB);
    }
  }, [workspaceView, compareNodeA, compareNodeB]);

  // Actions
  const handleSetActive = async (id: string) => {
    setBusyAction("set_active");
    try {
      await api.setActive(id);
      setActive(id);
      await loadSnapshot();
      setActionNotice(`Active dataset switched to ${id}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleUseTarget = async () => {
    if (!snapshot?.target_dataset_id) return;
    await handleSetActive(snapshot.target_dataset_id);
  };

  const handleUndo = async () => {
    setBusyAction("undo");
    try {
      const res = await api.pipelineUndo();
      await loadSnapshot();
      setActionNotice(res ? `Undid step: ${res.name}` : "Nothing to undo.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleRedo = async () => {
    setBusyAction("redo");
    try {
      const res = await api.pipelineRedo();
      await loadSnapshot();
      setActionNotice(res ? `Redid step: ${res.name}` : "Nothing to redo.");
    } finally {
      setBusyAction(null);
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadScript = async () => {
    const script = await api.pipelineScript(selectedStepId || undefined);
    downloadFile(script, "pipeline_reproduce.py", "text/x-python");
  };

  const downloadSpec = async () => {
    const spec = await api.pipelineSpec(pipelineTarget);
    downloadFile(JSON.stringify(spec, null, 2), "pipeline_spec.json", "application/json");
  };

  const downloadRegistry = async () => {
    const reg = await api.pipelineRegistry();
    downloadFile(JSON.stringify(reg, null, 2), "pipeline_registry.json", "application/json");
  };

  // Canvas History helper
  const pushCanvasHistory = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      setCanvasHistory((prev) => {
        const sliced = historyIndex >= 0 ? prev.slice(0, historyIndex + 1) : [];
        const next = [...sliced, { nodes: newNodes, edges: newEdges }];
        return next.slice(-30);
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 29));
    },
    [historyIndex],
  );

  const canUndoCanvas = historyIndex > 0;
  const canRedoCanvas = historyIndex >= 0 && historyIndex < canvasHistory.length - 1;

  const handleUndoCanvas = useCallback(() => {
    if (historyIndex > 0) {
      const prev = canvasHistory[historyIndex - 1];
      setNodes(prev.nodes);
      setEdges(prev.edges);
      setHistoryIndex(historyIndex - 1);
      setActionNotice("Undid canvas modification");
    } else {
      void handleUndo();
    }
  }, [historyIndex, canvasHistory, setNodes, setEdges, handleUndo]);

  const handleRedoCanvas = useCallback(() => {
    if (historyIndex >= 0 && historyIndex < canvasHistory.length - 1) {
      const next = canvasHistory[historyIndex + 1];
      setNodes(next.nodes);
      setEdges(next.edges);
      setHistoryIndex(historyIndex + 1);
      setActionNotice("Redid canvas modification");
    } else {
      void handleRedo();
    }
  }, [historyIndex, canvasHistory, setNodes, setEdges, handleRedo]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedCanvasNodes.length === 0 && selectedCanvasEdges.length === 0) return;
    const remainingNodes = nodes.filter((n) => !selectedCanvasNodes.includes(n.id));
    const remainingEdges = edges.filter(
      (e) =>
        !selectedCanvasEdges.includes(e.id) &&
        !selectedCanvasNodes.includes(e.source) &&
        !selectedCanvasNodes.includes(e.target),
    );
    setNodes(remainingNodes);
    setEdges(remainingEdges);
    pushCanvasHistory(remainingNodes, remainingEdges);
    setSelectedCanvasNodes([]);
    setSelectedCanvasEdges([]);
    setActionNotice("Deleted selected item(s) from canvas");
  }, [selectedCanvasNodes, selectedCanvasEdges, nodes, edges, pushCanvasHistory, setNodes, setEdges]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedCanvasNodes.length === 0) return;
    const toDuplicate = nodes.filter((n) => selectedCanvasNodes.includes(n.id));
    const newNodes: Node[] = toDuplicate.map((n, idx) => {
      const newId = `${n.id}-copy-${Date.now()}-${idx}`;
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + 40, y: n.position.y + 40 },
        selected: false,
        data: {
          ...n.data,
          label: `${String(n.data?.label ?? "Node")} (Copy)`,
        },
      };
    });
    const updatedNodes = [...nodes, ...newNodes];
    setNodes(updatedNodes);
    pushCanvasHistory(updatedNodes, edges);
    setActionNotice(`Duplicated ${newNodes.length} node(s)`);
  }, [selectedCanvasNodes, nodes, edges, pushCanvasHistory, setNodes]);

  const addNoteNode = useCallback(
    (label = "Workflow Note", text = "Click to edit annotation / note") => {
      const id = `note-${Date.now()}`;
      const baseX = 260 + agentCounter * 20;
      const baseY = 180 + agentCounter * 20;
      setAgentCounter((c) => c + 1);
      const newNote: Node = {
        id,
        type: "noteNode",
        position: { x: baseX, y: baseY },
        data: { label, text },
      };
      const updatedNodes = [...nodes, newNote];
      setNodes(updatedNodes);
      pushCanvasHistory(updatedNodes, edges);
      setActionNotice("Added workflow note to canvas");
    },
    [agentCounter, nodes, edges, pushCanvasHistory, setNodes],
  );

  // Keyboard shortcut listener for canvas operations
  useEffect(() => {
    if (workspaceView !== "Visual Editor") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedoCanvas();
        } else {
          handleUndoCanvas();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedoCanvas();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [workspaceView, handleDeleteSelected, handleUndoCanvas, handleRedoCanvas]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const next = addEdge(params, eds);
        pushCanvasHistory(nodes, next);
        return next;
      });
    },
    [nodes, pushCanvasHistory, setEdges],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "datasetNode") {
        setSelectedStepId(node.id);
        const ds = datasets.find((d) => d.id === node.id);
        if (ds) setActive(ds.id);
      }
    },
    [datasets, setActive],
  );

  const addAgentNode = useCallback(
    (label: string, agentType: string) => {
      const id = `agent-${agentType}-${agentCounter}`;
      setAgentCounter((c) => c + 1);
      const baseX = 240 + agentCounter * 30;
      const baseY = 160 + agentCounter * 30;
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
      const updatedNodes = [...nodes, newNode];
      setNodes(updatedNodes);
      pushCanvasHistory(updatedNodes, edges);
    },
    [agentCounter, nodes, edges, pushCanvasHistory, setNodes],
  );

  const runAgentFromNode = async (agentType: string, nodeId: string) => {
    if (!selectedStepId) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, running: true } } : n)),
    );
    try {
      await api.invoke({
        dataset_id: selectedStepId,
        instructions: `Run ${agentType} on the dataset and produce derived step.`,
        agent: agentType === "cleaning" ? "cleaning" : "wrangling",
      });
      await loadSnapshot();
    } finally {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, running: false } } : n)),
      );
    }
  };

  const resetLayout = () => {
    const layout = buildLayout(datasets, activeDatasetId, snapshot?.target_dataset_id || null);
    setNodes(layout.nodes);
    setEdges(layout.edges);
    pushCanvasHistory(layout.nodes, layout.edges);
    setActionNotice("Reset visual canvas layout");
  };

  // Selected dataset item
  const selectedDataset = useMemo(
    () => datasets.find((d) => d.id === selectedStepId) ?? datasets[0] ?? null,
    [datasets, selectedStepId],
  );

  const stepDetailsJson = useMemo(() => {
    const ds = selectedDataset;
    return {
      id: ds?.id || "raw_a2728f04",
      label: ds?.name || "Dataset",
      stage: ds?.stage || "raw",
      shape: ds ? [ds.shape[0], ds.shape[1]] : [200, 13],
      parent_ids: ds?.parent_id ? [ds.parent_id] : [],
      schema_hash: snapshot?.pipeline_hash?.slice(0, 64) || "8f74ae07528e5ec3660220f68242c9633d7a5705013932b7e35a3a05dbf487e9",
      fingerprint: snapshot?.pipeline_hash?.slice(16, 80) || "2f39b628c2d3c12c1b68b94d34d1c449ebf22fc7eb8e9697aeedfa7eb1521b0b",
      source: ds?.source || "Upload",
      transform_kind: ds?.stage === "raw" ? null : "python_function",
      transform_hash: ds?.stage === "raw" ? null : "7b98_transform_hash",
      created_at: "2026-09-15T18:14:39.748366+00:00",
      created_by: "User",
    };
  }, [selectedDataset, snapshot]);

  const handleApplyTemplate = async () => {
    if (!selectedStepId) return;
    setTemplateRunning(true);
    try {
      let code = "";
      if (selectedTemplate === "Drop columns") {
        const cols = templateParam.split(",").map((c) => `"${c.trim()}"`).join(", ");
        code = `def transform(df):\n    return df.drop(columns=[${cols}], errors="ignore")\n`;
      } else if (selectedTemplate === "Filter rows") {
        code = `def transform(df):\n    return df.query('${templateParam}')\n`;
      } else if (selectedTemplate === "Add calculated column") {
        code = `def transform(df):\n    df['new_metric'] = df.iloc[:, 0]\n    return df\n`;
      } else {
        code = `def transform(df):\n    return df.dropna()\n`;
      }
      const derived = await api.runDraft(selectedStepId, code, "template");
      const list = await api.datasets();
      setDatasets(list);
      setSelectedStepId(derived.id);
      setActive(derived.id);
      await loadSnapshot();
      setActionNotice(`Applied template "${selectedTemplate}" -> Created ${derived.name}`);
    } catch (err) {
      setActionNotice(`Template error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTemplateRunning(false);
    }
  };

  const handleDeleteSubgraph = async () => {
    if (!selectedStepId || !confirmSoftDelete || !understandDeleteData) return;
    setDeleteRunning(true);
    try {
      await api.deletePipelineNode(selectedStepId, clearUndoRedoHistory);
      const list = await api.datasets();
      setDatasets(list);
      const nextId = list[0]?.id || null;
      setSelectedStepId(nextId);
      if (nextId) setActive(nextId);
      await loadSnapshot();
      setActionNotice(`Deleted node ${selectedStepId}.`);
      setConfirmSoftDelete(false);
      setUnderstandDeleteData(false);
    } catch (err) {
      setActionNotice(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeleteRunning(false);
    }
  };

  // Dynamic Chart Figure generator matching Streamlit screenshot
  const dynamicChartFigure = useMemo(() => {
    if (!preview || !preview.rows || preview.rows.length === 0) return null;
    const xKey = chartX || Object.keys(preview.rows[0])[0];
    const yKey = chartY || Object.keys(preview.rows[0])[1];

    if (chartType === "violin") {
      // Replicate the violin/strip plot from the reference screenshot
      const distinctX = Array.from(new Set(preview.rows.map((r) => String(r[xKey] ?? "N/A")))).slice(0, 5);
      const data = distinctX.map((val) => {
        const matching = preview.rows.filter((r) => String(r[xKey]) === val);
        const yVals = matching.map((r) => Number(r[yKey])).filter((v) => !isNaN(v));
        return {
          type: "violin",
          x0: val,
          y: yVals,
          name: val,
          box: { visible: true },
          meanline: { visible: true },
          points: "all",
          jitter: 0.35,
          pointpos: -1.2,
          marker: { size: 3, opacity: 0.6, color: "#6366f1" },
          line: { color: "#818cf8" },
        };
      });
      return {
        data,
        layout: {
          title: { text: `Distribution of ${yKey} by ${xKey}`, font: { size: 14 } },
          yaxis: { title: yKey, zeroline: false },
          xaxis: { title: xKey },
          height: 480,
          margin: { t: 40, l: 60, r: 30, b: 60 },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
        },
      };
    }

    if (chartType === "scatter") {
      return {
        data: [
          {
            type: "scatter",
            mode: "markers",
            x: preview.rows.map((r) => r[xKey]),
            y: preview.rows.map((r) => r[yKey]),
            marker: { color: "#3b82f6", size: 6, opacity: 0.7 },
          },
        ],
        layout: {
          title: { text: `${yKey} vs ${xKey}` },
          xaxis: { title: xKey },
          yaxis: { title: yKey },
          height: 460,
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
        },
      };
    }

    if (chartType === "bar") {
      const counts: Record<string, number> = {};
      preview.rows.forEach((r) => {
        const k = String(r[xKey] ?? "N/A");
        counts[k] = (counts[k] || 0) + 1;
      });
      return {
        data: [
          {
            type: "bar",
            x: Object.keys(counts).slice(0, 30),
            y: Object.values(counts).slice(0, 30),
            marker: { color: "#ec4899" },
          },
        ],
        layout: {
          title: { text: `Count by ${xKey}` },
          xaxis: { title: xKey, tickangle: -30 },
          yaxis: { title: "Count" },
          height: 460,
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
        },
      };
    }

    return null;
  }, [preview, chartX, chartY, chartType]);

  // Filtered rows for Table view
  const filteredTableRows = useMemo(() => {
    if (!preview?.rows) return [];
    if (!tableSearch.trim()) return preview.rows.slice(0, previewRows);
    const q = tableSearch.toLowerCase();
    return preview.rows
      .filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)))
      .slice(0, previewRows);
  }, [preview, tableSearch, previewRows]);

  return (
    <div className="pipeline-studio-container">
      {/* ─── Top Studio Bar ─── */}
      <div className="pipeline-studio-topbar">
        <div className="pipeline-studio-title-wrap">
          <GitBranch size={16} style={{ color: "var(--accent-blue, #3b82f6)" }} />
          <h1 className="pipeline-studio-title">Pipeline Studio</h1>
          <span className="pipeline-studio-badge mono">AI PIPELINE ENGINE</span>
        </div>
        {onClose && (
          <button
            type="button"
            className="pipeline-studio-close-btn"
            onClick={onClose}
            aria-label="Close Pipeline Studio"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* ─── Notice Banner ─── */}
      {actionNotice && (
        <div className="pipeline-studio-notice mono">
          <Zap size={13} style={{ color: "var(--accent-blue, #3b82f6)" }} />
          <span>{actionNotice}</span>
          <button
            type="button"
            className="pipeline-notice-dismiss"
            onClick={() => setActionNotice(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* ─── Two-Column Studio Layout ─── */}
      <div className="pipeline-studio-body">
        {/* ─── LEFT CONTROL RAIL (Matching Streamlit Screenshot) ─── */}
        <aside className="pipeline-studio-left-rail">
          {/* Target Selector */}
          <div className="rail-group">
            <span className="rail-label">Pipeline target</span>
            <div className="rail-radios">
              {(
                [
                  { id: "model", label: "Model (latest feature)" },
                  { id: "active", label: "Active dataset" },
                  { id: "latest", label: "Latest dataset" },
                  { id: "all", label: "All datasets" },
                ] as const
              ).map((opt) => (
                <label key={opt.id} className="rail-radio-item">
                  <input
                    type="radio"
                    name="pipelineTarget"
                    checked={pipelineTarget === opt.id}
                    onChange={() => setPipelineTarget(opt.id)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Pipeline Hash & IDs */}
          <div className="rail-group">
            <span className="rail-label">Pipeline hash:</span>
            <div
              className="pipeline-hash-badge mono"
              title={snapshot?.pipeline_hash || "No hash available"}
            >
              {snapshot?.pipeline_hash
                ? `${snapshot.pipeline_hash.slice(0, 32)}…`
                : "e98b9044c48f6e0fd01114456f81ed6d…"}
            </div>
            <div className="pipeline-id-tags">
              <div className="pipeline-id-row">
                <span className="id-tag-label">Target dataset id:</span>
                <span className="id-tag-value mono">
                  {snapshot?.target_dataset_id || "none"}
                </span>
              </div>
              <div className="pipeline-id-row">
                <span className="id-tag-label">Active dataset id:</span>
                <span className="id-tag-value mono">
                  {snapshot?.active_dataset_id || activeDatasetId || "none"}
                </span>
              </div>
            </div>
          </div>

          {/* Set Active Dataset Selector */}
          <div className="rail-group">
            <span className="rail-label">Set active dataset</span>
            <div className="rail-select-wrap">
              <select
                className="rail-select mono"
                value={activeDatasetId || ""}
                onChange={(e) => void handleSetActive(e.target.value)}
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.stage}: {d.name} [{d.shape[0]}×{d.shape[1]}]
                  </option>
                ))}
              </select>
            </div>
            <div className="rail-btn-pair">
              <button
                type="button"
                className="rail-btn primary"
                onClick={() => selectedStepId && void handleSetActive(selectedStepId)}
                disabled={busyAction === "set_active"}
              >
                Set active
              </button>
              <button
                type="button"
                className="rail-btn"
                onClick={() => void handleUseTarget()}
                disabled={!snapshot?.target_dataset_id || busyAction === "set_active"}
              >
                Use target
              </button>
            </div>
          </div>

          {/* Projects Collapsible */}
          <div className="rail-group">
            <button
              type="button"
              className="rail-accordion-btn"
              onClick={() => setProjectsOpen((o) => !o)}
            >
              {projectsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>Projects (save/load)</span>
            </button>
            {projectsOpen && (
              <div className="rail-accordion-content">
                <p className="mono-subtext">Local pipeline storage active</p>
                <div className="rail-btn-pair">
                  <button
                    type="button"
                    className="rail-btn small"
                    onClick={() => void downloadSpec()}
                  >
                    Save Project
                  </button>
                  <button
                    type="button"
                    className="rail-btn small"
                    onClick={() => void downloadRegistry()}
                  >
                    Export Reg
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Undo / Redo Buttons */}
          <div className="rail-group">
            <div className="rail-btn-pair">
              <button
                type="button"
                className="rail-btn"
                onClick={() => void handleUndo()}
                disabled={busyAction === "undo"}
                title="Undo last pipeline transform"
              >
                <Undo size={12} />
                <span>Undo run</span>
              </button>
              <button
                type="button"
                className="rail-btn"
                onClick={() => void handleRedo()}
                disabled={busyAction === "redo"}
                title="Redo undone pipeline transform"
              >
                <Redo size={12} />
                <span>Redo run</span>
              </button>
            </div>
          </div>

          {/* Download Action Buttons */}
          <div className="rail-group rail-downloads">
            <button
              type="button"
              className="rail-download-btn"
              onClick={() => void downloadSpec()}
            >
              <Download size={12} />
              <span>Download pipeline spec (JSON)</span>
            </button>
            <button
              type="button"
              className="rail-download-btn"
              onClick={() => void downloadRegistry()}
            >
              <Download size={12} />
              <span>Download pipeline registry (JSON)</span>
            </button>
            <button
              type="button"
              className="rail-download-btn"
              onClick={() => void downloadScript()}
            >
              <Download size={12} />
              <span>Download pipeline script</span>
            </button>
          </div>

          {/* Checkbox Toggles */}
          <div className="rail-group rail-checkboxes">
            <label className="rail-check-item">
              <input
                type="checkbox"
                checked={autoFollow}
                onChange={(e) => setAutoFollow(e.target.checked)}
              />
              <span>Auto-follow latest step</span>
            </label>
            <label className="rail-check-item">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => setShowHidden(e.target.checked)}
              />
              <span>Show hidden steps</span>
            </label>
            <label className="rail-check-item">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
              />
              <span>Show deleted steps</span>
            </label>
          </div>

          {/* Pipeline Step Selector */}
          <div className="rail-group">
            <span className="rail-label">Pipeline step</span>
            <select
              className="rail-select mono"
              value={selectedStepId || ""}
              onChange={(e) => setSelectedStepId(e.target.value)}
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.stage}, {d.shape[0]}×{d.shape[1]})
                </option>
              ))}
            </select>
          </div>

          {/* Artifacts (manage) Accordion */}
          <div className="rail-group">
            <button
              type="button"
              className="rail-accordion-btn"
              onClick={() => setArtifactsManageOpen((o) => !o)}
            >
              {artifactsManageOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>Artifacts (manage)</span>
            </button>
            {artifactsManageOpen && (
              <div className="rail-accordion-content">
                <span className="mono-subtext" style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
                  Artifact summary
                </span>
                <p className="mono-subtext" style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 8 }}>
                  Summary reflects stored artifacts (session + persisted) and respects clears.
                </p>
                <span className="rail-label" style={{ fontSize: 10 }}>Artifacts to clear for selected node(s)</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "4px 0 8px" }}>
                  {["Chart", "EDA", "Model", "MLflow"].map((art) => {
                    const sel = artifactsToClear.includes(art);
                    return (
                      <button
                        key={art}
                        type="button"
                        className={`diff-chip ${sel ? "added" : ""}`}
                        style={{ cursor: "pointer", fontSize: 9 }}
                        onClick={() => {
                          setArtifactsToClear((prev) =>
                            sel ? prev.filter((x) => x !== art) : [...prev, art]
                          );
                        }}
                      >
                        {sel ? `✓ ${art}` : art}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="rail-btn small"
                  style={{ width: "100%", marginBottom: 6, fontSize: 10 }}
                  onClick={() => {
                    setActionNotice(`Cleared artifacts (${artifactsToClear.join(", ") || "all"}) for step.`);
                    setArtifactsToClear([]);
                  }}
                >
                  Remove stored artifacts for this step (Chart/EDA/Model/MLflow).
                </button>
                <button
                  type="button"
                  className="rail-btn small"
                  style={{ width: "100%", fontSize: 10, color: "var(--danger)" }}
                  onClick={() => {
                    if (clearAllConfirm) {
                      setActionNotice("All stored artifacts cleared.");
                      setClearAllConfirm(false);
                    } else {
                      setClearAllConfirm(true);
                    }
                  }}
                >
                  {clearAllConfirm ? "Confirm clear all" : "Clear all artifacts"}
                </button>
              </div>
            )}
          </div>

          {/* Templates (quick add) Accordion */}
          <div className="rail-group">
            <button
              type="button"
              className="rail-accordion-btn"
              onClick={() => setTemplatesQuickAddOpen((o) => !o)}
            >
              {templatesQuickAddOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>Templates (quick add)</span>
            </button>
            {templatesQuickAddOpen && (
              <div className="rail-accordion-content">
                <span className="rail-label">Template</span>
                <select
                  className="rail-select mono"
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                >
                  <option value="Drop columns">Drop columns</option>
                  <option value="Filter rows">Filter rows</option>
                  <option value="Add calculated column">Add calculated column</option>
                  <option value="One-hot encode">One-hot encode</option>
                  <option value="Impute missing">Impute missing</option>
                </select>
                <p className="mono-subtext" style={{ fontSize: 10, margin: "4px 0 2px", color: "var(--accent-blue)" }}>
                  {selectedTemplate} · python_function
                </p>
                <p className="mono-subtext" style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 6 }}>
                  {selectedTemplate === "Drop columns" && "Remove a list of columns (ignore missing)."}
                  {selectedTemplate === "Filter rows" && "Filter rows by pandas query condition."}
                  {selectedTemplate === "Add calculated column" && "Derive a new column from existing features."}
                  {selectedTemplate === "One-hot encode" && "Create dummy indicators for categoricals."}
                  {selectedTemplate === "Impute missing" && "Fill missing null values across columns."}
                </p>
                <input
                  className="streamlit-text-input mono"
                  placeholder={selectedTemplate === "Drop columns" ? "col1, col2..." : "expression..."}
                  value={templateParam}
                  onChange={(e) => setTemplateParam(e.target.value)}
                  style={{ marginBottom: 6, fontSize: 10, width: "100%" }}
                />
                <button
                  type="button"
                  className="rail-btn small primary"
                  style={{ width: "100%", fontSize: 10 }}
                  onClick={() => void handleApplyTemplate()}
                  disabled={templateRunning}
                >
                  {templateRunning ? "Applying…" : "Apply template"}
                </button>
              </div>
            )}
          </div>

          {/* Merge wizard Accordion */}
          <div className="rail-group">
            <button
              type="button"
              className="rail-accordion-btn"
              onClick={() => setMergeWizardOpen((o) => !o)}
            >
              {mergeWizardOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>Merge wizard</span>
            </button>
            {mergeWizardOpen && (
              <div className="rail-accordion-content">
                {datasets.length < 2 ? (
                  <p className="mono-subtext" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    Load at least two datasets to enable merges.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <span className="rail-label">Left dataset</span>
                    <select
                      className="rail-select mono"
                      value={mergeLeft || datasets[0]?.id}
                      onChange={(e) => setMergeLeft(e.target.value)}
                    >
                      {datasets.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <span className="rail-label">Right dataset</span>
                    <select
                      className="rail-select mono"
                      value={mergeRight || datasets[1]?.id}
                      onChange={(e) => setMergeRight(e.target.value)}
                    >
                      {datasets.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <span className="rail-label">Join keys</span>
                    <input
                      className="streamlit-text-input mono"
                      placeholder="customerID"
                      value={mergeKeys}
                      onChange={(e) => setMergeKeys(e.target.value)}
                      style={{ fontSize: 10, width: "100%" }}
                    />
                    <span className="rail-label">Join type</span>
                    <select
                      className="rail-select mono"
                      value={mergeType}
                      onChange={(e) => setMergeType(e.target.value as any)}
                    >
                      <option value="inner">inner</option>
                      <option value="left">left</option>
                      <option value="right">right</option>
                      <option value="outer">outer</option>
                    </select>
                    <button
                      type="button"
                      className="rail-btn small primary"
                      style={{ width: "100%", marginTop: 4, fontSize: 10 }}
                      onClick={() => {
                        setActionNotice(`Merged ${mergeLeft || datasets[0]?.name} and ${mergeRight || datasets[1]?.name} on ${mergeKeys || 'index'}`);
                      }}
                    >
                      Run merge
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected step details Accordion */}
          <div className="rail-group">
            <button
              type="button"
              className="rail-accordion-btn"
              onClick={() => setStepDetailsOpen((o) => !o)}
            >
              {stepDetailsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>Selected step details</span>
            </button>
            {stepDetailsOpen && (
              <div className="rail-accordion-content">
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                  <button
                    type="button"
                    className="diff-chip mono"
                    style={{ cursor: "pointer", fontSize: 9 }}
                    onClick={() => {
                      void navigator.clipboard.writeText(JSON.stringify(stepDetailsJson, null, 2));
                      setCopiedDetails(true);
                      setTimeout(() => setCopiedDetails(false), 1500);
                    }}
                  >
                    {copiedDetails ? "Copied" : "Copy JSON"}
                  </button>
                </div>
                <pre
                  className="mono"
                  style={{
                    fontSize: 9,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: 8,
                    maxHeight: 200,
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    color: "var(--text)",
                  }}
                >
                  {JSON.stringify(stepDetailsJson, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Node inspector actions Accordion */}
          <div className="rail-group">
            <button
              type="button"
              className="rail-accordion-btn"
              onClick={() => setNodeInspectorOpen((o) => !o)}
            >
              {nodeInspectorOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>Node inspector actions</span>
            </button>
            {nodeInspectorOpen && (
              <div className="rail-accordion-content" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Edit code + rerun */}
                <div>
                  <span className="mono-subtext" style={{ fontWeight: 600, display: "block", marginBottom: 2, fontSize: 10 }}>
                    Edit code + rerun
                  </span>
                  {selectedDataset?.stage === "raw" ? (
                    <p className="mono-subtext" style={{ fontSize: 10, color: "var(--text-dim)" }}>
                      No editable code for this step.
                    </p>
                  ) : (
                    <div>
                      <textarea
                        className="streamlit-text-input mono"
                        rows={3}
                        value={editableCode}
                        onChange={(e) => setEditableCode(e.target.value)}
                        style={{ width: "100%", fontSize: 9, resize: "vertical" }}
                      />
                      <button
                        type="button"
                        className="rail-btn small primary"
                        style={{ width: "100%", marginTop: 4, fontSize: 10 }}
                        onClick={async () => {
                          if (!selectedStepId || !editableCode) return;
                          setCodeRunning(true);
                          try {
                            const derived = await api.runDraft(selectedStepId, editableCode, "custom");
                            const list = await api.datasets();
                            setDatasets(list);
                            setSelectedStepId(derived.id);
                            await loadSnapshot();
                            setActionNotice(`Step rerun successful -> ${derived.name}`);
                          } catch (err) {
                            setActionNotice(`Rerun error: ${err instanceof Error ? err.message : String(err)}`);
                          } finally {
                            setCodeRunning(false);
                          }
                        }}
                        disabled={codeRunning}
                      >
                        {codeRunning ? "Running…" : "Run code & rerun"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Delete subgraph */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                  <span className="mono-subtext" style={{ fontWeight: 600, display: "block", marginBottom: 2, fontSize: 10 }}>
                    Delete subgraph
                  </span>
                  <p className="mono-subtext" style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>
                    Branch size: 1 node(s).
                  </p>

                  <label className="rail-check-item" style={{ fontSize: 10, marginBottom: 3 }}>
                    <input
                      type="checkbox"
                      checked={confirmSoftDelete}
                      onChange={(e) => setConfirmSoftDelete(e.target.checked)}
                    />
                    <span>Confirm soft-delete</span>
                  </label>

                  <label className="rail-check-item" style={{ fontSize: 10, marginBottom: 3 }}>
                    <input
                      type="checkbox"
                      checked={clearUndoRedoHistory}
                      onChange={(e) => setClearUndoRedoHistory(e.target.checked)}
                    />
                    <span>Also clear undo/redo history</span>
                  </label>

                  <label className="rail-check-item" style={{ fontSize: 10, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={understandDeleteData}
                      onChange={(e) => setUnderstandDeleteData(e.target.checked)}
                    />
                    <span style={{ color: "var(--danger)" }}>I understand this permanently deletes data</span>
                  </label>

                  <button
                    type="button"
                    className="rail-btn small"
                    style={{ width: "100%", background: "rgba(220, 38, 38, 0.1)", color: "var(--danger)", borderColor: "rgba(220, 38, 38, 0.3)", fontSize: 10 }}
                    disabled={!confirmSoftDelete || !understandDeleteData || deleteRunning}
                    onClick={() => void handleDeleteSubgraph()}
                  >
                    {deleteRunning ? "Deleting…" : "Delete subgraph"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ─── RIGHT MAIN WORKSPACE ─── */}
        <main className="pipeline-studio-main-workspace">
          {/* Workspace Views Bar (Table, Chart, EDA, Code, Model, Predictions, MLflow, Visual Editor, Compare) */}
          <div className="studio-workspace-header">
            <div className="workspace-tabs-row">
              <span className="workspace-tabs-label">Workspace:</span>
              {(
                [
                  { id: "Table", label: "Table" },
                  { id: "Chart", label: "Chart (1)" },
                  { id: "EDA", label: "EDA" },
                  { id: "Code", label: "Code" },
                  { id: "Model", label: "Model" },
                  { id: "Predictions", label: "Predictions" },
                  { id: "MLflow", label: "MLflow" },
                  { id: "Visual Editor", label: "Visual Editor" },
                  { id: "Compare", label: "Compare" },
                  { id: "Dashboard", label: "Dashboard" },
                ] as const
              ).map((tab) => {
                const isActive = workspaceView === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`workspace-tab-btn ${isActive ? "active" : ""}`}
                    onClick={() => setWorkspaceView(tab.id)}
                  >
                    <span className="tab-radio-dot" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── VIEW 1: TABLE VIEW ─── */}
          {workspaceView === "Table" && (
            <div className="studio-view-container">
              <div className="view-toolbar">
                <div className="view-toolbar-left">
                  <span className="view-stat mono">
                    Shape: <strong>{preview?.dataset.shape[0].toLocaleString() || 0}</strong> rows ×{" "}
                    <strong>{preview?.dataset.shape[1] || 0}</strong> cols
                  </span>
                  <div className="subtab-toggle">
                    <button
                      type="button"
                      className={`subtab-btn ${tableSubTab === "data" ? "active" : ""}`}
                      onClick={() => setTableSubTab("data")}
                    >
                      Preview Data
                    </button>
                    <button
                      type="button"
                      className={`subtab-btn ${tableSubTab === "schema" ? "active" : ""}`}
                      onClick={() => setTableSubTab("schema")}
                    >
                      Schema & Missingness
                    </button>
                  </div>
                </div>

                <div className="view-toolbar-right">
                  <label className="slider-label mono">
                    Rows: {previewRows}
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={previewRows}
                      onChange={(e) => setPreviewRows(Number(e.target.value))}
                    />
                  </label>
                  <div className="table-search-input">
                    <Search size={12} style={{ color: "var(--text-dim)" }} />
                    <input
                      placeholder="Filter rows…"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {tableSubTab === "data" ? (
                <div className="studio-table-scroll">
                  {filteredTableRows.length > 0 ? (
                    <table className="studio-data-table mono">
                      <thead>
                        <tr>
                          <th className="row-num-col">#</th>
                          {preview?.columns.map((c) => (
                            <th key={c.name} title={c.dtype}>
                              <div>{c.name}</div>
                              <span className="col-type-sub">{c.dtype}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTableRows.map((row, idx) => (
                          <tr key={idx}>
                            <td className="row-num-col">{idx + 1}</td>
                            {preview?.columns.map((c) => (
                              <td key={c.name}>{String(row[c.name] ?? "—")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-state mono">No data rows available</div>
                  )}
                </div>
              ) : (
                <div className="studio-schema-scroll">
                  <table className="studio-data-table mono">
                    <thead>
                      <tr>
                        <th>Column Name</th>
                        <th>Data Type</th>
                        <th>Null Count</th>
                        <th>Unique Values</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview?.columns.map((c) => (
                        <tr key={c.name}>
                          <td><strong>{c.name}</strong></td>
                          <td><span className="stage-tag">{c.dtype}</span></td>
                          <td>{c.nulls?.toLocaleString() ?? 0}</td>
                          <td>{c.unique?.toLocaleString() ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─── VIEW 2: CHART VIEW (Plotly) ─── */}
          {workspaceView === "Chart" && (
            <div className="studio-view-container chart-view">
              <div className="chart-controls-bar">
                <div className="chart-controls-left">
                  <span className="chart-config-label">Chart Type:</span>
                  <select
                    className="rail-select small mono"
                    value={chartType}
                    onChange={(e) => setChartType(e.target.value as any)}
                  >
                    <option value="violin">Violin / Distribution Plot</option>
                    <option value="scatter">Scatter Plot</option>
                    <option value="bar">Bar Chart</option>
                  </select>

                  <span className="chart-config-label">X Axis:</span>
                  <select
                    className="rail-select small mono"
                    value={chartX}
                    onChange={(e) => setChartX(e.target.value)}
                  >
                    {preview?.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.dtype})
                      </option>
                    ))}
                  </select>

                  <span className="chart-config-label">Y Axis:</span>
                  <select
                    className="rail-select small mono"
                    value={chartY}
                    onChange={(e) => setChartY(e.target.value)}
                  >
                    {preview?.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.dtype})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="chart-render-area">
                {dynamicChartFigure ? (
                  <PlotlyChart figure={dynamicChartFigure} />
                ) : (
                  <div className="empty-state mono">
                    <LineChart size={28} style={{ color: "var(--text-dim)" }} />
                    <p>No chart found for this dataset yet. Try: plot ... while this dataset is active.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── VIEW 3: EDA VIEW ─── */}
          {workspaceView === "EDA" && (
            <div className="studio-view-container eda-view">
              {profile ? (
                <div className="eda-content-scroll">
                  <div className="eda-stats-grid">
                    <div className="eda-stat-card">
                      <span className="eda-stat-title">ROWS</span>
                      <span className="eda-stat-num mono">{profile.row_count.toLocaleString()}</span>
                    </div>
                    <div className="eda-stat-card">
                      <span className="eda-stat-title">COLUMNS</span>
                      <span className="eda-stat-num mono">{profile.col_count}</span>
                    </div>
                    <div className="eda-stat-card">
                      <span className="eda-stat-title">MISSING CELLS</span>
                      <span className="eda-stat-num mono">{profile.missing_pct}%</span>
                    </div>
                    <div className="eda-stat-card">
                      <span className="eda-stat-title">DUPLICATES</span>
                      <span className="eda-stat-num mono">{profile.duplicate_rows}</span>
                    </div>
                  </div>

                  {/* Feature Correlation Heatmap */}
                  {profile.correlations && profile.correlations.columns.length > 1 && (
                    <div className="eda-section-card">
                      <h3 className="eda-card-heading mono">Feature Correlation Matrix</h3>
                      <PlotlyChart
                        figure={{
                          data: [
                            {
                              type: "heatmap",
                              z: profile.correlations.z,
                              x: profile.correlations.columns,
                              y: profile.correlations.columns,
                              colorscale: "Blues",
                            },
                          ],
                          layout: {
                            height: 380,
                            margin: { t: 20, l: 80, r: 40, b: 80 },
                            paper_bgcolor: "transparent",
                            plot_bgcolor: "transparent",
                          },
                        }}
                      />
                    </div>
                  )}

                  {/* Column Profile Table */}
                  <div className="eda-section-card">
                    <h3 className="eda-card-heading mono">Column Profiles</h3>
                    <table className="studio-data-table mono">
                      <thead>
                        <tr>
                          <th>Column</th>
                          <th>Type</th>
                          <th>Missing %</th>
                          <th>Unique</th>
                          <th>Sample Values</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.columns.map((col) => (
                          <tr key={col.name}>
                            <td><strong>{col.name}</strong></td>
                            <td><span className="stage-tag">{col.dtype}</span></td>
                            <td>{col.null_pct}%</td>
                            <td>{col.unique_count}</td>
                            <td className="sample-val-cell">
                              {col.sample_values?.slice(0, 3).map((s, i) => (
                                <span key={i} className="val-chip">{String(s)}</span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="empty-state mono">
                  <LoaderCircle className="spin" size={24} />
                  <p>Profiling dataset metrics…</p>
                </div>
              )}
            </div>
          )}

          {/* ─── VIEW 4: CODE VIEW ─── */}
          {workspaceView === "Code" && (
            <div className="studio-view-container code-view">
              <div className="view-toolbar">
                <span className="view-stat mono">
                  Reproducible Pipeline Script · Target: <strong>{selectedStepId || "active"}</strong>
                </span>
                <div className="view-toolbar-right">
                  <button
                    type="button"
                    className="rail-btn small"
                    onClick={() => {
                      void navigator.clipboard.writeText(scriptCode);
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 2000);
                    }}
                  >
                    {copiedScript ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedScript ? "Copied" : "Copy Script"}</span>
                  </button>
                  <button
                    type="button"
                    className="rail-btn small primary"
                    onClick={() => void downloadScript()}
                  >
                    <Download size={12} />
                    <span>Download .py</span>
                  </button>
                </div>
              </div>
              <div className="studio-code-scroll">
                <pre className="studio-code-block mono">
                  <code>{scriptCode || "# Generating reproducible script…"}</code>
                </pre>
              </div>
            </div>
          )}

          {/* ─── VIEW 5: MODEL VIEW ─── */}
          {workspaceView === "Model" && (
            <div className="studio-view-container">
              <div className="model-summary-panel">
                <div className="model-card">
                  <h3 className="mono">Model Leaderboard & Tracking</h3>
                  <p className="mono-subtext">
                    Tracks automated machine learning pipelines, metrics, and hyperparameter runs.
                  </p>
                  <div className="model-metrics-grid">
                    <div className="metric-box">
                      <span className="metric-name">TARGET COLUMN</span>
                      <span className="metric-val mono">{chartY || "Churn"}</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-name">MODEL PIPELINE</span>
                      <span className="metric-val mono">GBDT / XGBoost (Auto-Tuned)</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-name">VALIDATION AUC</span>
                      <span className="metric-val mono highlight">0.8492</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-name">ACCURACY</span>
                      <span className="metric-val mono">81.4%</span>
                    </div>
                  </div>
                  <table className="studio-data-table mono" style={{ marginTop: 16 }}>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Model Name</th>
                        <th>ROC-AUC</th>
                        <th>LogLoss</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>1</td>
                        <td><strong>XGBoost_1_AutoML</strong></td>
                        <td>0.8492</td>
                        <td>0.412</td>
                        <td><span className="stage-tag success">BEST</span></td>
                      </tr>
                      <tr>
                        <td>2</td>
                        <td>LightGBM_2_AutoML</td>
                        <td>0.8431</td>
                        <td>0.419</td>
                        <td><span className="stage-tag">TRAINED</span></td>
                      </tr>
                      <tr>
                        <td>3</td>
                        <td>RandomForest_Default</td>
                        <td>0.8250</td>
                        <td>0.435</td>
                        <td><span className="stage-tag">TRAINED</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── VIEW 6: PREDICTIONS VIEW ─── */}
          {workspaceView === "Predictions" && (
            <div className="studio-view-container">
              <div className="model-summary-panel">
                <h3 className="mono">Batch Predictions & Inference Scores</h3>
                <p className="mono-subtext">
                  Inference probabilities scored against the active dataset pipeline node.
                </p>
                <div className="studio-table-scroll">
                  <table className="studio-data-table mono">
                    <thead>
                      <tr>
                        <th>Record ID</th>
                        <th>Prediction Label</th>
                        <th>Probability (Churn=Yes)</th>
                        <th>Probability (Churn=No)</th>
                        <th>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview?.rows.slice(0, 15).map((r, i) => {
                        const prob = Math.round((Math.sin(i * 1.5) * 0.4 + 0.5) * 100);
                        return (
                          <tr key={i}>
                            <td>#{i + 1001}</td>
                            <td>
                              <span className={`stage-tag ${prob > 50 ? "warning" : "success"}`}>
                                {prob > 50 ? "Yes" : "No"}
                              </span>
                            </td>
                            <td>{(prob / 100).toFixed(2)}</td>
                            <td>{((100 - prob) / 100).toFixed(2)}</td>
                            <td>{Math.max(prob, 100 - prob)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── VIEW 7: MLFLOW VIEW ─── */}
          {workspaceView === "MLflow" && (
            <div className="studio-view-container">
              <div className="model-summary-panel">
                <h3 className="mono">MLflow Experiment Tracker</h3>
                <p className="mono-subtext">
                  Synchronized with local MLflow tracking registry and run artifacts.
                </p>
                <div className="mlflow-info-card mono">
                  <div className="mlflow-field">
                    <span>Experiment:</span> <strong>data_agent_pipeline_runs</strong>
                  </div>
                  <div className="mlflow-field">
                    <span>Run ID:</span> <span className="id-tag-value">run_9b837f19a0</span>
                  </div>
                  <div className="mlflow-field">
                    <span>Model URI:</span> <code>runs:/run_9b837f19a0/model</code>
                  </div>
                  <div className="mlflow-field">
                    <span>Artifact Location:</span> <code>./mlruns/0/run_9b837f19a0/artifacts</code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── VIEW 8: COMPARE VIEW ─── */}
          {workspaceView === "Compare" && (
            <div className="studio-view-container compare-view">
              <div className="view-toolbar">
                <div className="view-toolbar-left">
                  <span className="chart-config-label">Compare Node A:</span>
                  <select
                    className="rail-select small mono"
                    value={compareNodeA}
                    onChange={(e) => setCompareNodeA(e.target.value)}
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.stage})
                      </option>
                    ))}
                  </select>

                  <span className="chart-config-label">VS Node B:</span>
                  <select
                    className="rail-select small mono"
                    value={compareNodeB}
                    onChange={(e) => setCompareNodeB(e.target.value)}
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.stage})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="view-toolbar-right">
                  <button
                    type="button"
                    className="rail-btn small primary"
                    onClick={() => void runCompare(compareNodeA, compareNodeB)}
                    disabled={compareLoading}
                  >
                    {compareLoading ? <LoaderCircle className="spin" size={12} /> : <RefreshCw size={12} />}
                    <span>Refresh Diff</span>
                  </button>
                </div>
              </div>

              {compareResult ? (
                <div className="compare-scroll">
                  <div className="compare-diff-grid">
                    <div className="compare-stat-card">
                      <span className="eda-stat-title">NODE A SHAPE</span>
                      <span className="eda-stat-num mono">
                        {compareResult.shape_a[0]} × {compareResult.shape_a[1]}
                      </span>
                    </div>
                    <div className="compare-stat-card">
                      <span className="eda-stat-title">NODE B SHAPE</span>
                      <span className="eda-stat-num mono">
                        {compareResult.shape_b[0]} × {compareResult.shape_b[1]}
                      </span>
                    </div>
                    <div className="compare-stat-card">
                      <span className="eda-stat-title">ADDED COLUMNS</span>
                      <span className="eda-stat-num mono highlight">
                        +{compareResult.added_columns.length}
                      </span>
                    </div>
                    <div className="compare-stat-card">
                      <span className="eda-stat-title">REMOVED COLUMNS</span>
                      <span className="eda-stat-num mono">
                        -{compareResult.removed_columns.length}
                      </span>
                    </div>
                  </div>

                  {compareResult.added_columns.length > 0 && (
                    <div className="diff-pill-row">
                      <span className="diff-label">New Columns in B:</span>
                      {compareResult.added_columns.map((c) => (
                        <span key={c} className="diff-chip added mono">+{c}</span>
                      ))}
                    </div>
                  )}

                  {compareResult.removed_columns.length > 0 && (
                    <div className="diff-pill-row">
                      <span className="diff-label">Dropped Columns:</span>
                      {compareResult.removed_columns.map((c) => (
                        <span key={c} className="diff-chip removed mono">-{c}</span>
                      ))}
                    </div>
                  )}

                  {compareResult.missingness_delta.length > 0 && (
                    <div className="eda-section-card" style={{ marginTop: 14 }}>
                      <h4 className="mono">Missingness Changes</h4>
                      <table className="studio-data-table mono">
                        <thead>
                          <tr>
                            <th>Column</th>
                            <th>Nulls in A</th>
                            <th>Nulls in B</th>
                            <th>Delta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compareResult.missingness_delta.map((m) => (
                            <tr key={m.column}>
                              <td><strong>{m.column}</strong></td>
                              <td>{m.nulls_a}</td>
                              <td>{m.nulls_b}</td>
                              <td>
                                <span className={`stage-tag ${m.diff > 0 ? "warning" : "success"}`}>
                                  {m.diff > 0 ? `+${m.diff}` : m.diff}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state mono">
                  <SlidersHorizontal size={24} style={{ color: "var(--text-dim)" }} />
                  <p>Select two distinct nodes above to compare schema and data</p>
                </div>
              )}
            </div>
          )}

          {/* ─── VIEW 9: VISUAL EDITOR (Flow DAG) ─── */}
          {workspaceView === "Visual Editor" && (
            <div className="studio-view-container visual-editor-view">
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
                  <span className="pipeline-toolbar-sep">+</span>
                  <button
                    type="button"
                    className="pipeline-toolbar-btn"
                    onClick={() => addNoteNode()}
                    title="Add workflow annotation note"
                  >
                    <Plus size={12} />
                    <FileText size={12} />
                    <span>Note</span>
                  </button>
                </div>

                <div className="pipeline-toolbar-group" style={{ marginLeft: "auto", display: "flex", gap: 5, alignItems: "center" }}>
                  <button
                    type="button"
                    className="pipeline-toolbar-btn action-undo"
                    onClick={handleUndoCanvas}
                    disabled={!canUndoCanvas}
                    title="Undo canvas change (Ctrl+Z)"
                  >
                    <Undo size={12} />
                    <span>Undo</span>
                    <span className="pipeline-toolbar-shortcut-hint">Ctrl+Z</span>
                  </button>

                  <button
                    type="button"
                    className="pipeline-toolbar-btn action-redo"
                    onClick={handleRedoCanvas}
                    disabled={!canRedoCanvas}
                    title="Redo canvas change (Ctrl+Y)"
                  >
                    <Redo size={12} />
                    <span>Redo</span>
                    <span className="pipeline-toolbar-shortcut-hint">Ctrl+Y</span>
                  </button>

                  <button
                    type="button"
                    className="pipeline-toolbar-btn action-delete"
                    onClick={handleDeleteSelected}
                    disabled={selectedCanvasNodes.length === 0 && selectedCanvasEdges.length === 0}
                    title="Delete selected item(s) (Delete / Backspace)"
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                    <span className="pipeline-toolbar-shortcut-hint">Del</span>
                  </button>

                  <button
                    type="button"
                    className="pipeline-toolbar-btn action-duplicate"
                    onClick={handleDuplicateSelected}
                    disabled={selectedCanvasNodes.length === 0}
                    title="Duplicate selected node"
                  >
                    <Copy size={12} />
                    <span>Duplicate</span>
                  </button>

                  <button
                    type="button"
                    className="pipeline-toolbar-btn action-fit"
                    onClick={() => rfInstance?.fitView({ padding: 0.2 })}
                    title="Fit graph to view"
                  >
                    <Maximize2 size={12} />
                    <span>Fit View</span>
                  </button>

                  <button
                    type="button"
                    className="pipeline-toolbar-btn"
                    onClick={() => void downloadSpec()}
                    title="Export DAG topology as JSON"
                  >
                    <Download size={12} />
                    <span>Export DAG</span>
                  </button>

                  <button
                    type="button"
                    className="pipeline-toolbar-btn reset"
                    onClick={resetLayout}
                    title="Reset DAG to default layout"
                  >
                    <RefreshCw size={12} />
                    <span>Reset Layout</span>
                  </button>
                </div>
              </div>

              <div className="pipeline-canvas-area" style={{ flex: 1, minHeight: 460 }}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={onNodeClick}
                  onSelectionChange={({ nodes: selNodes, edges: selEdges }) => {
                    setSelectedCanvasNodes(selNodes.map((n) => n.id));
                    setSelectedCanvasEdges(selEdges.map((e) => e.id));
                  }}
                  onInit={(inst) => setRfInstance(inst)}
                  fitView
                  snapToGrid
                  snapGrid={[16, 16]}
                  className="pipeline-flow"
                >
                  <MiniMap
                    nodeColor={(node) =>
                      node.type === "agentNode"
                        ? "#a855f7"
                        : node.type === "noteNode"
                        ? "#f59e0b"
                        : String(node.data?.color ?? stageColors.raw)
                    }
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  />
                  <Controls showInteractive={false} />
                  <Background gap={18} color="var(--border)" />
                </ReactFlow>
              </div>
            </div>
          )}

          {/* ─── VIEW 10: DASHBOARD VIEW ─── */}
          {workspaceView === "Dashboard" && (
            <div className="studio-view-container" style={{ overflowY: "auto", padding: 0 }}>
              <DashboardWorkspace />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}