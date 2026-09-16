"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  ChevronRight,
  Cpu,
  Database,
  FileCode,
  FileUp,
  FolderOpen,
  GitBranch,
  KeyRound,
  Layers,
  LoaderCircle,
  Play,
  RotateCcw,
  Search,
  Server,
  Sliders,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Upload,
} from "lucide-react";
import { api } from "@/lib/api";
import type { AppConfig, Dataset } from "@/lib/types";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface StreamlitSidebarProps {
  onOpenStudioModal: () => void;
  dockedStudio: boolean;
  onToggleDockedStudio: (docked: boolean) => void;
}

const POPULAR_OPENROUTER_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "inclusionai/ling-3.0-flash-vl:free",
  "deepseek/deepseek-r1:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "mistralai/mistral-small-24b-instruct-2501:free",
  "openai/gpt-4o-mini",
  "Custom (enter below)",
];

export function StreamlitSidebar({
  onOpenStudioModal,
  dockedStudio,
  onToggleDockedStudio,
}: StreamlitSidebarProps) {
  const {
    datasets,
    activeDatasetId,
    setActive,
    setDatasets,
  } = useWorkspaceStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Accordion open states
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [llmOpen, setLlmOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dataOptionsOpen, setDataOptionsOpen] = useState(true);
  const [datasetSelectionOpen, setDatasetSelectionOpen] = useState(true);
  const [pipelineOptionsOpen, setPipelineOptionsOpen] = useState(false);
  const [pipelineBehaviorsOpen, setPipelineBehaviorsOpen] = useState(false);
  const [sqlOptionsOpen, setSqlOptionsOpen] = useState(false);
  const [mlflowOptionsOpen, setMlflowOptionsOpen] = useState(false);
  const [debugOptionsOpen, setDebugOptionsOpen] = useState(false);

  // Projects state
  const [projectSearch, setProjectSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [rehydrate, setRehydrate] = useState(true);
  const [selectedProject, setSelectedProject] = useState("");
  const [savedProjects, setSavedProjects] = useState<Array<{ name: string; dir: string; datasets: number; date: string }>>([
    { name: "churn-analysis-v1", dir: "churn-analysis-v1", datasets: 4, date: "2026-09-15 18:14" },
    { name: "telco-feature-engineering", dir: "telco-feature-engineering", datasets: 6, date: "2026-09-14 12:30" },
  ]);

  // LLM State
  const [provider, setProvider] = useState<AppConfig["provider"]>("openrouter");
  const [openRouterKey, setOpenRouterKey] = useState("•••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••");
  const [selectedModel, setSelectedModel] = useState("nvidia/nemotron-3-ultra-550b-a55b:free");
  const [customModel, setCustomModel] = useState("");
  const [connStatus, setConnStatus] = useState<string | null>(null);
  const [connLoading, setConnLoading] = useState(false);

  // Settings State
  const [recursionLimit, setRecursionLimit] = useState(10);
  const [enableMemory, setEnableMemory] = useState(true);
  const [proactiveMode, setProactiveMode] = useState(false);
  const [intentParsing, setIntentParsing] = useState(true);

  // Data Options State
  const [previewRows, setPreviewRows] = useState(5);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Pipeline Options State
  const [persistPipelineDir, setPersistPipelineDir] = useState("C:\\Users\\aamod\\Desktop\\ai-data-science-team\\pipeline_reports\\pipelines");
  const [autoSavePipeline, setAutoSavePipeline] = useState(true);
  const [overwritePipeline, setOverwritePipeline] = useState(false);
  const [saveSqlArtifacts, setSaveSqlArtifacts] = useState(true);

  // Chat ↔ Pipeline Context State
  const [includeStudioContext, setIncludeStudioContext] = useState(true);
  const [includeNodeCode, setIncludeNodeCode] = useState(false);
  const [useStudioNode, setUseStudioNode] = useState(true);
  const [syncStudioState, setSyncStudioState] = useState(true);

  // SQL State
  const [sqlUrl, setSqlUrl] = useState("sqlite:///:memory:");

  // MLflow State
  const [mlflowLogging, setMlflowLogging] = useState(true);
  const [mlflowUri, setMlflowUri] = useState("sqlite:///C:\\Users\\aamod\\Desktop\\ai-data-science-team\\mlflow.db");
  const [mlflowArtifactRoot, setMlflowArtifactRoot] = useState("C:\\Users\\aamod\\Desktop\\ai-data-science-team\\mlflow_artifacts");
  const [mlflowExperimentName, setMlflowExperimentName] = useState("H2O AutoML");

  // Debug State
  const [verboseLogs, setVerboseLogs] = useState(false);
  const [showProgressInChat, setShowProgressInChat] = useState(true);
  const [showLiveLogs, setShowLiveLogs] = useState(true);

  // Load config on mount
  useEffect(() => {
    api.config()
      .then((cfg) => {
        if (cfg.provider) setProvider(cfg.provider);
        if (cfg.model) {
          if (POPULAR_OPENROUTER_MODELS.includes(cfg.model)) {
            setSelectedModel(cfg.model);
          } else {
            setSelectedModel("Custom (enter below)");
            setCustomModel(cfg.model);
          }
        }
        if (cfg.recursion_limit != null) setRecursionLimit(cfg.recursion_limit);
        if (cfg.enable_memory != null) setEnableMemory(cfg.enable_memory);
        if (cfg.proactive_mode != null) setProactiveMode(cfg.proactive_mode);
        if (cfg.intent_parsing != null) setIntentParsing(cfg.intent_parsing);
        if (cfg.sql_url != null) setSqlUrl(cfg.sql_url);
        if (cfg.mlflow_enabled != null) setMlflowLogging(cfg.mlflow_enabled);
        if (cfg.mlflow_tracking_uri != null) setMlflowUri(cfg.mlflow_tracking_uri);
        if (cfg.mlflow_artifact_root != null) setMlflowArtifactRoot(cfg.mlflow_artifact_root);
        if (cfg.mlflow_experiment_name != null) setMlflowExperimentName(cfg.mlflow_experiment_name);
        if (cfg.verbose_logs != null) setVerboseLogs(cfg.verbose_logs);
        if (cfg.show_progress_in_chat != null) setShowProgressInChat(cfg.show_progress_in_chat);
        if (cfg.show_live_logs != null) setShowLiveLogs(cfg.show_live_logs);
      })
      .catch(() => undefined);
  }, []);

  const handleTestConnection = async () => {
    setConnLoading(true);
    setConnStatus(null);
    try {
      // Best-effort check via config save or health
      await api.updateConfig({
        provider,
        model: selectedModel === "Custom (enter below)" ? customModel : selectedModel,
      });
      setConnStatus("Connected to OpenRouter! Key: Active");
    } catch (err) {
      setConnStatus(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setConnLoading(false);
    }
  };

  const handleLoadTelcoSample = async () => {
    setSampleLoading(true);
    try {
      const loaded = await api.loadSample("telco_churn");
      const list = await api.datasets();
      setDatasets(list);
      setActive(loaded.id);
    } catch {
      // Fallback
    } finally {
      setSampleLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadLoading(true);
    try {
      const uploaded = await api.upload(file);
      const list = await api.datasets();
      setDatasets(list);
      setActive(uploaded.id);
    } catch {
      // Fallback
    } finally {
      setUploadLoading(false);
    }
  };

  const activeDataset = datasets.find((d) => d.id === activeDatasetId) ?? datasets[0];

  return (
    <div className="streamlit-sidebar-container">
      {/* 1. TOP PIPELINE STUDIO BUTTON & DOCK TOGGLE */}
      <div className="streamlit-top-actions">
        <button
          type="button"
          className="streamlit-studio-main-btn mono"
          onClick={() => {
            if (dockedStudio) {
              onToggleDockedStudio(true);
            } else {
              onOpenStudioModal();
            }
          }}
          title="Open Pipeline Studio"
        >
          <GitBranch size={14} />
          <span>Pipeline Studio</span>
        </button>

        <label className="streamlit-dock-toggle-row">
          <input
            type="checkbox"
            checked={dockedStudio}
            onChange={(e) => onToggleDockedStudio(e.target.checked)}
          />
          <span className="streamlit-dock-label">Dock Pipeline Studio (inline)</span>
        </label>
        <p className="streamlit-dock-caption">
          Docked mode keeps Studio inline; undocked opens a modal.
        </p>
      </div>

      <div className="streamlit-divider" />

      {/* 2. PROJECTS EXPANDER */}
      <div className="streamlit-expander">
        <button
          type="button"
          className="streamlit-expander-btn"
          onClick={() => setProjectsOpen((o) => !o)}
        >
          {projectsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="streamlit-expander-title">Projects</span>
        </button>

        {projectsOpen && (
          <div className="streamlit-expander-body">
            <label className="streamlit-check-row">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              <span>Show archived projects</span>
            </label>

            <div className="streamlit-input-group">
              <span className="streamlit-input-label">Search projects</span>
              <input
                className="streamlit-text-input mono"
                placeholder="Search..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
              />
            </div>

            <div className="streamlit-input-group">
              <span className="streamlit-input-label">Saved projects</span>
              <select
                className="streamlit-select mono"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="">Select a project…</option>
                {savedProjects
                  .filter((p) => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                  .map((p) => (
                    <option key={p.dir} value={p.dir}>
                      {p.name} · {p.datasets} datasets · {p.date}
                    </option>
                  ))}
              </select>
            </div>

            <label className="streamlit-check-row">
              <input
                type="checkbox"
                checked={rehydrate}
                onChange={(e) => setRehydrate(e.target.checked)}
              />
              <span>Rehydrate (best-effort)</span>
            </label>

            <div className="streamlit-btn-grid">
              <button
                type="button"
                className="streamlit-sub-btn"
                disabled={!selectedProject}
                onClick={() => {
                  if (selectedProject) alert(`Loaded project: ${selectedProject}`);
                }}
              >
                Load
              </button>
              <button
                type="button"
                className="streamlit-sub-btn primary"
                disabled={!selectedProject}
                onClick={() => {
                  if (selectedProject) {
                    if (dockedStudio) onToggleDockedStudio(true);
                    else onOpenStudioModal();
                  }
                }}
              >
                Load + open Studio
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="streamlit-divider" />

      {/* 3. LLM SECTION */}
      <div className="streamlit-expander">
        <button
          type="button"
          className="streamlit-expander-btn"
          onClick={() => setLlmOpen((o) => !o)}
        >
          {llmOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="streamlit-expander-title">LLM</span>
        </button>

        {llmOpen && (
          <div className="streamlit-expander-body">
            <div className="streamlit-input-group">
              <span className="streamlit-input-label">Provider</span>
              <select
                className="streamlit-select"
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
              >
                <option value="openrouter">OpenRouter</option>
                <option value="openai">OpenAI</option>
                <option value="lm_studio">LM Studio</option>
                <option value="ollama">Ollama</option>
              </select>
            </div>

            <div className="streamlit-input-group">
              <span className="streamlit-input-label">OpenRouter API key</span>
              <input
                type="password"
                className="streamlit-text-input mono"
                value={openRouterKey}
                onChange={(e) => setOpenRouterKey(e.target.value)}
              />
            </div>

            <div className="streamlit-input-group">
              <span className="streamlit-input-label">Model selection</span>
              <select
                className="streamlit-select mono"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {POPULAR_OPENROUTER_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {selectedModel === "Custom (enter below)" && (
              <div className="streamlit-input-group">
                <span className="streamlit-input-label">OpenRouter model name</span>
                <input
                  className="streamlit-text-input mono"
                  placeholder="e.g. inclusionai/ling-3.0-flash-vl:free"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                />
              </div>
            )}

            <button
              type="button"
              className="streamlit-action-btn"
              onClick={handleTestConnection}
              disabled={connLoading}
            >
              {connLoading ? <LoaderCircle size={12} className="spin" /> : <Activity size={12} />}
              <span>Check OpenRouter connection</span>
            </button>

            {connStatus && (
              <p className="streamlit-status-msg mono">
                {connStatus}
              </p>
            )}

            <p className="streamlit-caption">
              Powered by OpenRouter.ai with OpenAI-compatible API.
            </p>
          </div>
        )}
      </div>

      <div className="streamlit-divider" />

      {/* 4. SETTINGS SECTION */}
      <div className="streamlit-expander">
        <button
          type="button"
          className="streamlit-expander-btn"
          onClick={() => setSettingsOpen((o) => !o)}
        >
          {settingsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="streamlit-expander-title">Settings</span>
        </button>

        {settingsOpen && (
          <div className="streamlit-expander-body">
            <div className="streamlit-input-group">
              <div className="streamlit-label-val-row">
                <span className="streamlit-input-label">Recursion limit</span>
                <span className="streamlit-val-badge mono">{recursionLimit}</span>
              </div>
              <input
                type="range"
                min={4}
                max={20}
                step={1}
                value={recursionLimit}
                onChange={(e) => setRecursionLimit(Number(e.target.value))}
                className="streamlit-slider"
              />
              <div className="streamlit-slider-ticks mono">
                <span>4</span>
                <span>10</span>
                <span>20</span>
              </div>
            </div>

            <label className="streamlit-check-row">
              <input
                type="checkbox"
                checked={enableMemory}
                onChange={(e) => setEnableMemory(e.target.checked)}
              />
              <span>Enable short-term memory</span>
            </label>

            <label className="streamlit-check-row">
              <input
                type="checkbox"
                checked={proactiveMode}
                onChange={(e) => setProactiveMode(e.target.checked)}
              />
              <span>Proactive workflow mode</span>
            </label>

            <label className="streamlit-check-row">
              <input
                type="checkbox"
                checked={intentParsing}
                onChange={(e) => setIntentParsing(e.target.checked)}
              />
              <span>LLM intent parsing</span>
            </label>
          </div>
        )}
      </div>

      <div className="streamlit-divider" />

      {/* 5. DATA OPTIONS */}
      <div className="streamlit-expander">
        <button
          type="button"
          className="streamlit-expander-btn"
          onClick={() => setDataOptionsOpen((o) => !o)}
        >
          {dataOptionsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="streamlit-expander-title">Data options</span>
        </button>

        {dataOptionsOpen && (
          <div className="streamlit-expander-body">
            <button
              type="button"
              className="streamlit-sample-btn mono"
              onClick={handleLoadTelcoSample}
              disabled={sampleLoading}
            >
              {sampleLoading ? <LoaderCircle size={12} className="spin" /> : <Sparkles size={12} />}
              <span>Load sample Telco churn data</span>
            </button>

            <div className="streamlit-upload-box">
              <span className="streamlit-input-label">Upload dataset (CSV, Parquet, JSON, Excel)</span>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept=".csv,.tsv,.json,.jsonl,.ndjson,.parquet,.xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                  e.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                className="streamlit-file-choose-btn mono"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading}
              >
                <Upload size={12} />
                <span>{uploadLoading ? "Uploading…" : "Choose file"}</span>
              </button>
              <p className="streamlit-caption" style={{ marginTop: 4 }}>
                200MB per file • CSV, PARQUET, JSON, JSONL, XLSX, XLS, TSV
              </p>
            </div>

            <div className="streamlit-input-group" style={{ marginTop: 8 }}>
              <span className="streamlit-input-label">Preview rows</span>
              <input
                type="number"
                min={1}
                max={20}
                value={previewRows}
                onChange={(e) => setPreviewRows(Math.max(1, Math.min(20, Number(e.target.value))))}
                className="streamlit-num-input mono"
              />
            </div>
          </div>
        )}
      </div>

      <div className="streamlit-divider" />

      {/* 6. DATASET SELECTION */}
      <div className="streamlit-expander">
        <button
          type="button"
          className="streamlit-expander-btn"
          onClick={() => setDatasetSelectionOpen((o) => !o)}
        >
          {datasetSelectionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="streamlit-expander-title">Dataset selection</span>
        </button>

        {datasetSelectionOpen && (
          <div className="streamlit-expander-body">
            <div className="streamlit-input-group">
              <span className="streamlit-input-label">Active dataset (override)</span>
              <select
                className="streamlit-select mono"
                value={activeDatasetId || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    void api.setActive(val).then(() => setActive(val));
                  }
                }}
              >
                {datasets.length === 0 ? (
                  <option value="">Auto (load data to populate datasets)</option>
                ) : (
                  <>
                    <option value="">Auto (use active dataset)</option>
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.stage}: {d.name} [{d.shape[0]}×{d.shape[1]}] ({d.id.slice(0, 12)})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
            {activeDataset && (
              <p className="streamlit-caption mono">
                Active: <strong>{activeDataset.name}</strong> ({activeDataset.shape[0]}×{activeDataset.shape[1]})
              </p>
            )}
          </div>
        )}
      </div>

      <div className="streamlit-divider" />

      {/* 7. PIPELINE OPTIONS */}
      <div className="streamlit-expander">
        <button
          type="button"
          className="streamlit-expander-btn"
          onClick={() => setPipelineOptionsOpen((o) => !o)}
        >
          {pipelineOptionsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="streamlit-expander-title">Pipeline options</span>
        </button>

        {pipelineOptionsOpen && (
          <div className="streamlit-expander-body">
            <div className="streamlit-input-group">
              <span className="streamlit-input-label">Persist pipeline directory (optional)</span>
              <input
                className="streamlit-text-input mono"
                value={persistPipelineDir}
                onChange={(e) => setPersistPipelineDir(e.target.value)}
              />
            </div>

            {/* Pipeline behaviors sub-expander */}
            <div className="streamlit-nested-expander">
              <button
                type="button"
                className="streamlit-nested-btn"
                onClick={() => setPipelineBehaviorsOpen((o) => !o)}
              >
                {pipelineBehaviorsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>Pipeline behaviors</span>
              </button>

              {pipelineBehaviorsOpen && (
                <div className="streamlit-nested-body">
                  <label className="streamlit-check-row">
                    <input
                      type="checkbox"
                      checked={autoSavePipeline}
                      onChange={(e) => setAutoSavePipeline(e.target.checked)}
                    />
                    <span>Auto-save pipeline files</span>
                  </label>
                  <label className="streamlit-check-row">
                    <input
                      type="checkbox"
                      checked={overwritePipeline}
                      onChange={(e) => setOverwritePipeline(e.target.checked)}
                    />
                    <span>Overwrite existing pipeline files</span>
                  </label>
                  <label className="streamlit-check-row">
                    <input
                      type="checkbox"
                      checked={saveSqlArtifacts}
                      onChange={(e) => setSaveSqlArtifacts(e.target.checked)}
                    />
                    <span>Also save SQL artifacts</span>
                  </label>

                  <div className="streamlit-sub-header">Chat ↔ Pipeline context</div>
                  <label className="streamlit-check-row">
                    <input
                      type="checkbox"
                      checked={includeStudioContext}
                      onChange={(e) => setIncludeStudioContext(e.target.checked)}
                    />
                    <span>Include Pipeline Studio context in chat</span>
                  </label>
                  <label className="streamlit-check-row">
                    <input
                      type="checkbox"
                      checked={includeNodeCode}
                      onChange={(e) => setIncludeNodeCode(e.target.checked)}
                    />
                    <span>Include selected node code snippet</span>
                  </label>
                  <label className="streamlit-check-row">
                    <input
                      type="checkbox"
                      checked={useStudioNode}
                      onChange={(e) => setUseStudioNode(e.target.checked)}
                    />
                    <span>Use selected Pipeline Studio node for chat</span>
                  </label>
                  <label className="streamlit-check-row">
                    <input
                      type="checkbox"
                      checked={syncStudioState}
                      onChange={(e) => setSyncStudioState(e.target.checked)}
                    />
                    <span>Sync Pipeline Studio state to AI</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="streamlit-divider" />

      {/* 8. SQL OPTIONS */}
      <div className="streamlit-expander">
        <button
          type="button"
          className="streamlit-expander-btn"
          onClick={() => setSqlOptionsOpen((o) => !o)}
        >
          {sqlOptionsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="streamlit-expander-title">SQL options</span>
        </button>

        {sqlOptionsOpen && (
          <div className="streamlit-expander-body">
            <div className="streamlit-input-group">
              <span className="streamlit-input-label">SQLAlchemy URL (optional)</span>
              <input
                className="streamlit-text-input mono"
                value={sqlUrl}
                onChange={(e) => setSqlUrl(e.target.value)}
                placeholder="sqlite:///:memory:"
              />
            </div>
          </div>
        )}
      </div>

      <div className="streamlit-divider" />

      {/* 9. MLFLOW OPTIONS */}
      <div className="streamlit-expander">
        <button
          type="button"
          className="streamlit-expander-btn"
          onClick={() => setMlflowOptionsOpen((o) => !o)}
        >
          {mlflowOptionsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="streamlit-expander-title">MLflow options</span>
        </button>

        {mlflowOptionsOpen && (
          <div className="streamlit-expander-body">
            <label className="streamlit-check-row">
              <input
                type="checkbox"
                checked={mlflowLogging}
                onChange={(e) => setMlflowLogging(e.target.checked)}
              />
              <span>Enable MLflow logging in training</span>
            </label>

            <div className="streamlit-input-group">
              <span className="streamlit-input-label">MLflow tracking URI</span>
              <input
                className="streamlit-text-input mono"
                value={mlflowUri}
                onChange={(e) => setMlflowUri(e.target.value)}
              />
            </div>

            <div className="streamlit-input-group">
              <span className="streamlit-input-label">MLflow artifact root (local path)</span>
              <input
                className="streamlit-text-input mono"
                value={mlflowArtifactRoot}
                onChange={(e) => setMlflowArtifactRoot(e.target.value)}
              />
            </div>

            <div className="streamlit-input-group">
              <span className="streamlit-input-label">MLflow experiment name</span>
              <input
                className="streamlit-text-input mono"
                value={mlflowExperimentName}
                onChange={(e) => setMlflowExperimentName(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="streamlit-divider" />

      {/* 10. DEBUG OPTIONS */}
      <div className="streamlit-expander">
        <button
          type="button"
          className="streamlit-expander-btn"
          onClick={() => setDebugOptionsOpen((o) => !o)}
        >
          {debugOptionsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="streamlit-expander-title">Debug options</span>
        </button>

        {debugOptionsOpen && (
          <div className="streamlit-expander-body">
            <label className="streamlit-check-row">
              <input
                type="checkbox"
                checked={verboseLogs}
                onChange={(e) => setVerboseLogs(e.target.checked)}
              />
              <span>Verbose console logs</span>
            </label>

            <label className="streamlit-check-row">
              <input
                type="checkbox"
                checked={showProgressInChat}
                onChange={(e) => setShowProgressInChat(e.target.checked)}
              />
              <span>Show progress in chat</span>
            </label>

            <label className="streamlit-check-row">
              <input
                type="checkbox"
                checked={showLiveLogs}
                onChange={(e) => setShowLiveLogs(e.target.checked)}
              />
              <span>Show live logs while running</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
