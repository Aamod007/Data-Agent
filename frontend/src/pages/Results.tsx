import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  GitFork,
  Database,
  Terminal,
  BarChart3,
  FileSearch,
  Cpu,
  Layers,
  Download,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  FileCode,
  Table,
  CheckCircle2,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import Plot from 'react-plotly.js';
import { Dataset, AnalysisResultsDetails } from '../types';
import {
  fetchAnalysisResultsDetails,
  getDownloadUrl,
  getSweetvizReportUrl,
  getSweetvizDownloadUrl,
  getStudioScriptUrl,
  getStudioSpecUrl,
} from '../api';

interface ResultsProps {
  activeDataset: Dataset | undefined;
  datasets?: Dataset[];
  onSelectDataset?: (id: string) => void;
  onRefreshTelemetry?: () => void;
}

type TabKey =
  | 'reasoning'
  | 'pipeline'
  | 'data'
  | 'sql'
  | 'charts'
  | 'eda'
  | 'models'
  | 'predictions'
  | 'mlflow';

const StreamlitInfoNotice: React.FC<{ message: string; tip?: string; agent?: string }> = ({
  message,
  tip,
  agent,
}) => (
  <div
    style={{
      padding: '16px 20px',
      backgroundColor: '#eff6ff',
      border: '1px solid #bfdbfe',
      borderRadius: 8,
      color: '#1d4ed8',
      fontSize: 13,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      lineHeight: 1.5,
      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
    }}
  >
    <Info size={18} color="#2563eb" style={{ flexShrink: 0, marginTop: 1 }} />
    <div>
      <div style={{ fontWeight: 600 }}>{message}</div>
      {tip && <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 4 }}>{tip}</div>}
      {agent && (
        <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 6 }}>
          Responsible Agent Architecture: <code style={{ backgroundColor: '#dbeafe', padding: '1px 5px', borderRadius: 3 }}>{agent}</code>
        </div>
      )}
    </div>
  </div>
);

