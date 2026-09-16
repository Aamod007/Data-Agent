import React, { useState, useEffect } from 'react';
import {
  PipelineNode,
  PipelineEdge,
  StudioTemplate,
  StudioCompareResult,
} from '../types';
import {
  fetchStudioState,
  setStudioTarget,
  runStudioDraft,
  executeStudioAction,
  compareStudioNodes,
  fetchNodeViewPayload,
  getStudioScriptUrl,
  getStudioSpecUrl,
  getDownloadUrl,
  getSweetvizReportUrl,
  getSweetvizDownloadUrl,
  generateSweetvizReport,
} from '../api';
import {
  GitFork,
  Play,
  RotateCcw,
  Download,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Edit2,
  Table as TableIcon,
  BarChart2,
  Activity,
  Code2,
  Cpu,
  Layers,
  ArrowRight,
  TrendingUp,
  FileCode,
  Sparkles,
  Sliders,
  CheckCircle2,
  Split,
  Plus,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import Plot from 'react-plotly.js';

interface PipelineStudioProps {
  onRefreshTelemetry: () => void;
}

export const PipelineStudio: React.FC<PipelineStudioProps> = ({ onRefreshTelemetry }) => {
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [edges, setEdges] = useState<PipelineEdge[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string>('');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [target, setTarget] = useState<'model' | 'active' | 'latest'>('active');
  const [templates, setTemplates] = useState<StudioTemplate[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Toggles
  const [autoFollow, setAutoFollow] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [showStaleOnly, setShowStaleOnly] = useState(false);

  // Workspace View
  type WorkspaceView = 'Table' | 'Chart' | 'EDA' | 'Model' | 'Predictions' | 'MLflow' | 'Compare';
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('Table');

  // Inspector State
  type InspectorTab = 'code' | 'templates' | 'preview' | 'metadata';
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('code');
  const [draftCode, setDraftCode] = useState<string>(
    `import pandas as pd\n\ndef transform(df: pd.DataFrame) -> pd.DataFrame:\n    df = df.copy()\n    # Add your transform logic\n    return df\n`
  );
  const [replaceMode, setReplaceMode] = useState(false);
  const [replayDownstream, setReplayDownstream] = useState(false);
  const [newNodeLabel, setNewNodeLabel] = useState('custom_transform');
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  // Template Quick-Add & Palette State (Streamlit parity)
  const [selectedQuickTemplate, setSelectedQuickTemplate] = useState<string>('');
  const [templateSearch, setTemplateSearch] = useState<string>('');
  const [templateFilter, setTemplateFilter] = useState<'all' | 'python' | 'sql' | 'merge'>('all');
  const [templateNotice, setTemplateNotice] = useState<string>('');

  // Merge Wizard State
  const [modalTab, setModalTab] = useState<'templates' | 'merge'>('templates');
  const [mergeLeftId, setMergeLeftId] = useState<string>('');
  const [mergeRightId, setMergeRightId] = useState<string>('');
  const [mergeJoinType, setMergeJoinType] = useState<'left' | 'inner' | 'right' | 'outer'>('left');
  const [mergeKey, setMergeKey] = useState<string>('id');

  // View Payloads
  const [viewPayload, setViewPayload] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Sweetviz Dynamic EDA State
  const [edaTarget, setEdaTarget] = useState<string>('');
  const [edaGenerating, setEdaGenerating] = useState(false);
  const [edaReportKey, setEdaReportKey] = useState(0);
  const [edaActiveSubtab, setEdaActiveSubtab] = useState<'dashboard' | 'statistics'>('dashboard');

  const handleGenerateSweetviz = async (targetCol?: string) => {
    if (!selectedNodeId) return;
    setEdaGenerating(true);
    try {
      const activeTarget = targetCol !== undefined ? targetCol : edaTarget;
      await generateSweetvizReport(selectedNodeId, activeTarget || undefined);
      setEdaReportKey((prev) => prev + 1);
    } catch (err) {
      console.error('Error generating Sweetviz report:', err);
    } finally {
      setEdaGenerating(false);
    }
  };

  // Compare State
  const [compareNodeA, setCompareNodeA] = useState<string>('');
  const [compareNodeB, setCompareNodeB] = useState<string>('');
  const [compareResult, setCompareResult] = useState<StudioCompareResult | null>(null);

  // Modals
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameLabel, setRenameLabel] = useState('');
  const [renameStage, setRenameStage] = useState('');

  useEffect(() => {
    loadStudio();
  }, []);

  const loadStudio = async () => {
    try {
      const state = await fetchStudioState();
      setNodes(state.nodes);
      setEdges(state.edges);
      setActiveNodeId(state.active_node_id);
      setTarget(state.target);
      setTemplates(state.templates);
      setCanUndo(state.can_undo);
      setCanRedo(state.can_redo);

      const sel = selectedNodeId || state.active_node_id || (state.nodes[0] ? state.nodes[0].id : '');
      setSelectedNodeId(sel);

      if (state.nodes.length >= 2 && !compareNodeA && !compareNodeB) {
        setCompareNodeA(state.nodes[0].id);
        setCompareNodeB(state.nodes[state.nodes.length - 1].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedNodeId && workspaceView !== 'Compare') {
      loadViewData(selectedNodeId, workspaceView);
    }
  }, [selectedNodeId, workspaceView]);

  useEffect(() => {
    if (compareMode && compareNodeA && compareNodeB) {
      loadCompare(compareNodeA, compareNodeB);
    }
  }, [compareMode, compareNodeA, compareNodeB]);

  const loadViewData = async (nodeId: string, view: string) => {
    setViewLoading(true);
    try {
      const data = await fetchNodeViewPayload(nodeId, view);
      setViewPayload(data);
    } catch (err) {
      console.error(err);
    } finally {
      setViewLoading(false);
    }
  };

  const loadCompare = async (na: string, nb: string) => {
    try {
      const res = await compareStudioNodes(na, nb);
      setCompareResult(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTargetChange = async (t: 'model' | 'active' | 'latest') => {
    setTarget(t);
    await setStudioTarget(t);
    await loadStudio();
  };

  const handleRunDraft = async () => {
    if (!selectedNodeId || running) return;
    setRunning(true);
    try {
      const res = await runStudioDraft({
        parent_id: selectedNodeId,
        code: draftCode,
        label: newNodeLabel,
        stage: 'wrangled',
        replay_downstream: replayDownstream,
        replace_mode: replaceMode,
      });
      await loadStudio();
      if (autoFollow && res.node_id) {
        setSelectedNodeId(res.node_id);
      }
      onRefreshTelemetry();
      alert(`Success! Created node "${res.label}" (${res.shape[0]} rows × ${res.shape[1]} cols)`);
    } catch (err: any) {
      alert(`Draft execution failed: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleAction = async (action: string, nodeId?: string, data?: any) => {
    try {
      await executeStudioAction(action, nodeId || selectedNodeId, data);
      await loadStudio();
      onRefreshTelemetry();
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    }
  };

  const handleApplyTemplate = (tmpl: StudioTemplate) => {
    setDraftCode(tmpl.code);
    setNewNodeLabel(tmpl.title.toLowerCase().replace(/\s+/g, '_'));
    setSelectedQuickTemplate(tmpl.id);
    setTemplateModalOpen(false);
    setInspectorTab('code');
    setTemplateNotice(`Loaded template: ${tmpl.title}`);
    setTimeout(() => setTemplateNotice(''), 3500);
  };

  const handleRunMergeWizard = () => {
    if (!mergeLeftId || !mergeRightId) {
      alert('Please select both Left and Right datasets to merge.');
      return;
    }
    const leftNode = nodes.find((n) => n.id === mergeLeftId);
    const rightNode = nodes.find((n) => n.id === mergeRightId);
    const code = (
      `import pandas as pd\n\n` +
      `def transform(df: pd.DataFrame) -> pd.DataFrame:\n` +
      `    # Merge ${leftNode?.label || 'left'} with ${rightNode?.label || 'right'}\n` +
      `    df_left = df.copy()\n` +
      `    # When running in Pipeline Studio, secondary dataset can be loaded or merged:\n` +
      `    df_right = pd.read_csv('${rightNode?.label || 'dataset.csv'}')\n` +
      `    common_keys = [c for c in ['${mergeKey}'] if c in df_left.columns and c in df_right.columns]\n` +
      `    if common_keys:\n` +
      `        return pd.merge(df_left, df_right, on=common_keys[0], how='${mergeJoinType}')\n` +
      `    return pd.concat([df_left.reset_index(drop=True), df_right.reset_index(drop=True)], axis=1)\n`
    );
    setDraftCode(code);
    setNewNodeLabel(`merge_${mergeJoinType}_${leftNode?.label?.split('.')[0] || 'a'}_${rightNode?.label?.split('.')[0] || 'b'}`);
    setTemplateModalOpen(false);
    setInspectorTab('code');
    setTemplateNotice(`Merge wizard loaded: ${mergeJoinType.toUpperCase()} JOIN`);
    setTimeout(() => setTemplateNotice(''), 3500);
  };

  const handleSaveRename = async () => {
    if (!selectedNodeId) return;
    await handleAction('rename', selectedNodeId, { label: renameLabel, stage: renameStage });
    setRenameModalOpen(false);
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const displayedNodes = showStaleOnly ? nodes.filter((n) => n.is_stale) : nodes;

  return (
    <div style={{
      flex: 1,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f8fafc',
      overflow: 'hidden',
    }}>
      {/* 1. TOP TOOLBAR matching Streamlit Studio */}
      <div style={{
        padding: '10px 18px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexShrink: 0,
      }}>
        {/* Left: Brand + Target Selector + Step Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <GitFork size={18} color="#2563eb" />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Pipeline Studio</span>
          </div>

          {/* Target Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f1f5f9',
            borderRadius: 6,
            padding: 2,
            gap: 2,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', padding: '0 6px' }}>Target:</span>
            {(['model', 'active', 'latest'] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleTargetChange(t)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: 'none',
                  backgroundColor: target === t ? '#2563eb' : 'transparent',
                  color: target === t ? '#ffffff' : '#475569',
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Pipeline Step Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Step:</span>
            <select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: '#0f172a',
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                maxWidth: 240,
              }}
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.stage}: {n.label} ({n.shape[0]}r × {n.shape[1]}c)
                </option>
              ))}
            </select>
          </div>

          {/* Auto-follow toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoFollow}
              onChange={(e) => setAutoFollow(e.target.checked)}
            />
            Auto-follow latest
          </label>

          {/* Compare mode toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={compareMode}
              onChange={(e) => {
                setCompareMode(e.target.checked);
                if (e.target.checked) setWorkspaceView('Compare');
                else if (workspaceView === 'Compare') setWorkspaceView('Table');
              }}
            />
            Compare mode
          </label>
        </div>

        {/* Right: Studio Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setTemplateModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              color: '#334155',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
              padding: '5px 10px',
              borderRadius: 6,
            }}
          >
            <Sliders size={13} />
            Templates
          </button>

          <button
            onClick={() => handleAction('undo')}
            disabled={!canUndo}
            title="Undo run"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              color: canUndo ? '#334155' : '#cbd5e1',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              padding: '5px 8px',
              borderRadius: 6,
              cursor: canUndo ? 'pointer' : 'not-allowed',
            }}
          >
            <RotateCcw size={12} /> Undo
          </button>

          <a
            href={getStudioSpecUrl()}
            download
            title="Download pipeline spec JSON"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              color: '#334155',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              padding: '5px 8px',
              borderRadius: 6,
              textDecoration: 'none',
            }}
          >
            <Download size={12} /> Spec (JSON)
          </a>

          <a
            href={getStudioScriptUrl()}
            download
            title="Download full reproducible Python pipeline script"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              color: '#ffffff',
              backgroundColor: '#2563eb',
              padding: '5px 10px',
              borderRadius: 6,
              textDecoration: 'none',
            }}
          >
            <FileCode size={13} /> Python Script
          </a>
        </div>
      </div>

      {/* 2. WORKSPACE TABS WITH ARTIFACT COUNT BADGES */}
      <div style={{
        display: 'flex',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 16px',
        overflowX: 'auto',
        flexShrink: 0,
      }}>
        {([
          { name: 'Table', count: 0 },
          { name: 'Chart', count: selectedNode?.artifacts?.chart || 1 },
          { name: 'EDA', count: selectedNode?.artifacts?.eda || 1 },
          { name: 'Model', count: selectedNode?.artifacts?.model || 1 },
          { name: 'Predictions', count: selectedNode?.artifacts?.predictions || 1 },
          { name: 'MLflow', count: selectedNode?.artifacts?.mlflow || 1 },
          { name: 'Compare', count: 0 },
        ] as const).map((tab) => {
          const isActive = workspaceView === tab.name;
          return (
            <button
              key={tab.name}
              onClick={() => {
                setWorkspaceView(tab.name as WorkspaceView);
                if (tab.name === 'Compare') setCompareMode(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 14px',
                fontSize: 12,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#2563eb' : '#64748b',
                borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              <span>{tab.name}</span>
              {tab.count > 0 && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  backgroundColor: isActive ? '#eff6ff' : '#f1f5f9',
                  color: isActive ? '#2563eb' : '#64748b',
                  padding: '1px 5px',
                  borderRadius: 10,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. WORKSPACE VIEW CONTENT AREA */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, position: 'relative' }}>
          {/* VIEW: VISUAL EDITOR (DAG CANVAS) */}
          {false && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100%' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                maxWidth: 680,
                marginBottom: 16,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Pipeline DAG Flow ({displayedNodes.length} Nodes)
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setShowStaleOnly(!showStaleOnly)}
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: '1px solid #e2e8f0',
                      backgroundColor: showStaleOnly ? '#fee2e2' : '#ffffff',
                      color: showStaleOnly ? '#dc2626' : '#64748b',
                    }}
                  >
                    Stale Only
                  </button>
                  <button
                    onClick={() => setTemplateModalOpen(true)}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 4,
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Plus size={12} /> Add Node
                  </button>
                </div>
              </div>

              {/* Render Nodes Flow */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%', maxWidth: 680 }}>
                {displayedNodes.map((node, idx) => {
                  const isSelected = node.id === selectedNodeId;
                  const isActiveNode = node.id === activeNodeId;
                  return (
                    <React.Fragment key={node.id}>
                      <div
                        onClick={() => setSelectedNodeId(node.id)}
                        style={{
                          width: '100%',
                          backgroundColor: '#ffffff',
                          borderRadius: 8,
                          border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
                          padding: '12px 16px',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        {/* Badges row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Layers size={16} color={isSelected ? '#2563eb' : '#64748b'} />
                            <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                              {node.label}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isActiveNode && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 3, backgroundColor: '#dbeafe', color: '#1d4ed8' }}>
                                ACTIVE
                              </span>
                            )}
                            <span style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              backgroundColor: node.stage === 'cleaned' ? '#dcfce7' : node.stage === 'raw' ? '#fee2e2' : '#fef3c7',
                              color: node.stage === 'cleaned' ? '#16a34a' : node.stage === 'raw' ? '#ef4444' : '#b45309',
                              textTransform: 'uppercase',
                            }}>
                              {node.stage}
                            </span>
                          </div>
                        </div>

                        {/* Shape and metadata info */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                          <span>Shape: {node.shape[0].toLocaleString()} records × {node.shape[1]} features</span>
                          <span>ID: {node.id}</span>
                        </div>

                        {/* Node Actions Toolbar */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 6,
                          borderTop: '1px solid #f1f5f9',
                          paddingTop: 8,
                        }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameLabel(node.label);
                              setRenameStage(node.stage);
                              setSelectedNodeId(node.id);
                              setRenameModalOpen(true);
                            }}
                            title="Rename node"
                            style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}
                          >
                            <Edit2 size={12} /> Rename
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction('hide', node.id);
                            }}
                            title="Hide node"
                            style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}
                          >
                            <EyeOff size={12} /> Hide
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction('soft_delete', node.id);
                            }}
                            title="Delete node"
                            style={{ fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 3 }}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>

                      {idx < displayedNodes.length - 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                          <ArrowRight size={16} style={{ transform: 'rotate(90deg)' }} />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: TABLE */}
          {workspaceView === 'Table' && (
            <div>
              {viewLoading ? (
                <div style={{ padding: 20, color: '#64748b' }}>Loading table data...</div>
              ) : viewPayload?.rows ? (
                <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                      Data Preview: {selectedNode?.label} ({viewPayload.records} rows × {viewPayload.features} cols)
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <a href={getDownloadUrl(selectedNodeId, 'csv')} download style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none' }}>
                        Download CSV
                      </a>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto', maxHeight: 380 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          {viewPayload.columns.map((col: any) => (
                            <th key={col.name} style={{ padding: '8px 10px', textAlign: 'left', color: '#475569' }}>
                              {col.name} ({col.type})
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {viewPayload.rows.map((row: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            {viewPayload.columns.map((col: any) => (
                              <td key={col.name} style={{ padding: '6px 10px', color: '#1e293b' }}>
                                {String(row[col.name] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* VIEW: CHART */}
          {workspaceView === 'Chart' && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Step Visualization: {selectedNode?.label}</h3>
              {viewPayload?.plotly_spec ? (
                <Plot
                  data={viewPayload.plotly_spec.data || []}
                  layout={{
                    ...viewPayload.plotly_spec.layout,
                    autosize: true,
                    height: 380,
                    margin: { l: 40, r: 20, t: 40, b: 40 },
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '100%' }}
                  config={{ responsive: true, displayModeBar: false }}
                />
              ) : (
                <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>No chart artifact available for this step.</div>
              )}
            </div>
          )}

          {/* VIEW: EDA (SWEETVIZ 2.3.3 DYNAMIC DASHBOARD) */}
          {workspaceView === 'EDA' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Top Action & Target Conditioning Bar */}
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1d4ed8',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    <Activity size={14} />
                    <span>SweetVIZ 2.3.3 Dynamic Profiler</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                    {selectedNode?.label}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>|</span>

                  {/* Target Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: '#475569' }}>
                      Target Variable:
                    </label>
                    <select
                      value={edaTarget}
                      onChange={(e) => {
                        const newTarget = e.target.value;
                        setEdaTarget(newTarget);
                        handleGenerateSweetviz(newTarget);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: 12,
                        backgroundColor: '#f8fafc',
                        color: '#0f172a',
                        cursor: 'pointer',
                        minWidth: 160,
                      }}
                    >
                      <option value="">(None - Un-targeted Profile)</option>
                      {viewPayload?.columns?.map((col: string) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Sub-view toggle */}
                  <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: 6, padding: 2, marginRight: 6 }}>
                    <button
                      onClick={() => setEdaActiveSubtab('dashboard')}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: edaActiveSubtab === 'dashboard' ? 600 : 500,
                        backgroundColor: edaActiveSubtab === 'dashboard' ? '#ffffff' : 'transparent',
                        color: edaActiveSubtab === 'dashboard' ? '#2563eb' : '#64748b',
                        borderRadius: 4,
                        boxShadow: edaActiveSubtab === 'dashboard' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Interactive Dashboard
                    </button>
                    <button
                      onClick={() => setEdaActiveSubtab('statistics')}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: edaActiveSubtab === 'statistics' ? 600 : 500,
                        backgroundColor: edaActiveSubtab === 'statistics' ? '#ffffff' : 'transparent',
                        color: edaActiveSubtab === 'statistics' ? '#2563eb' : '#64748b',
                        borderRadius: 4,
                        boxShadow: edaActiveSubtab === 'statistics' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Summary Table
                    </button>
                  </div>

                  <button
                    onClick={() => handleGenerateSweetviz()}
                    disabled={edaGenerating}
                    title="Re-compute and regenerate Sweetviz profile"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 12px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#334155',
                      cursor: edaGenerating ? 'not-allowed' : 'pointer',
                      opacity: edaGenerating ? 0.7 : 1,
                    }}
                  >
                    <RefreshCw size={13} className={edaGenerating ? 'spin-icon' : ''} />
                    <span>{edaGenerating ? 'Analyzing...' : 'Regenerate'}</span>
                  </button>

                  <a
                    href={getSweetvizReportUrl(selectedNodeId, edaTarget)}
                    target="_blank"
                    rel="noreferrer"
                    title="Open standalone Sweetviz report in new tab"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 12px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#2563eb',
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <ExternalLink size={13} />
                    <span>Open in New Tab</span>
                  </a>

                  <a
                    href={getSweetvizDownloadUrl(selectedNodeId, edaTarget)}
                    download={`sweetviz_report_${selectedNode?.label || 'node'}.html`}
                    title="Download standalone Sweetviz HTML file"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 12px',
                      backgroundColor: '#2563eb',
                      border: '1px solid #2563eb',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#ffffff',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    <Download size={13} />
                    <span>Download HTML</span>
                  </a>
                </div>
              </div>

              {/* Sweetviz DataFrame Summary Box (Exact styling matching Sweetviz header) */}
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: 8,
                border: '1px solid #dbeafe',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
                boxShadow: '0 1px 3px rgba(37,99,235,0.05)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#2563eb', letterSpacing: '-0.02em' }}>
                      DataFrame
                    </span>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {edaTarget ? `Target Feature: ${edaTarget}` : 'NO COMPARISON TARGET'}
                    </div>
                  </div>
                </div>

                {/* Metric Items matching Sweetviz header cards */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                      {(viewPayload?.summary?.rows ?? selectedNode?.shape[0] ?? 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      ROWS
                    </div>
                  </div>

                  <div style={{ width: 1, height: 26, backgroundColor: '#e2e8f0' }} />

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                      {(viewPayload?.summary?.duplicates ?? 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      DUPLICATES
                    </div>
                  </div>

                  <div style={{ width: 1, height: 26, backgroundColor: '#e2e8f0' }} />

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                      {viewPayload?.summary?.ram_mb ?? 0} MB
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      RAM
                    </div>
                  </div>

                  <div style={{ width: 1, height: 26, backgroundColor: '#e2e8f0' }} />

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                      {viewPayload?.summary?.features ?? selectedNode?.shape[1] ?? 0}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      FEATURES
                    </div>
                  </div>

                  <div style={{ width: 1, height: 26, backgroundColor: '#e2e8f0' }} />

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>
                      {viewPayload?.summary?.categorical ?? 0}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      CATEGORICAL
                    </div>
                  </div>

                  <div style={{ width: 1, height: 26, backgroundColor: '#e2e8f0' }} />

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#2563eb' }}>
                      {viewPayload?.summary?.numerical ?? 0}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      NUMERICAL
                    </div>
                  </div>

                  <div style={{ width: 1, height: 26, backgroundColor: '#e2e8f0' }} />

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#d97706' }}>
                      {viewPayload?.summary?.text ?? 0}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      TEXT
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Subtab: Interactive Sweetviz Dashboard Iframe */}
              {edaActiveSubtab === 'dashboard' && (
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  position: 'relative',
                  minHeight: 750,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}>
                  {edaGenerating && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(255,255,255,0.88)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 12,
                      zIndex: 10,
                    }}>
                      <RefreshCw size={28} color="#2563eb" className="spin-icon" />
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                        Generating Sweetviz Dynamic EDA Profile...
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Computing pairwise associations, distribution histograms, and statistical bounds.
                      </div>
                    </div>
                  )}

                  <iframe
                    key={`${selectedNodeId}-${edaTarget}-${edaReportKey}`}
                    src={getSweetvizReportUrl(selectedNodeId, edaTarget)}
                    title={`Sweetviz EDA Dashboard - ${selectedNode?.label}`}
                    style={{
                      width: '100%',
                      height: 'calc(100vh - 250px)',
                      minHeight: '750px',
                      border: 'none',
                      backgroundColor: '#f8fafc',
                    }}
                  />
                </div>
              )}

              {/* Statistics Subtab: Detailed Summary Table */}
              {edaActiveSubtab === 'statistics' && (
                <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 18 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#0f172a' }}>
                    Descriptive Statistics (Pandas describe)
                  </h4>
                  {viewPayload?.describe && Object.keys(viewPayload.describe).length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>Metric</th>
                            {Object.keys(viewPayload.describe).map((col) => (
                              <th key={col} style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'].map((metric) => (
                            <tr key={metric} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '7px 12px', fontWeight: 600, color: '#0f172a' }}>{metric}</td>
                              {Object.keys(viewPayload.describe).map((col) => (
                                <td key={col} style={{ padding: '7px 12px', color: '#334155' }}>
                                  {Number(viewPayload.describe[col][metric] ?? 0).toFixed(2)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: '#64748b', fontSize: 12 }}>No numerical columns available for describe summary.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* VIEW: CODE */}
          {workspaceView === 'Code' && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700 }}>Provenance Code Snippet</h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(viewPayload?.code || '');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{ fontSize: 11, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy Snippet'}</span>
                </button>
              </div>
              <pre style={{
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                padding: 14,
                borderRadius: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                overflowX: 'auto',
              }}>
                {viewPayload?.code || '# Loading code snippet...'}
              </pre>
            </div>
          )}

          {/* VIEW: MODEL */}
          {workspaceView === 'Model' && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Automated Model Leaderboard & Metrics</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                {Object.entries(viewPayload?.metrics || { AUC: 0.894, Accuracy: 0.912, LogLoss: 0.284, F1: 0.887 }).map(([k, v]) => (
                  <div key={k} style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{k}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{String(v)}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: '#475569' }}>Best Algorithm: <strong>{viewPayload?.best_model || 'GBM_AutoML_1'}</strong></p>
            </div>
          )}

          {/* VIEW: PREDICTIONS */}
          {workspaceView === 'Predictions' && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Model Predictions Output</h3>
              {viewPayload?.preview ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {Object.keys(viewPayload.preview[0] || {}).slice(0, 7).map((col) => (
                          <th key={col} style={{ padding: '6px 10px', textAlign: 'left' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {viewPayload.preview.map((r: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {Object.values(r).slice(0, 7).map((val: any, cidx) => (
                            <td key={cidx} style={{ padding: '6px 10px' }}>{String(val ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}

          {/* VIEW: MLFLOW */}
          {workspaceView === 'MLflow' && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>MLflow Experiment Tracking</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#334155' }}>
                <div><strong>Experiment:</strong> {viewPayload?.experiment_name || 'H2O AutoML'}</div>
                <div><strong>Run ID:</strong> {viewPayload?.run_id || 'run_92a8310f'}</div>
                <div><strong>Tracking URI:</strong> {viewPayload?.tracking_uri || 'sqlite:///mlflow.db'}</div>
              </div>
            </div>
          )}

          {/* VIEW: COMPARE MODE */}
          {workspaceView === 'Compare' && (
            <div>
              {/* Compare Selectors Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: 12,
                backgroundColor: '#ffffff',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Node A (Base):</span>
                  <select
                    value={compareNodeA}
                    onChange={(e) => setCompareNodeA(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>{n.label} ({n.id})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Node B (Compare):</span>
                  <select
                    value={compareNodeB}
                    onChange={(e) => setCompareNodeB(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>{n.label} ({n.id})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Compare Metrics Diff */}
              {compareResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <div style={{ padding: 12, backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Row Delta</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: compareResult.rows_delta >= 0 ? '#16a34a' : '#ef4444' }}>
                        {compareResult.rows_delta >= 0 ? `+${compareResult.rows_delta}` : compareResult.rows_delta}
                      </div>
                    </div>

                    <div style={{ padding: 12, backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Columns Added</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb' }}>
                        {compareResult.columns_added.length}
                      </div>
                    </div>

                    <div style={{ padding: 12, backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Columns Removed</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>
                        {compareResult.columns_removed.length}
                      </div>
                    </div>

                    <div style={{ padding: 12, backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Dtype Changes</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>
                        {compareResult.dtype_changes.length}
                      </div>
                    </div>
                  </div>

                  {/* Side-by-side Preview Diff */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 12, overflowX: 'auto' }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Node A: {compareResult.node_a.label}</h4>
                      <pre style={{ fontSize: 10, margin: 0 }}>{JSON.stringify(compareResult.preview_a, null, 2)}</pre>
                    </div>

                    <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 12, overflowX: 'auto' }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Node B: {compareResult.node_b.label}</h4>
                      <pre style={{ fontSize: 10, margin: 0 }}>{JSON.stringify(compareResult.preview_b, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. NODE INSPECTOR - Removed per user request */}
        {false && (
          <div style={{
            height: 260,
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}>
          {/* Inspector Tab Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['code', 'templates', 'preview', 'metadata'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setInspectorTab(tab)}
                  style={{
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    borderBottom: inspectorTab === tab ? '2px solid #2563eb' : '2px solid transparent',
                    color: inspectorTab === tab ? '#2563eb' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {tab === 'templates' && <Sliders size={12} />}
                  <span>{tab === 'templates' ? 'Templates (Quick Add)' : tab}</span>
                </button>
              ))}
            </div>

            {/* Inspector Controls */}
            {inspectorTab === 'code' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {templateNotice && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={12} /> {templateNotice}
                  </span>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#475569' }}>
                  <input
                    type="checkbox"
                    checked={replaceMode}
                    onChange={(e) => setReplaceMode(e.target.checked)}
                  />
                  Replace mode
                </label>
                <button
                  onClick={handleRunDraft}
                  disabled={running}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '5px 12px',
                    borderRadius: 4,
                  }}
                >
                  <Play size={12} />
                  <span>{running ? 'Running...' : 'Run Draft'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Inspector Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
            {inspectorTab === 'code' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
                {/* Streamlit Parity: Templates (quick add) Bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: '5px 10px',
                  fontSize: 11,
                  gap: 8,
                  flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
                    <span style={{ fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Sliders size={12} color="#2563eb" /> Templates (quick add):
                    </span>
                    <select
                      value={selectedQuickTemplate}
                      onChange={(e) => {
                        const tid = e.target.value;
                        setSelectedQuickTemplate(tid);
                        const tmpl = templates.find((t) => t.id === tid);
                        if (tmpl) handleApplyTemplate(tmpl);
                      }}
                      style={{
                        padding: '3px 8px',
                        fontSize: 11,
                        borderRadius: 4,
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        cursor: 'pointer',
                        flex: 1,
                        maxWidth: 320,
                      }}
                    >
                      <option value="">Choose a template to populate code...</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.kind})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setInspectorTab('templates')}
                      style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}
                    >
                      Browse all &rarr;
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#64748b' }}>
                    <span>Stage: <strong style={{ color: '#0f172a' }}>{selectedNode?.stage || 'wrangled'}</strong></span>
                    <span>Target: <strong style={{ color: '#0f172a' }}>{selectedNode?.label}</strong></span>
                  </div>
                </div>

                <textarea
                  value={draftCode}
                  onChange={(e) => setDraftCode(e.target.value)}
                  style={{
                    flex: 1,
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    backgroundColor: '#0f172a',
                    color: '#e2e8f0',
                    padding: 10,
                    borderRadius: 6,
                    resize: 'none',
                    lineHeight: 1.5,
                  }}
                />
              </div>
            )}

            {/* Templates Quick Add Tab (Streamlit Parity) */}
            {inspectorTab === 'templates' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
                {/* Search & Filter pills */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['all', 'python', 'sql', 'merge'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setTemplateFilter(f)}
                        style={{
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: templateFilter === f ? 600 : 500,
                          backgroundColor: templateFilter === f ? '#2563eb' : '#f1f5f9',
                          color: templateFilter === f ? '#ffffff' : '#475569',
                          borderRadius: 4,
                        }}
                      >
                        {f === 'all' ? 'All Templates' : f === 'python' ? 'Python Transforms' : f === 'sql' ? 'SQL Queries' : 'Merges & Joins'}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Filter templates by name..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    style={{
                      padding: '3px 8px',
                      fontSize: 11,
                      borderRadius: 4,
                      border: '1px solid #cbd5e1',
                      width: 200,
                    }}
                  />
                </div>

                {/* Templates Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 8,
                  overflowY: 'auto',
                  flex: 1,
                  paddingRight: 4,
                }}>
                  {templates
                    .filter((tmpl) => {
                      if (templateFilter === 'python' && tmpl.kind !== 'python_function') return false;
                      if (templateFilter === 'sql' && tmpl.kind !== 'sql_query') return false;
                      if (templateFilter === 'merge' && tmpl.kind !== 'python_merge') return false;
                      if (templateSearch && !tmpl.title.toLowerCase().includes(templateSearch.toLowerCase()) && !tmpl.desc.toLowerCase().includes(templateSearch.toLowerCase())) return false;
                      return true;
                    })
                    .map((tmpl) => (
                      <div
                        key={tmpl.id}
                        style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 6,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <strong style={{ fontSize: 12, color: '#0f172a' }}>{tmpl.title}</strong>
                            <span style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 4,
                              backgroundColor: tmpl.kind === 'sql_query' ? '#e0f2fe' : tmpl.kind === 'python_merge' ? '#f3e8ff' : '#dcfce7',
                              color: tmpl.kind === 'sql_query' ? '#0369a1' : tmpl.kind === 'python_merge' ? '#7e22ce' : '#15803d',
                              textTransform: 'uppercase',
                            }}>
                              {tmpl.kind.replace('_', ' ')}
                            </span>
                          </div>
                          <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{tmpl.desc}</p>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                          <button
                            onClick={() => handleApplyTemplate(tmpl)}
                            style={{
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 600,
                              backgroundColor: '#2563eb',
                              color: '#ffffff',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                          >
                            Use Template
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {inspectorTab === 'preview' && (
              <div style={{ fontSize: 12, color: '#334155' }}>
                <p>Inspected Node: <strong>{selectedNode?.label}</strong> ({selectedNode?.id})</p>
                <p style={{ marginTop: 6 }}>Dimensions: {selectedNode?.shape[0]} rows × {selectedNode?.shape[1]} features</p>
                <p style={{ marginTop: 6 }}>Stage: {selectedNode?.stage.toUpperCase()}</p>
              </div>
            )}

            {inspectorTab === 'metadata' && (
              <div style={{ fontSize: 11, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div><strong>Node ID:</strong> {selectedNode?.id}</div>
                <div><strong>Fingerprint:</strong> {selectedNode?.fingerprint}</div>
                <div><strong>Created By:</strong> {selectedNode?.created_by}</div>
                <div><strong>Created Timestamp:</strong> {selectedNode?.created_at}</div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* 5. TEMPLATES & MERGE WIZARD MODAL (Streamlit Parity) */}
      {templateModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 24,
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: 10,
            width: '100%',
            maxWidth: 680,
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                  Pipeline Studio: Templates & Merge Wizard
                </h3>
                <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: 6, padding: 2 }}>
                  <button
                    onClick={() => setModalTab('templates')}
                    style={{
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: modalTab === 'templates' ? 600 : 500,
                      backgroundColor: modalTab === 'templates' ? '#ffffff' : 'transparent',
                      color: modalTab === 'templates' ? '#2563eb' : '#64748b',
                      borderRadius: 4,
                    }}
                  >
                    Templates (quick add)
                  </button>
                  <button
                    onClick={() => setModalTab('merge')}
                    style={{
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: modalTab === 'merge' ? 600 : 500,
                      backgroundColor: modalTab === 'merge' ? '#ffffff' : 'transparent',
                      color: modalTab === 'merge' ? '#2563eb' : '#64748b',
                      borderRadius: 4,
                    }}
                  >
                    Merge Wizard
                  </button>
                </div>
              </div>
              <button onClick={() => setTemplateModalOpen(false)} style={{ color: '#64748b', fontSize: 16 }}>✕</button>
            </div>

            {/* Modal Body: Templates Tab */}
            {modalTab === 'templates' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['all', 'python', 'sql', 'merge'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setTemplateFilter(f)}
                        style={{
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: templateFilter === f ? 600 : 500,
                          backgroundColor: templateFilter === f ? '#2563eb' : '#f1f5f9',
                          color: templateFilter === f ? '#ffffff' : '#475569',
                          borderRadius: 4,
                        }}
                      >
                        {f === 'all' ? 'All' : f === 'python' ? 'Python' : f === 'sql' ? 'SQL' : 'Merges'}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    style={{
                      padding: '5px 10px',
                      fontSize: 11,
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      width: 220,
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {templates
                    .filter((tmpl) => {
                      if (templateFilter === 'python' && tmpl.kind !== 'python_function') return false;
                      if (templateFilter === 'sql' && tmpl.kind !== 'sql_query') return false;
                      if (templateFilter === 'merge' && tmpl.kind !== 'python_merge') return false;
                      if (templateSearch && !tmpl.title.toLowerCase().includes(templateSearch.toLowerCase()) && !tmpl.desc.toLowerCase().includes(templateSearch.toLowerCase())) return false;
                      return true;
                    })
                    .map((tmpl) => (
                      <div
                        key={tmpl.id}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: '12px 16px',
                          backgroundColor: '#f8fafc',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <strong style={{ fontSize: 13, color: '#0f172a' }}>{tmpl.title}</strong>
                              <span style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 4,
                                backgroundColor: tmpl.kind === 'sql_query' ? '#e0f2fe' : tmpl.kind === 'python_merge' ? '#f3e8ff' : '#dcfce7',
                                color: tmpl.kind === 'sql_query' ? '#0369a1' : tmpl.kind === 'python_merge' ? '#7e22ce' : '#15803d',
                                textTransform: 'uppercase',
                              }}>
                                {tmpl.kind.replace('_', ' ')}
                              </span>
                              <span style={{ fontSize: 11, color: '#64748b' }}>stage: <code>{tmpl.stage}</code></span>
                            </div>
                            <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>{tmpl.desc}</p>
                          </div>
                          <button
                            onClick={() => handleApplyTemplate(tmpl)}
                            style={{
                              padding: '5px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              backgroundColor: '#2563eb',
                              color: '#ffffff',
                              borderRadius: 4,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Use Template
                          </button>
                        </div>
                        <pre style={{
                          backgroundColor: '#0f172a',
                          color: '#e2e8f0',
                          padding: 10,
                          borderRadius: 6,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          maxHeight: 90,
                          overflow: 'auto',
                          margin: 0,
                        }}>
                          {tmpl.code.trim()}
                        </pre>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Modal Body: Merge Wizard Tab (Streamlit Parity) */}
            {modalTab === 'merge' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                  Select two pipeline nodes to merge or join together on a common column key.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Left Dataset (Primary):
                    </label>
                    <select
                      value={mergeLeftId || selectedNodeId}
                      onChange={(e) => setMergeLeftId(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                    >
                      {nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label} ({n.id}) - {n.shape[0]}r
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Right Dataset (Secondary):
                    </label>
                    <select
                      value={mergeRightId}
                      onChange={(e) => setMergeRightId(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                    >
                      <option value="">Select secondary dataset...</option>
                      {nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label} ({n.id}) - {n.shape[0]}r
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Join Type:
                    </label>
                    <select
                      value={mergeJoinType}
                      onChange={(e) => setMergeJoinType(e.target.value as any)}
                      style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                    >
                      <option value="left">Left Join (keep all left rows)</option>
                      <option value="inner">Inner Join (matching keys only)</option>
                      <option value="right">Right Join (keep all right rows)</option>
                      <option value="outer">Outer Join (keep all records)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Join Key Column:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. id, customer_id, timestamp"
                      value={mergeKey}
                      onChange={(e) => setMergeKey(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    onClick={() => setTemplateModalOpen(false)}
                    style={{ padding: '6px 14px', fontSize: 12, color: '#64748b' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRunMergeWizard}
                    style={{
                      padding: '6px 16px',
                      fontSize: 12,
                      fontWeight: 600,
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Load into Code Draft &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* 6. RENAME MODAL */}
      {renameModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: 8,
            width: 360,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Rename Pipeline Node</h3>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Node Label</label>
              <input
                type="text"
                value={renameLabel}
                onChange={(e) => setRenameLabel(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Stage</label>
              <input
                type="text"
                value={renameStage}
                onChange={(e) => setRenameStage(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button onClick={() => setRenameModalOpen(false)} style={{ padding: '6px 12px', fontSize: 12, color: '#64748b' }}>
                Cancel
              </button>
              <button onClick={handleSaveRename} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, backgroundColor: '#2563eb', color: '#ffffff', borderRadius: 4 }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
