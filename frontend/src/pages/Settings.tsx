import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Cpu,
  Database,
  Sliders,
  FolderKanban,
  MessageSquare,
  Activity,
  Layers,
  Terminal,
  Check,
  AlertCircle,
  Trash2,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppConfig, Dataset, PipelineProject } from '../types';
import {
  fetchConfig,
  updateConfig,
  fetchDatasets,
  checkConnection,
  clearChat,
  listProjects,
  loadProject,
} from '../api';

export const Settings: React.FC = () => {
  const navigate = useNavigate();

  // Config State
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Section 1: LLM Provider & Credentials
  const [provider, setProvider] = useState('OpenAI');
  const [openaiKey, setOpenaiKey] = useState('');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');

  const [openrouterKey, setOpenrouterKey] = useState('');
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);
  const [openrouterModelOption, setOpenrouterModelOption] = useState('inclusionai/ling-3.0-flash-vl:free');
  const [openrouterCustomModel, setOpenrouterCustomModel] = useState('');

  const [lmBaseUrl, setLmBaseUrl] = useState('http://127.0.0.1:1234/v1');
  const [lmModelOption, setLmModelOption] = useState('qwen/qwen3-vl-8b');
  const [lmCustomModel, setLmCustomModel] = useState('');

  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3.1:8b');

  // Connection Test State
  const [connTesting, setConnTesting] = useState(false);
  const [connStatus, setConnStatus] = useState<{ status: 'ok' | 'error'; message: string } | null>(null);

  // Section 2: Agent & Supervisory Behaviors
  const [recursionLimit, setRecursionLimit] = useState(10);
  const [memory, setMemory] = useState(true);
  const [proactiveWorkflowMode, setProactiveWorkflowMode] = useState(false);
  const [useLlmIntentParser, setUseLlmIntentParser] = useState(true);

  // Section 3: Data Options
  const [previewRows, setPreviewRows] = useState(5);
  const [activeDatasetOverride, setActiveDatasetOverride] = useState('');
  const [availableDatasets, setAvailableDatasets] = useState<Dataset[]>([]);

  // Section 4: Pipeline Behaviors & Caching
  const [pipelinePersistDir, setPipelinePersistDir] = useState('');
  const [pipelinePersistEnabled, setPipelinePersistEnabled] = useState(true);
  const [pipelinePersistOverwrite, setPipelinePersistOverwrite] = useState(false);
  const [pipelinePersistIncludeSql, setPipelinePersistIncludeSql] = useState(true);
  const [pipelinePreserveAllNodes, setPipelinePreserveAllNodes] = useState(true);
  const [pipelinePreserveStudioNodes, setPipelinePreserveStudioNodes] = useState(true);
  const [pipelineDatasetPersistEnabled, setPipelineDatasetPersistEnabled] = useState(false);
  const [pipelineDatasetRestoreEnabled, setPipelineDatasetRestoreEnabled] = useState(false);
  const [pipelineDatasetCacheFormat, setPipelineDatasetCacheFormat] = useState('parquet');
  const [pipelineDatasetCacheMaxItems, setPipelineDatasetCacheMaxItems] = useState(50);
  const [pipelineDatasetCacheMaxMb, setPipelineDatasetCacheMaxMb] = useState(1024.0);

  // Section 5: Chat ↔ Pipeline Context
  const [pipelineChatContextEnabled, setPipelineChatContextEnabled] = useState(true);
  const [pipelineChatContextIncludeCode, setPipelineChatContextIncludeCode] = useState(false);
  const [pipelineUseSelectedNodeForChat, setPipelineUseSelectedNodeForChat] = useState(true);
  const [pipelineSyncStateToAgents, setPipelineSyncStateToAgents] = useState(true);

  // Section 6: SQL Options
  const [sqlUrl, setSqlUrl] = useState('sqlite:///data/northwind.db');

  // Section 7: MLflow Options
  const [enableMlflowLogging, setEnableMlflowLogging] = useState(true);
  const [mlflowTrackingUri, setMlflowTrackingUri] = useState('sqlite:///mlflow.db');
  const [mlflowArtifactRoot, setMlflowArtifactRoot] = useState('mlflow_artifacts');
  const [mlflowExperimentName, setMlflowExperimentName] = useState('H2O AutoML');

  // Section 8: Debug Options
  const [debugMode, setDebugMode] = useState(false);
  const [showProgress, setShowProgress] = useState(true);
  const [showLiveLogs, setShowLiveLogs] = useState(true);

  // Section 9: Studio & Layout
  const [pipelineStudioDocked, setPipelineStudioDocked] = useState(false);

  // Section 10: Projects
  const [projects, setProjects] = useState<PipelineProject[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProjectDir, setSelectedProjectDir] = useState('');
  const [projectRehydrate, setProjectRehydrate] = useState(true);
  const [projectNotice, setProjectNotice] = useState<string | null>(null);

  // Expandable sections
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    llm: true,
    agent: true,
    data: true,
    pipeline: true,
    chat_context: true,
    sql: true,
    mlflow: true,
    debug: true,
    projects: true,
  });

  const toggleCard = (key: string) => {
    setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [cfg, dsRes, projRes] = await Promise.all([
        fetchConfig(),
        fetchDatasets().catch(() => ({ datasets: [], active_dataset_id: '' })),
        listProjects(false).catch(() => []),
      ]);

      setConfig(cfg);
      setAvailableDatasets(dsRes.datasets || []);
      setProjects(projRes || []);

      // Populate config values
      setProvider(cfg.llm_provider || 'OpenAI');
      setOpenaiModel(cfg.model_name || 'gpt-4o-mini');
      if (cfg.openrouter_model) {
        if (POPULAR_OPENROUTER_MODELS.includes(cfg.openrouter_model)) {
          setOpenrouterModelOption(cfg.openrouter_model);
        } else {
          setOpenrouterModelOption('Custom (enter below)');
          setOpenrouterCustomModel(cfg.openrouter_model);
        }
      }

      setLmBaseUrl(cfg.lm_studio_base_url || 'http://127.0.0.1:1234/v1');
      if (cfg.lm_studio_model) {
        if (['inclusionai/ling-3.0-flash-vl:free', 'qwen/qwen3-vl-8b'].includes(cfg.lm_studio_model)) {
          setLmModelOption(cfg.lm_studio_model);
        } else {
          setLmModelOption('Custom (enter below)');
          setLmCustomModel(cfg.lm_studio_model);
        }
      }

      setOllamaUrl(cfg.ollama_base_url || 'http://localhost:11434');
      setOllamaModel(cfg.ollama_model || 'llama3.1:8b');

      setRecursionLimit(cfg.recursion_limit ?? 10);
      setMemory(cfg.memory ?? true);
      setProactiveWorkflowMode(cfg.proactive_workflow_mode ?? false);
      setUseLlmIntentParser(cfg.use_llm_intent_parser ?? true);

      setPreviewRows(cfg.preview_rows ?? 5);
      setActiveDatasetOverride(cfg.active_dataset_id_override || '');

      setPipelinePersistDir(cfg.pipeline_persist_dir || 'pipeline_reports/pipelines');
      setPipelinePersistEnabled(cfg.pipeline_persist_enabled ?? true);
      setPipelinePersistOverwrite(cfg.pipeline_persist_overwrite ?? false);
      setPipelinePersistIncludeSql(cfg.pipeline_persist_include_sql ?? true);
      setPipelinePreserveAllNodes(cfg.pipeline_preserve_all_nodes ?? true);
      setPipelinePreserveStudioNodes(cfg.pipeline_preserve_studio_nodes ?? true);
      setPipelineDatasetPersistEnabled(cfg.pipeline_dataset_persist_enabled ?? false);
      setPipelineDatasetRestoreEnabled(cfg.pipeline_dataset_restore_enabled ?? false);
      setPipelineDatasetCacheFormat(cfg.pipeline_dataset_cache_format || 'parquet');
      setPipelineDatasetCacheMaxItems(cfg.pipeline_dataset_cache_max_items ?? 50);
      setPipelineDatasetCacheMaxMb(cfg.pipeline_dataset_cache_max_mb ?? 1024.0);

      setPipelineChatContextEnabled(cfg.pipeline_chat_context_enabled ?? true);
      setPipelineChatContextIncludeCode(cfg.pipeline_chat_context_include_code ?? false);
      setPipelineUseSelectedNodeForChat(cfg.pipeline_use_selected_node_for_chat ?? true);
      setPipelineSyncStateToAgents(cfg.pipeline_sync_state_to_agents ?? true);

      setSqlUrl(cfg.sql_url || 'sqlite:///data/northwind.db');

      setEnableMlflowLogging(cfg.enable_mlflow_logging ?? true);
      setMlflowTrackingUri(cfg.mlflow_tracking_uri || 'sqlite:///mlflow.db');
      setMlflowArtifactRoot(cfg.mlflow_artifact_root || 'mlflow_artifacts');
      setMlflowExperimentName(cfg.mlflow_experiment_name || 'H2O AutoML');

      setDebugMode(cfg.debug_mode ?? false);
      setShowProgress(cfg.show_progress ?? true);
      setShowLiveLogs(cfg.show_live_logs ?? true);

      setPipelineStudioDocked(cfg.pipeline_studio_docked ?? false);
    } catch (err: any) {
      console.error('Failed to load configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshProjects = async () => {
    try {
      const projs = await listProjects(showArchived, projectSearch);
      setProjects(projs);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleLoadProject = async (openStudio: boolean) => {
    if (!selectedProjectDir) return;
    try {
      const res = await loadProject(selectedProjectDir, projectRehydrate);
      setProjectNotice(`Project loaded: ${res.message}`);
      if (openStudio) {
        navigate('/pipeline');
      }
    } catch (err: any) {
      setProjectNotice(`Error loading project: ${err.message}`);
    }
  };

  const handleCheckConnection = async () => {
    setConnTesting(true);
    setConnStatus(null);
    try {
      let params: any = { provider };
      if (provider === 'OpenAI') {
        params.api_key = openaiKey || undefined;
      } else if (provider === 'OpenRouter') {
        params.api_key = openrouterKey || undefined;
      } else if (provider === 'LM Studio') {
        params.base_url = lmBaseUrl;
      } else if (provider === 'Ollama') {
        params.base_url = ollamaUrl;
        params.model = ollamaModel;
      }

      const res = await checkConnection(params);
      setConnStatus({ status: res.status as 'ok' | 'error', message: res.message });
    } catch (err: any) {
      setConnStatus({ status: 'error', message: err.message || 'Connection failed' });
    } finally {
      setConnTesting(false);
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm('Are you sure you want to clear chat history and reset agent memory?')) {
      return;
    }
    try {
      await clearChat();
      alert('Chat history and agent session reset successfully.');
    } catch (err: any) {
      alert(`Clear chat failed: ${err.message}`);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      let resolvedModel = openaiModel;
      if (provider === 'OpenRouter') {
        resolvedModel = openrouterModelOption === 'Custom (enter below)' ? openrouterCustomModel : openrouterModelOption;
      } else if (provider === 'LM Studio') {
        resolvedModel = lmModelOption === 'Custom (enter below)' ? lmCustomModel : lmModelOption;
      } else if (provider === 'Ollama') {
        resolvedModel = ollamaModel;
      }

      await updateConfig({
        llm_provider: provider,
        model_name: resolvedModel,
        openai_api_key: openaiKey || undefined,
        openrouter_api_key: openrouterKey || undefined,
        openrouter_model: provider === 'OpenRouter' ? resolvedModel : undefined,
        lm_studio_base_url: lmBaseUrl,
        lm_studio_model: provider === 'LM Studio' ? resolvedModel : undefined,
        ollama_base_url: ollamaUrl,
        ollama_model: ollamaModel,
        sql_url: sqlUrl,
        enable_mlflow_logging: enableMlflowLogging,
        mlflow_tracking_uri: mlflowTrackingUri,
        mlflow_artifact_root: mlflowArtifactRoot,
        mlflow_experiment_name: mlflowExperimentName,
        memory: memory,
        recursion_limit: recursionLimit,
        proactive_workflow_mode: proactiveWorkflowMode,
        use_llm_intent_parser: useLlmIntentParser,
        preview_rows: previewRows,
        active_dataset_id_override: activeDatasetOverride,
        pipeline_persist_dir: pipelinePersistDir,
        pipeline_persist_enabled: pipelinePersistEnabled,
        pipeline_persist_overwrite: pipelinePersistOverwrite,
        pipeline_persist_include_sql: pipelinePersistIncludeSql,
        pipeline_preserve_all_nodes: pipelinePreserveAllNodes,
        pipeline_preserve_studio_nodes: pipelinePreserveStudioNodes,
        pipeline_dataset_persist_enabled: pipelineDatasetPersistEnabled,
        pipeline_dataset_restore_enabled: pipelineDatasetRestoreEnabled,
        pipeline_dataset_cache_format: pipelineDatasetCacheFormat,
        pipeline_dataset_cache_max_items: pipelineDatasetCacheMaxItems,
        pipeline_dataset_cache_max_mb: pipelineDatasetCacheMaxMb,
        pipeline_chat_context_enabled: pipelineChatContextEnabled,
        pipeline_chat_context_include_code: pipelineChatContextIncludeCode,
        pipeline_use_selected_node_for_chat: pipelineUseSelectedNodeForChat,
        pipeline_sync_state_to_agents: pipelineSyncStateToAgents,
        debug_mode: debugMode,
        show_progress: showProgress,
        show_live_logs: showLiveLogs,
        pipeline_studio_docked: pipelineStudioDocked,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save settings');
    }
  };

  const OPENAI_MODELS = [
    'gpt-4.1-mini',
    'gpt-4.1',
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-5-mini',
    'gpt-5.1',
    'gpt-5.2',
  ];

  const POPULAR_OPENROUTER_MODELS = [
    'inclusionai/ling-3.0-flash-vl:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'deepseek/deepseek-r1:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'mistralai/mistral-small-24b-instruct-2501:free',
    'openai/gpt-4o-mini',
    'Custom (enter below)',
  ];

  const LM_STUDIO_PRESETS = [
    'inclusionai/ling-3.0-flash-vl:free',
    'qwen/qwen3-vl-8b',
    'Custom (enter below)',
  ];

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        padding: '24px 32px 48px',
        backgroundColor: '#f8fafc',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          position: 'sticky',
          top: 0,
          backgroundColor: '#f8fafc',
          paddingTop: 8,
          paddingBottom: 16,
          zIndex: 10,
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
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
              <SettingsIcon size={18} color="#2563eb" />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              System & Workspace Configuration
            </h1>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Full Streamlit-parity settings: LLM providers, supervisor behaviors, pipeline persistence, caching, and projects.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saveError && (
            <span style={{ fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={14} /> {saveError}
            </span>
          )}

          <button
            onClick={handleSave}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: saved ? '#10b981' : '#2563eb',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 18px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            {saved ? <Check size={16} /> : <Save size={16} />}
            <span>{saved ? 'Settings Saved' : 'Save All Changes'}</span>
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 880, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ============================================================ */}
        {/* CARD 1: PIPELINE STUDIO PROJECTS */}
        {/* ============================================================ */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            onClick={() => toggleCard('projects')}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              backgroundColor: '#ffffff',
              borderBottom: expandedCards.projects ? '1px solid #f1f5f9' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FolderKanban size={18} color="#2563eb" />
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Pipeline Studio Projects
                </h2>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                  Save, search, restore, and rehydrate pipeline session workspaces from disk.
                </p>
              </div>
            </div>
            {expandedCards.projects ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} />}
          </div>

          {expandedCards.projects && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {projectNotice && (
                <div
                  style={{
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: '#1e40af',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{projectNotice}</span>
                  <button
                    onClick={() => setProjectNotice(null)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => {
                      setShowArchived(e.target.checked);
                      listProjects(e.target.checked, projectSearch).then(setProjects);
                    }}
                  />
                  <span>Show archived projects</span>
                </label>

                <button
                  onClick={handleRefreshProjects}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: '#475569',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    padding: '4px 10px',
                    borderRadius: 5,
                    cursor: 'pointer',
                    marginLeft: 'auto',
                  }}
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Search projects
                </label>
                <input
                  type="text"
                  placeholder="Filter saved projects by name or folder..."
                  value={projectSearch}
                  onChange={(e) => {
                    setProjectSearch(e.target.value);
                    listProjects(showArchived, e.target.value).then(setProjects);
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    backgroundColor: '#ffffff',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Saved projects
                </label>
                <select
                  value={selectedProjectDir}
                  onChange={(e) => setSelectedProjectDir(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                  }}
                >
                  <option value="">Select a project…</option>
                  {projects.map((p) => {
                    const dt = p.saved_ts ? new Date(p.saved_ts * 1000).toLocaleString() : 'unknown';
                    return (
                      <option key={p.dir_name} value={p.dir_name}>
                        {p.name || p.dir_name} · {p.datasets_total} datasets · {p.data_mode} · {dt}
                      </option>
                    );
                  })}
                </select>
                {projects.length === 0 && (
                  <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>
                    No saved projects found in `pipeline_store/pipeline_projects/`.
                  </span>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={projectRehydrate}
                  onChange={(e) => setProjectRehydrate(e.target.checked)}
                />
                <span>Rehydrate (best-effort)</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  — Attempts to reload sources and rerun stored transforms when a project is metadata-only.
                </span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
                <button
                  onClick={() => handleLoadProject(false)}
                  disabled={!selectedProjectDir}
                  style={{
                    backgroundColor: selectedProjectDir ? '#2563eb' : '#cbd5e1',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '7px 16px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: selectedProjectDir ? 'pointer' : 'not-allowed',
                  }}
                >
                  Load
                </button>

                <button
                  onClick={() => handleLoadProject(true)}
                  disabled={!selectedProjectDir}
                  style={{
                    backgroundColor: selectedProjectDir ? '#0f172a' : '#cbd5e1',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '7px 16px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: selectedProjectDir ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <ExternalLink size={14} /> Load + Open Studio
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* CARD 2: LLM PROVIDER & CREDENTIALS */}
        {/* ============================================================ */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            onClick={() => toggleCard('llm')}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              backgroundColor: '#ffffff',
              borderBottom: expandedCards.llm ? '1px solid #f1f5f9' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Cpu size={18} color="#2563eb" />
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  LLM Provider & Credentials
                </h2>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                  Select OpenAI, OpenRouter (gateway), LM Studio (local OpenAI-compatible), or Ollama.
                </p>
              </div>
            </div>
            {expandedCards.llm ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} />}
          </div>

          {expandedCards.llm && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Provider Selection */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Active Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value);
                    setConnStatus(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                  }}
                >
                  <option value="OpenAI">OpenAI (Cloud)</option>
                  <option value="OpenRouter">OpenRouter (Cloud API Gateway)</option>
                  <option value="LM Studio">LM Studio (Local http://127.0.0.1:1234)</option>
                  <option value="Ollama">Ollama (Local http://localhost:11434)</option>
                </select>
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                  {provider === 'OpenAI' && 'Connects to OpenAI API. Requires OPENAI_API_KEY.'}
                  {provider === 'OpenRouter' && 'Powered by OpenRouter.ai with access to open source & proprietary models.'}
                  {provider === 'LM Studio' && 'Connects to locally hosted LM Studio via OpenAI-compatible API.'}
                  {provider === 'Ollama' && 'Connects to locally running Ollama instance.'}
                </span>
              </div>

              {/* OpenAI Settings */}
              {provider === 'OpenAI' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                      OpenAI API Key
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showOpenaiKey ? 'text' : 'password'}
                        placeholder={config?.has_openai_key ? '•••••••••••••••• (Key is configured)' : 'sk-...'}
                        value={openaiKey}
                        onChange={(e) => setOpenaiKey(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 40px 8px 12px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          fontSize: 12,
                          backgroundColor: '#ffffff',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                        }}
                      >
                        {showOpenaiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                      Model
                    </label>
                    <select
                      value={openaiModel}
                      onChange={(e) => setOpenaiModel(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: 12,
                        backgroundColor: '#ffffff',
                      }}
                    >
                      {OPENAI_MODELS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* OpenRouter Settings */}
              {provider === 'OpenRouter' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                      OpenRouter API Key
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showOpenrouterKey ? 'text' : 'password'}
                        placeholder={config?.has_openrouter_key ? '•••••••••••••••• (Key is configured)' : 'sk-or-...'}
                        value={openrouterKey}
                        onChange={(e) => setOpenrouterKey(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 40px 8px 12px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          fontSize: 12,
                          backgroundColor: '#ffffff',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenrouterKey(!showOpenrouterKey)}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                        }}
                      >
                        {showOpenrouterKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                      Model selection
                    </label>
                    <select
                      value={openrouterModelOption}
                      onChange={(e) => setOpenrouterModelOption(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: 12,
                        backgroundColor: '#ffffff',
                      }}
                    >
                      {POPULAR_OPENROUTER_MODELS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  {openrouterModelOption === 'Custom (enter below)' && (
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                        OpenRouter model name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. anthropic/claude-3.5-sonnet or mistralai/mistral-large"
                        value={openrouterCustomModel}
                        onChange={(e) => setOpenrouterCustomModel(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          fontSize: 12,
                          backgroundColor: '#ffffff',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* LM Studio Settings */}
              {provider === 'LM Studio' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                      LM Studio base URL
                    </label>
                    <input
                      type="text"
                      value={lmBaseUrl}
                      onChange={(e) => setLmBaseUrl(e.target.value)}
                      placeholder="http://127.0.0.1:1234/v1"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: 12,
                        backgroundColor: '#ffffff',
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>
                      Usually `http://127.0.0.1:1234/v1`. Start local server in LM Studio first.
                    </span>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                      LM Studio model
                    </label>
                    <select
                      value={lmModelOption}
                      onChange={(e) => setLmModelOption(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: 12,
                        backgroundColor: '#ffffff',
                      }}
                    >
                      {LM_STUDIO_PRESETS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  {lmModelOption === 'Custom (enter below)' && (
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                        LM Studio custom model identifier
                      </label>
                      <input
                        type="text"
                        value={lmCustomModel}
                        onChange={(e) => setLmCustomModel(e.target.value)}
                        placeholder="e.g. qwen/qwen3-vl-8b"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          fontSize: 12,
                          backgroundColor: '#ffffff',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Ollama Settings */}
              {provider === 'Ollama' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                      Ollama base URL
                    </label>
                    <input
                      type="text"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      placeholder="http://localhost:11434"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: 12,
                        backgroundColor: '#ffffff',
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>
                      Usually `http://localhost:11434`. Start with `ollama serve`.
                    </span>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                      Ollama model
                    </label>
                    <input
                      type="text"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      placeholder="llama3.1:8b"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: 12,
                        backgroundColor: '#ffffff',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Check Connection Button & Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={handleCheckConnection}
                  disabled={connTesting}
                  style={{
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '7px 14px',
                    borderRadius: 6,
                    cursor: connTesting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <RefreshCw size={13} className={connTesting ? 'spin' : ''} />
                  Check {provider} connection
                </button>

                {connStatus && (
                  <span
                    style={{
                      fontSize: 12,
                      color: connStatus.status === 'ok' ? '#16a34a' : '#dc2626',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {connStatus.status === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
                    {connStatus.message}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* CARD 3: AGENT & SUPERVISORY BEHAVIORS */}
        {/* ============================================================ */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            onClick={() => toggleCard('agent')}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              backgroundColor: '#ffffff',
              borderBottom: expandedCards.agent ? '1px solid #f1f5f9' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sliders size={18} color="#2563eb" />
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Agent & Supervisory Settings
                </h2>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                  Control supervisor recursion limits, conversational memory, proactive workflow execution, and intent parsing.
                </p>
              </div>
            </div>
            {expandedCards.agent ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} />}
          </div>

          {expandedCards.agent && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                    Recursion limit
                  </label>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
                    {recursionLimit} iterations
                  </span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="20"
                  step="1"
                  value={recursionLimit}
                  onChange={(e) => setRecursionLimit(parseInt(e.target.value, 10))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
                  <span>4 (Conservative)</span>
                  <span>10 (Default)</span>
                  <span>20 (Deep multi-agent)</span>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={memory}
                  onChange={(e) => setMemory(e.target.checked)}
                />
                <span style={{ fontWeight: 600 }}>Enable short-term memory</span>
              </label>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={proactiveWorkflowMode}
                    onChange={(e) => setProactiveWorkflowMode(e.target.checked)}
                  />
                  <span style={{ fontWeight: 600 }}>Proactive workflow mode</span>
                </label>
                <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0 24px' }}>
                  When enabled, the supervisor may propose and run a multi-step end-to-end workflow for broad requests (and will ask clarifying questions when needed).
                </p>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={useLlmIntentParser}
                    onChange={(e) => setUseLlmIntentParser(e.target.checked)}
                  />
                  <span style={{ fontWeight: 600 }}>LLM intent parsing</span>
                </label>
                <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0 24px' }}>
                  When enabled, the supervisor uses a lightweight LLM call to classify user intent for routing. Can improve ambiguous requests, but adds latency/cost.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* CARD 4: DATA OPTIONS */}
        {/* ============================================================ */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            onClick={() => toggleCard('data')}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              backgroundColor: '#ffffff',
              borderBottom: expandedCards.data ? '1px solid #f1f5f9' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Database size={18} color="#2563eb" />
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Data Options
                </h2>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                  Configure table preview sampling and active dataset selection override.
                </p>
              </div>
            </div>
            {expandedCards.data ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} />}
          </div>

          {expandedCards.data && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Preview rows
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={previewRows}
                  onChange={(e) => setPreviewRows(parseInt(e.target.value, 10) || 5)}
                  style={{
                    width: '120px',
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    backgroundColor: '#ffffff',
                  }}
                />
                <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 12 }}>
                  Default preview rows shown in chat responses (1 to 20).
                </span>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Active dataset (override)
                </label>
                <select
                  value={activeDatasetOverride}
                  onChange={(e) => setActiveDatasetOverride(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                  }}
                >
                  <option value="">Auto (use supervisor active)</option>
                  {availableDatasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.stage}: {d.label} ({d.records} x {d.features}) [{d.id}]
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                  Overrides which dataset is considered active for downstream steps (EDA/viz/wrangle/clean). For merges, use Pipeline Studio.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* CARD 5: PIPELINE BEHAVIORS & CACHING */}
        {/* ============================================================ */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            onClick={() => toggleCard('pipeline')}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              backgroundColor: '#ffffff',
              borderBottom: expandedCards.pipeline ? '1px solid #f1f5f9' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Layers size={18} color="#2563eb" />
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Pipeline Options & Behaviors
                </h2>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                  Directory persistence, auto-save settings, node preservation on AI runs, and dataset disk caching.
                </p>
              </div>
            </div>
            {expandedCards.pipeline ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} />}
          </div>

          {expandedCards.pipeline && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Persist pipeline directory (optional)
                </label>
                <input
                  type="text"
                  value={pipelinePersistDir}
                  onChange={(e) => setPipelinePersistDir(e.target.value)}
                  placeholder="e.g. pipeline_reports/pipelines"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    backgroundColor: '#ffffff',
                  }}
                />
                <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>
                  When enabled, writes `pipeline_spec.json` and reproducible pipeline scripts to this folder for reproducibility.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={pipelinePersistEnabled}
                    onChange={(e) => setPipelinePersistEnabled(e.target.checked)}
                  />
                  <span>Auto-save pipeline files</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={pipelinePersistOverwrite}
                    onChange={(e) => setPipelinePersistOverwrite(e.target.checked)}
                  />
                  <span>Overwrite existing pipeline files</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={pipelinePersistIncludeSql}
                    onChange={(e) => setPipelinePersistIncludeSql(e.target.checked)}
                  />
                  <span>Also save SQL artifacts</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={pipelinePreserveAllNodes}
                    onChange={(e) => setPipelinePreserveAllNodes(e.target.checked)}
                  />
                  <span>Preserve all nodes on AI runs</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={pipelinePreserveStudioNodes}
                    onChange={(e) => setPipelinePreserveStudioNodes(e.target.checked)}
                  />
                  <span>Preserve Studio nodes on AI runs</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={pipelineDatasetPersistEnabled}
                    onChange={(e) => setPipelineDatasetPersistEnabled(e.target.checked)}
                  />
                  <span>Persist pipeline nodes to disk</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    disabled={!pipelineDatasetPersistEnabled}
                    checked={pipelineDatasetRestoreEnabled}
                    onChange={(e) => setPipelineDatasetRestoreEnabled(e.target.checked)}
                  />
                  <span>Restore pipeline nodes on start</span>
                </label>
              </div>

              {/* Cache Format & Quotas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, paddingTop: 6 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Dataset cache format
                  </label>
                  <select
                    disabled={!pipelineDatasetPersistEnabled}
                    value={pipelineDatasetCacheFormat}
                    onChange={(e) => setPipelineDatasetCacheFormat(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 12,
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <option value="parquet">parquet (compact)</option>
                    <option value="pickle">pickle (faster)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Dataset cache max items
                  </label>
                  <input
                    type="number"
                    disabled={!pipelineDatasetPersistEnabled}
                    min="0"
                    value={pipelineDatasetCacheMaxItems}
                    onChange={(e) => setPipelineDatasetCacheMaxItems(parseInt(e.target.value, 10) || 0)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 12,
                      backgroundColor: '#ffffff',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Dataset cache max size (MB)
                  </label>
                  <input
                    type="number"
                    disabled={!pipelineDatasetPersistEnabled}
                    min="0"
                    step="50"
                    value={pipelineDatasetCacheMaxMb}
                    onChange={(e) => setPipelineDatasetCacheMaxMb(parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 12,
                      backgroundColor: '#ffffff',
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* CARD 6: CHAT ↔ PIPELINE CONTEXT */}
        {/* ============================================================ */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            onClick={() => toggleCard('chat_context')}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              backgroundColor: '#ffffff',
              borderBottom: expandedCards.chat_context ? '1px solid #f1f5f9' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MessageSquare size={18} color="#2563eb" />
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Chat ↔ Pipeline Context
                </h2>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                  Configure synchronization between interactive chat agents and Pipeline Studio graphical canvas.
                </p>
              </div>
            </div>
            {expandedCards.chat_context ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} />}
          </div>

          {expandedCards.chat_context && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={pipelineChatContextEnabled}
                  onChange={(e) => setPipelineChatContextEnabled(e.target.checked)}
                />
                <span style={{ fontWeight: 600 }}>Include Pipeline Studio context in chat</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  — When enabled, current Pipeline Studio selection is appended to chat prompt.
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={pipelineChatContextIncludeCode}
                  onChange={(e) => setPipelineChatContextIncludeCode(e.target.checked)}
                />
                <span style={{ fontWeight: 600 }}>Include selected node code snippet</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  — Includes a trimmed code snippet for the selected node in the chat context block.
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={pipelineUseSelectedNodeForChat}
                  onChange={(e) => setPipelineUseSelectedNodeForChat(e.target.checked)}
                />
                <span style={{ fontWeight: 600 }}>Use selected Pipeline Studio node for chat</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  — Chat/AI uses the currently selected Pipeline Studio node as the active dataset.
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={pipelineSyncStateToAgents}
                  onChange={(e) => setPipelineSyncStateToAgents(e.target.checked)}
                />
                <span style={{ fontWeight: 600 }}>Sync Pipeline Studio state to AI</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  — Keeps agent dataset registry aligned with Pipeline Studio (recommended to preserve manual steps).
                </span>
              </label>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* CARD 7: SQL OPTIONS */}
        {/* ============================================================ */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            onClick={() => toggleCard('sql')}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              backgroundColor: '#ffffff',
              borderBottom: expandedCards.sql ? '1px solid #f1f5f9' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Terminal size={18} color="#2563eb" />
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  SQL Connection Options
                </h2>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                  Specify SQLAlchemy connection URL for SQLDatabaseAgent and relational database queries.
                </p>
              </div>
            </div>
            {expandedCards.sql ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} />}
          </div>

          {expandedCards.sql && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                  SQLAlchemy URL (optional)
                </label>
                <input
                  type="text"
                  value={sqlUrl}
                  onChange={(e) => setSqlUrl(e.target.value)}
                  placeholder="sqlite:///data/northwind.db or postgresql://..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    backgroundColor: '#ffffff',
                  }}
                />
                <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>
                  Tip: you can also type in chat `connect to data/northwind.db` or paste a full SQLAlchemy URL.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* CARD 8: MLFLOW OPTIONS */}
        {/* ============================================================ */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            onClick={() => toggleCard('mlflow')}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              backgroundColor: '#ffffff',
              borderBottom: expandedCards.mlflow ? '1px solid #f1f5f9' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Activity size={18} color="#2563eb" />
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  MLflow Experiment Tracking
                </h2>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                  Configure MLflow tracking server, local SQLite database URI, and artifact store locations.
                </p>
              </div>
            </div>
            {expandedCards.mlflow ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} />}
          </div>

          {expandedCards.mlflow && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableMlflowLogging}
                  onChange={(e) => setEnableMlflowLogging(e.target.checked)}
                />
                <span style={{ fontWeight: 600 }}>Enable MLflow logging in training</span>
              </label>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                  MLflow tracking URI
                </label>
                <input
                  type="text"
                  value={mlflowTrackingUri}
                  onChange={(e) => setMlflowTrackingUri(e.target.value)}
                  placeholder="sqlite:///mlflow.db"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    backgroundColor: '#ffffff',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                  MLflow artifact root (local path)
                </label>
                <input
                  type="text"
                  value={mlflowArtifactRoot}
                  onChange={(e) => setMlflowArtifactRoot(e.target.value)}
                  placeholder="mlflow_artifacts"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    backgroundColor: '#ffffff',
                  }}
                />
                <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>
                  Where MLflow stores artifacts (models, tables, plots) when creating new experiments.
                </span>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                  MLflow experiment name
                </label>
                <input
                  type="text"
                  value={mlflowExperimentName}
                  onChange={(e) => setMlflowExperimentName(e.target.value)}
                  placeholder="H2O AutoML"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    backgroundColor: '#ffffff',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* CARD 9: DEBUG OPTIONS & ACTIONS */}
        {/* ============================================================ */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            onClick={() => toggleCard('debug')}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              backgroundColor: '#ffffff',
              borderBottom: expandedCards.debug ? '1px solid #f1f5f9' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Terminal size={18} color="#2563eb" />
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Debug Options & Session Actions
                </h2>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                  Verbose logging toggles, live execution logs, Pipeline Studio docking, and reset chat actions.
                </p>
              </div>
            </div>
            {expandedCards.debug ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} />}
          </div>

          {expandedCards.debug && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={debugMode}
                    onChange={(e) => setDebugMode(e.target.checked)}
                  />
                  <span style={{ fontWeight: 600 }}>Verbose console logs</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    — Print extra debug info to the terminal to troubleshoot DB connect and multi-file loads.
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showProgress}
                    onChange={(e) => setShowProgress(e.target.checked)}
                  />
                  <span style={{ fontWeight: 600 }}>Show progress in chat</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    — Shows which agent is running while the team works.
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showLiveLogs}
                    onChange={(e) => setShowLiveLogs(e.target.checked)}
                  />
                  <span style={{ fontWeight: 600 }}>Show live logs while running</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    — Streams console output into the app during execution.
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={pipelineStudioDocked}
                    onChange={(e) => setPipelineStudioDocked(e.target.checked)}
                  />
                  <span style={{ fontWeight: 600 }}>Dock Pipeline Studio (inline)</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    — Docked mode keeps Studio inline; undocked opens dedicated full canvas.
                  </span>
                </label>
              </div>

              <div
                style={{
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>
                    Clear Chat & Session Memory
                  </h4>
                  <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                    Resets conversation history, creates a new agent thread ID, and clears working memory.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleClearChat}
                  style={{
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    border: '1px solid #fca5a5',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '7px 14px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Trash2 size={13} /> Clear Chat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