export const Results: React.FC<ResultsProps> = ({
  activeDataset,
  datasets = [],
  onSelectDataset,
  onRefreshTelemetry,
}) => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabKey>('pipeline');
  const [targetMode, setTargetMode] = useState<'model' | 'active' | 'latest' | 'all'>('model');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(activeDataset?.id || '');
  const [details, setDetails] = useState<AnalysisResultsDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Expandable sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    fe_code: false,
    train_code: false,
    pred_code: false,
    raw_run_details: false,
    export_raw: true,
    export_sql: false,
    export_wrangled: false,
    export_cleaned: false,
    export_features: false,
  });

  // Active data stage inside Data tab
  const [selectedStageKey, setSelectedStageKey] = useState<string>('raw');

  useEffect(() => {
    if (activeDataset?.id && !selectedDatasetId) {
      setSelectedDatasetId(activeDataset.id);
    }
  }, [activeDataset?.id]);

  useEffect(() => {
    loadDetails();
  }, [selectedDatasetId, targetMode]);

  const loadDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAnalysisResultsDetails(
        selectedDatasetId || activeDataset?.id,
        targetMode
      );
      setDetails(data);
      if (data.selected_dataset_id && data.selected_dataset_id !== selectedDatasetId) {
        setSelectedDatasetId(data.selected_dataset_id);
      }
    } catch (err: any) {
      console.error('Failed to load analysis details:', err);
      setError(err.message || 'Failed to load analysis details');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSetActiveDataset = (datasetId: string) => {
    if (onSelectDataset) {
      onSelectDataset(datasetId);
      setSelectedDatasetId(datasetId);
      setNotice(`Active dataset set to "${datasetId}".`);
      setTimeout(() => setNotice(null), 4000);
      if (onRefreshTelemetry) onRefreshTelemetry();
    }
  };

  const handleDownloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    { key: 'reasoning', label: 'AI Reasoning', icon: <Brain size={14} /> },
    { key: 'pipeline', label: 'Pipeline', icon: <GitFork size={14} />, badge: details?.pipeline?.lineage?.length },
    {
      key: 'data',
      label: 'Data (raw/sql/wrangle/clean/features)',
      icon: <Database size={14} />,
      badge: details?.stages ? Object.keys(details.stages).length : undefined,
    },
    { key: 'sql', label: 'SQL', icon: <Terminal size={14} /> },
    { key: 'charts', label: 'Charts', icon: <BarChart3 size={14} /> },
    { key: 'eda', label: 'EDA Reports', icon: <FileSearch size={14} /> },
    { key: 'models', label: 'Models', icon: <Cpu size={14} /> },
    { key: 'predictions', label: 'Predictions', icon: <CheckCircle2 size={14} /> },
    { key: 'mlflow', label: 'MLflow', icon: <Layers size={14} /> },
  ];

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Header & Overview */}
      <div
        style={{
          padding: '20px 28px 16px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={18} color="#2563eb" />
              </div>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                  Analysis Results & Deliverables
                </h1>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                  Inspect reproducible pipeline lineages, data stages, SQL executors, interactive profiling, and model artifacts.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => navigate('/pipeline')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(37,99,235,0.2)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
            >
              <ExternalLink size={14} /> Open Pipeline Studio
            </button>

            <button
              onClick={loadDetails}
              disabled={loading}
              title="Refresh deliverables"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                backgroundColor: '#ffffff',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Streamlit Pipeline Target Selector Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            padding: '12px 16px',
            backgroundColor: '#f1f5f9',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
          }}
        >
          {/* Target Radios */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Pipeline target:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {[
                { id: 'model', label: 'Model (latest feature)' },
                { id: 'active', label: 'Active dataset' },
                { id: 'latest', label: 'Latest dataset' },
                { id: 'all', label: 'All datasets' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12,
                    fontWeight: targetMode === opt.id ? 600 : 400,
                    color: targetMode === opt.id ? '#1e293b' : '#64748b',
                    cursor: 'pointer',
                    backgroundColor: targetMode === opt.id ? '#ffffff' : 'transparent',
                    padding: '4px 10px',
                    borderRadius: 5,
                    border: targetMode === opt.id ? '1px solid #cbd5e1' : '1px solid transparent',
                    boxShadow: targetMode === opt.id ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="radio"
                    name="pipeline_target"
                    checked={targetMode === opt.id}
                    onChange={() => setTargetMode(opt.id as any)}
                    style={{ margin: 0, accentColor: '#2563eb' }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Active Dataset Picker & Set Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Set active dataset:</span>
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              style={{
                fontSize: 12,
                color: '#1e293b',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '6px 12px',
                outline: 'none',
                minWidth: 220,
              }}
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.stage ? `${d.stage}: ` : ''}
                  {d.label} ({d.records} x {d.features}) [{d.id.slice(0, 10)}]
                </option>
              ))}
            </select>

            <button
              onClick={() => handleSetActiveDataset(selectedDatasetId)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#2563eb',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dbeafe')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
            >
              Set active
            </button>

            <button
              onClick={() => {
                if (details?.pipeline?.target_dataset_id) {
                  handleSetActiveDataset(details.pipeline.target_dataset_id);
                }
              }}
              disabled={!details?.pipeline?.target_dataset_id}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#475569',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '6px 12px',
                borderRadius: 6,
                cursor: details?.pipeline?.target_dataset_id ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
                opacity: details?.pipeline?.target_dataset_id ? 1 : 0.6,
              }}
            >
              Use target
            </button>
          </div>
        </div>

        {/* Notice Alert */}
        {notice && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 6,
              color: '#065f46',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle2 size={14} color="#10b981" />
            {notice}
          </div>
        )}

        {/* Streamlit Navigation Tabs Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            overflowX: 'auto',
            marginTop: 16,
            paddingBottom: 2,
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: isSelected ? 600 : 500,
                  color: isSelected ? '#2563eb' : '#64748b',
                  backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                  border: 'none',
                  borderBottom: isSelected ? '2px solid #2563eb' : '2px solid transparent',
                  borderRadius: '6px 6px 0 0',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.color = '#64748b';
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 10,
                      backgroundColor: isSelected ? '#2563eb' : '#e2e8f0',
                      color: isSelected ? '#ffffff' : '#475569',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Body */}
      <div style={{ padding: '24px 28px', flex: 1 }}>
        {loading && !details ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              backgroundColor: '#ffffff',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
            }}
          >
            <RefreshCw size={24} color="#2563eb" className="animate-spin" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>Loading analysis results...</p>
            <p style={{ fontSize: 12, color: '#64748b' }}>Synthesizing pipeline lineage, data stages, and models.</p>
          </div>
        ) : error ? (
          <div
            style={{
              padding: 20,
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              color: '#991b1b',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <AlertCircle size={18} />
            <div>
              <p style={{ fontWeight: 600, margin: 0 }}>Failed to load analysis details</p>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>{error}</p>
            </div>
          </div>
        ) : (
          <div>
            {/* ----------------- TAB 1: AI REASONING ----------------- */}
            {activeTab === 'reasoning' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    padding: 24,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Brain size={18} color="#2563eb" />
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      AI Agent Deliberations & Reasoning
                    </h2>
                  </div>

                  {details?.reasoning_items && details.reasoning_items.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {details.reasoning_items.map(([agentName, text], idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '16px 18px',
                            backgroundColor: '#f8fafc',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              marginBottom: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: '#2563eb',
                                backgroundColor: '#eff6ff',
                                padding: '2px 8px',
                                borderRadius: 4,
                                border: '1px solid #bfdbfe',
                              }}
                            >
                              {agentName}
                            </span>
                          </div>
                          <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, margin: 0 }}>
                            {text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <StreamlitInfoNotice
                      message="No reasoning available."
                      tip="Workflow deliberations and architectural reasoning will appear here when analysis instructions are executed."
                      agent="WorkflowPlannerAgent & Supervisors"
                    />
                  )}
                </div>
              </div>
            )}

            {/* ----------------- TAB 2: PIPELINE ----------------- */}
            {activeTab === 'pipeline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Pipeline Metadata Cards */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    padding: 20,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: 16,
                      marginBottom: 16,
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                        Pipeline hash
                      </span>
                      <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#0f172a', fontWeight: 600 }}>
                        <code>{details?.pipeline?.pipeline_hash}</code>
                      </p>
                    </div>

                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                        Target dataset id
                      </span>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#2563eb', fontWeight: 600 }}>
                        {details?.pipeline?.target_dataset_id}
                      </p>
                    </div>

                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                        Model dataset id
                      </span>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#0f172a' }}>
                        {details?.pipeline?.model_dataset_id || 'None'}
                      </p>
                    </div>

                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                        Active dataset id
                      </span>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#0f172a' }}>
                        {details?.pipeline?.active_dataset_id}
                      </p>
                    </div>
                  </div>

                  {details?.pipeline?.inputs && details.pipeline.inputs.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Inputs: </span>
                      {details.pipeline.inputs.map((inp, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 11,
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            padding: '2px 6px',
                            borderRadius: 4,
                            marginRight: 6,
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {inp}
                        </span>
                      ))}
                    </div>
                  )}

                  {details?.pipeline?.persisted_dir && (
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      Saved to: <code>{details.pipeline.persisted_dir}</code>
                    </div>
                  )}

                  <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />

                  {/* Lineage Table */}
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
                    Lineage DAG Sequence
                  </h3>
                  <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Step</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Dataset ID</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Label</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Stage</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Shape</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Action / Origin</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details?.pipeline?.lineage?.map((row) => (
                          <tr key={row.step} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#2563eb' }}>#{row.step}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{row.dataset_id}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{row.label}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  backgroundColor: row.stage === 'raw' ? '#e2e8f0' : '#dbeafe',
                                  color: row.stage === 'raw' ? '#475569' : '#1e40af',
                                }}
                              >
                                {row.stage}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>{row.shape}</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{row.action}</td>
                            <td style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 11 }}>{row.timestamp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <a
                      href={getStudioSpecUrl()}
                      download={`pipeline_spec_${details?.target || 'model'}.json`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: '#ffffff',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '8px 14px',
                        borderRadius: 6,
                        textDecoration: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <Download size={14} /> Download pipeline spec (JSON)
                    </a>

                    {details?.pipeline?.script && (
                      <a
                        href={getStudioScriptUrl()}
                        download={`pipeline_repro_${details?.target || 'model'}.py`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          backgroundColor: '#ffffff',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '8px 14px',
                          borderRadius: 6,
                          textDecoration: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <Download size={14} /> Download pipeline script
                      </a>
                    )}

                    <button
                      onClick={() => navigate('/pipeline')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '8px 16px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        marginLeft: 'auto',
                      }}
                    >
                      <ExternalLink size={14} /> Open Pipeline Studio
                    </button>
                  </div>
                </div>


                {/* ML / Prediction Steps Expanders (Shown only if ML/Feature steps exist, matching Streamlit) */}
                {(details?.feature_engineering_code || details?.model_training_code || details?.prediction_code) && (
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      padding: 20,
                    }}
                  >
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>
                      ML / Prediction Steps (best effort)
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Feature Engineering Code */}
                      {details?.feature_engineering_code && (
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                          <button
                            onClick={() => toggleSection('fe_code')}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 16px',
                              backgroundColor: '#f8fafc',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                              Feature engineering code
                            </span>
                            {expandedSections.fe_code ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          {expandedSections.fe_code && (
                            <div style={{ backgroundColor: '#0f172a', padding: 16, overflowX: 'auto' }}>
                              <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#e2e8f0' }}>
                                {details.feature_engineering_code}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Model Training Code (H2O AutoML) */}
                      {details?.model_training_code && (
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                          <button
                            onClick={() => toggleSection('train_code')}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 16px',
                              backgroundColor: '#f8fafc',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                              Model training code (H2O AutoML)
                            </span>
                            {expandedSections.train_code ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          {expandedSections.train_code && (
                            <div style={{ backgroundColor: '#0f172a', padding: 16, overflowX: 'auto' }}>
                              <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#e2e8f0' }}>
                                {details.model_training_code}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Prediction Code */}
                      {details?.prediction_code && (
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                          <button
                            onClick={() => toggleSection('pred_code')}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 16px',
                              backgroundColor: '#f8fafc',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                              Prediction code
                            </span>
                            {expandedSections.pred_code ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          {expandedSections.pred_code && (
                            <div style={{ backgroundColor: '#0f172a', padding: 16, overflowX: 'auto' }}>
                              <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#e2e8f0' }}>
                                {details.prediction_code}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ----------------- TAB 3: DATA STAGES ----------------- */}
            {activeTab === 'data' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {details?.stages && Object.keys(details.stages).length > 0 ? (
                  Object.entries(details.stages).map(([stageKey, stageData]) => (
                    <div
                      key={stageKey}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        padding: 20,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 14,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Table size={16} color="#2563eb" />
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                            {stageData.stage_label} Preview
                          </h3>
                          <span
                            style={{
                              fontSize: 11,
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '2px 8px',
                              borderRadius: 10,
                              fontWeight: 600,
                            }}
                          >
                            {stageData.shape[0].toLocaleString()} rows × {stageData.shape[1]} cols
                          </span>
                        </div>

                        <span style={{ fontSize: 11, color: '#64748b' }}>
                          Node: <code>{stageData.dataset_id}</code> ({stageData.label})
                        </span>
                      </div>

                      {/* Dataframe Preview Table */}
                      <div
                        style={{
                          overflowX: 'auto',
                          maxHeight: 320,
                          borderRadius: 6,
                          border: '1px solid #e2e8f0',
                          marginBottom: 14,
                        }}
                      >
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0 }}>
                              {stageData.columns.slice(0, 15).map((col, idx) => (
                                <th
                                  key={idx}
                                  style={{
                                    padding: '8px 12px',
                                    fontWeight: 600,
                                    color: '#475569',
                                    textAlign: 'left',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {stageData.rows.map((row, rIdx) => (
                              <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                {stageData.columns.slice(0, 15).map((col, cIdx) => (
                                  <td
                                    key={cIdx}
                                    style={{
                                      padding: '6px 12px',
                                      color: '#1e293b',
                                      whiteSpace: 'nowrap',
                                      fontFamily: typeof row[col] === 'number' ? 'var(--font-mono)' : 'inherit',
                                    }}
                                  >
                                    {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span style={{ color: '#cbd5e1' }}>null</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Streamlit Expander: Export stage (CSV, Parquet, JSON) */}
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                        <button
                          onClick={() => toggleSection(`export_${stageKey}`)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            backgroundColor: '#f8fafc',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                            ⬇️ Export {stageData.stage_label.toLowerCase()} (CSV, Parquet, JSON)
                          </span>
                          {expandedSections[`export_${stageKey}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>

                        {expandedSections[`export_${stageKey}`] && (
                          <div
                            style={{
                              padding: 14,
                              display: 'grid',
                              gridTemplateColumns: 'repeat(3, 1fr)',
                              gap: 12,
                              backgroundColor: '#ffffff',
                            }}
                          >
                            <a
                              href={stageData.download_csv}
                              download={`${stageKey}.csv`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '8px 12px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                color: '#334155',
                                fontSize: 12,
                                fontWeight: 600,
                                textDecoration: 'none',
                              }}
                            >
                              <Download size={14} /> Download CSV
                            </a>

                            <a
                              href={stageData.download_parquet}
                              download={`${stageKey}.parquet`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '8px 12px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                color: '#334155',
                                fontSize: 12,
                                fontWeight: 600,
                                textDecoration: 'none',
                              }}
                            >
                              <Download size={14} /> Download Parquet
                            </a>

                            <a
                              href={stageData.download_json}
                              download={`${stageKey}.json`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '8px 12px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                color: '#334155',
                                fontSize: 12,
                                fontWeight: 600,
                                textDecoration: 'none',
                              }}
                            >
                              <Download size={14} /> Download JSON
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <StreamlitInfoNotice
                    message="No data frames returned."
                    tip="Select or load a dataset to preview data stages across the pipeline lineage."
                    agent="DataLoaderToolsAgent"
                  />
                )}
              </div>
            )}

            {/* ----------------- TAB 4: SQL ----------------- */}
            {activeTab === 'sql' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {details?.sql?.query ? (
                  <>
                    {/* SQL Query */}
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        padding: 20,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                          SQL Query
                        </h3>
                        <button
                          onClick={() => handleDownloadFile(details?.sql?.query || '', 'query.sql', 'application/sql')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: '#ffffff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            padding: '6px 12px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Download size={13} /> Download query (.sql)
                        </button>
                      </div>

                      <div style={{ backgroundColor: '#0f172a', borderRadius: 8, padding: 16, overflowX: 'auto' }}>
                        <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#38bdf8', lineHeight: 1.5 }}>
                          {details.sql.query}
                        </pre>
                      </div>
                    </div>

                    {/* SQL Executor (Python) */}
                    {details.sql.executor && (
                      <div
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                          padding: 20,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                            SQL Executor (Python)
                          </h3>
                          <button
                            onClick={() => handleDownloadFile(details?.sql?.executor || '', 'sql_executor.py', 'text/x-python')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              backgroundColor: '#ffffff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              padding: '6px 12px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <Download size={13} /> Download executor (.py)
                          </button>
                        </div>

                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
                          name={details.sql.executor_name}  path={details.sql.executor_path}
                        </div>

                        <div style={{ backgroundColor: '#0f172a', borderRadius: 8, padding: 16, overflowX: 'auto' }}>
                          <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#e2e8f0', lineHeight: 1.5 }}>
                            {details.sql.executor}
                          </pre>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <StreamlitInfoNotice
                    message="No SQL query generated for this turn."
                    tip="Ask the SQLDatabaseAgent in Chat (e.g. 'Run a SQL query to summarize this dataset') to generate queries and executors."
                    agent="SQLDatabaseAgent"
                  />
                )}
              </div>
            )}

            {/* ----------------- TAB 5: CHARTS ----------------- */}
            {activeTab === 'charts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {details?.charts?.viz_error && (
                  <div style={{ padding: 12, backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#991b1b', fontSize: 12 }}>
                    <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
                    Visualization error: {details.charts.viz_error}
                  </div>
                )}

                {details?.charts?.viz_warning && (
                  <div style={{ padding: 12, backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, color: '#92400e', fontSize: 12 }}>
                    {details.charts.viz_warning}
                  </div>
                )}

                {details?.charts?.plotly_spec ? (
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      padding: 20,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <Plot
                      data={details.charts.plotly_spec.data || []}
                      layout={{
                        ...details.charts.plotly_spec.layout,
                        autosize: true,
                        margin: { l: 50, r: 30, t: 50, b: 50 },
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: 480 }}
                      config={{ responsive: true, displayModeBar: true }}
                    />
                  </div>
                ) : (
                  <StreamlitInfoNotice
                    message="No charts returned."
                    tip="Ask the DataVisualizationAgent in Chat (e.g. 'Plot distributions across categories') to generate interactive Plotly visuals."
                    agent="DataVisualizationAgent"
                  />
                )}
              </div>
            )}

            {/* ----------------- TAB 6: EDA REPORTS (SWEETVIZ) ----------------- */}
            {activeTab === 'eda' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {details?.eda_reports?.sweetviz_url ? (
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      padding: 20,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                          Sweetviz report
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>
                          <code>{details?.eda_reports?.sweetviz_file}</code>
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <a
                          href={getSweetvizDownloadUrl(details?.selected_dataset_id || '')}
                          download={`sweetviz_report_${details?.selected_dataset_label || 'report'}.html`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: '#ffffff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            padding: '6px 14px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                        >
                          <Download size={13} /> Download Sweetviz HTML
                        </a>

                        <a
                          href={getSweetvizReportUrl(details?.selected_dataset_id || '')}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            padding: '6px 14px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                        >
                          <ExternalLink size={13} /> Open Standalone Tab
                        </a>
                      </div>
                    </div>

                    {/* Embedded Interactive Sweetviz Iframe */}
                    <div
                      style={{
                        height: 800,
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        overflow: 'hidden',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <iframe
                        src={getSweetvizReportUrl(details?.selected_dataset_id || '')}
                        title="Sweetviz Report"
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <StreamlitInfoNotice
                    message="No EDA reports returned."
                    tip="Trigger interactive Sweetviz profiling in Pipeline Studio or ask EDAToolsAgent in Chat."
                    agent="EDAToolsAgent"
                  />
                )}
              </div>
            )}

            {/* ----------------- TAB 7: MODELS ----------------- */}
            {activeTab === 'models' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {details?.models?.leaderboard && details.models.leaderboard.length > 0 ? (
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      padding: 20,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
                      Model Info / Leaderboard
                    </h3>

                    <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'left' }}>Model ID</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'left' }}>Algorithm</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>AUC</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>LogLoss</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Accuracy</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>F1 Score</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Training Time</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.models.leaderboard.map((m) => (
                            <tr key={m.model_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{m.model_id}</td>
                              <td style={{ padding: '8px 12px', color: '#1e293b' }}>{m.algorithm}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                                {m.auc.toFixed(3)}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                {m.logloss.toFixed(3)}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                {(m.accuracy * 100).toFixed(1)}%
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                {m.f1_score.toFixed(3)}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                                {m.training_time_s}s
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: 10,
                                    backgroundColor: m.status === 'Best Model' ? '#ecfdf5' : '#f1f5f9',
                                    color: m.status === 'Best Model' ? '#065f46' : '#475569',
                                  }}
                                >
                                  {m.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Evaluation Metrics & ROC Curve */}
                    {details.models.eval_metrics && (
                      <>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
                          Evaluation
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
                          <div style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Validation AUC</span>
                            <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: '#2563eb' }}>
                              {details.models.eval_metrics.auc}
                            </p>
                          </div>
                          <div style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>PR AUC</span>
                            <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                              {details.models.eval_metrics.pr_auc}
                            </p>
                          </div>
                          <div style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Optimal F1</span>
                            <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                              {details.models.eval_metrics.f1_optimal}
                            </p>
                          </div>
                          <div style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>LogLoss</span>
                            <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                              {details.models.eval_metrics.logloss}
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    {details.models.eval_plotly_spec && (
                      <div style={{ marginTop: 12 }}>
                        <Plot
                          data={details.models.eval_plotly_spec.data || []}
                          layout={{
                            ...details.models.eval_plotly_spec.layout,
                            autosize: true,
                            margin: { l: 50, r: 30, t: 40, b: 40 },
                          }}
                          useResizeHandler={true}
                          style={{ width: '100%', height: 380 }}
                          config={{ responsive: true }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <StreamlitInfoNotice
                    message="No model or evaluation artifacts."
                    tip="Ask H2OMLAgent in Chat (e.g. 'Train an AutoML model on this dataset') to generate model leaderboards and ROC evaluations."
                    agent="H2OMLAgent & ModelEvaluationAgent"
                  />
                )}
              </div>
            )}

            {/* ----------------- TAB 8: PREDICTIONS ----------------- */}
            {activeTab === 'predictions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {details?.predictions?.rows && details.predictions.rows.length > 0 ? (
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      padding: 20,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle2 size={16} color="#10b981" />
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                          Predictions Preview
                        </h3>
                      </div>

                      <button
                        onClick={() => {
                          const rows = details?.predictions?.rows || [];
                          if (rows.length === 0) return;
                          const header = Object.keys(rows[0]).join(',');
                          const csv = [header, ...rows.map((r) => Object.values(r).join(','))].join('\n');
                          handleDownloadFile(csv, 'predictions.csv', 'text/csv');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          backgroundColor: '#ffffff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Download size={13} /> Download predictions (.csv)
                      </button>
                    </div>

                    <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'left' }}>#</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: '#2563eb', textAlign: 'center' }}>Actual Target</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: '#16a34a', textAlign: 'center' }}>Predicted Target</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Probability</th>
                            {Object.keys(details.predictions.rows[0])
                              .filter((k) => !['actual_target', 'predicted_target', 'prediction_probability'].includes(k))
                              .slice(0, 6)
                              .map((k, i) => (
                                <th key={i} style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'left' }}>
                                  {k}
                                </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody>
                          {details.predictions.rows.map((row, idx) => {
                            const isMatch = row.actual_target === row.predicted_target;
                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{idx + 1}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: 10,
                                      fontWeight: 700,
                                      fontSize: 11,
                                      backgroundColor: '#f1f5f9',
                                      color: '#334155',
                                    }}
                                  >
                                    {row.actual_target}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: 10,
                                      fontWeight: 700,
                                      fontSize: 11,
                                      backgroundColor: isMatch ? '#ecfdf5' : '#fef2f2',
                                      color: isMatch ? '#065f46' : '#991b1b',
                                    }}
                                  >
                                    {row.predicted_target}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                  {(row.prediction_probability * 100).toFixed(1)}%
                                </td>
                                {Object.keys(row)
                                  .filter((k) => !['actual_target', 'predicted_target', 'prediction_probability'].includes(k))
                                  .slice(0, 6)
                                  .map((k, ci) => (
                                    <td key={ci} style={{ padding: '8px 12px', color: '#334155', whiteSpace: 'nowrap' }}>
                                      {String(row[k])}
                                    </td>
                                  ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <StreamlitInfoNotice
                    message="No predictions detected for this turn."
                    tip="(Tip: ask 'predict using mlflow on the dataset' or 'predict with model <id> on the dataset'.)"
                    agent="ModelEvaluationAgent"
                  />
                )}
              </div>
            )}

            {/* ----------------- TAB 9: MLFLOW ----------------- */}
            {activeTab === 'mlflow' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {details?.mlflow?.runs && details.mlflow.runs.length > 0 ? (
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      padding: 20,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Layers size={16} color="#2563eb" />
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                          MLflow Artifacts & Runs
                        </h3>
                      </div>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        Tracking URI: <code>{details.mlflow.tracking_uri}</code>
                      </span>
                    </div>

                    {/* Runs Table */}
                    <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'left' }}>Run ID</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'left' }}>Run Name</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Status</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'left' }}>Start Time</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Duration</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'left' }}>Model URI</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'left' }}>Parameters</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', textAlign: 'left' }}>Metrics</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.mlflow.runs.map((run) => (
                            <tr key={run.run_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{run.run_id}</td>
                              <td style={{ padding: '8px 12px', color: '#0f172a' }}>{run.run_name}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    backgroundColor: '#ecfdf5',
                                    color: '#065f46',
                                  }}
                                >
                                  {run.status}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', color: '#64748b' }}>{run.start_time}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                {run.duration_seconds}s
                              </td>
                              <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#2563eb' }}>
                                {run.model_uri}
                              </td>
                              <td style={{ padding: '8px 12px', fontSize: 11, color: '#475569' }}>{run.params_preview}</td>
                              <td style={{ padding: '8px 12px', fontSize: 11, color: '#065f46', fontWeight: 600 }}>
                                {run.metrics_preview}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Raw Run Details Expander */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <button
                        onClick={() => toggleSection('raw_run_details')}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          backgroundColor: '#f8fafc',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                          Raw run details & experiment metadata
                        </span>
                        {expandedSections.raw_run_details ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      {expandedSections.raw_run_details && (
                        <div style={{ backgroundColor: '#0f172a', padding: 16, overflowX: 'auto' }}>
                          <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#e2e8f0' }}>
                            {JSON.stringify(details.mlflow, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <StreamlitInfoNotice
                    message="No MLflow artifacts."
                    tip="Ask MLflowToolsAgent in Chat to track experiment runs, metrics, and parameters."
                    agent="MLflowToolsAgent"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
