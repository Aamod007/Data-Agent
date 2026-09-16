"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Check,
  Cpu,
  Database,
  GitBranch,
  KeyRound,
  Layers,
  LoaderCircle,
  Lock,
  MessageSquare,
  ServerCog,
  Sliders,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import type { AppConfig } from "@/lib/types";

const providerDefaults: Record<AppConfig["provider"], { model: string; base_url: string }> = {
  nvidia: {
    model: "meta/llama-3.2-11b-vision-instruct",
    base_url: "https://integrate.api.nvidia.com/v1",
  },
  ollama: {
    model: "llama3",
    base_url: "http://localhost:11434",
  },
  lm_studio: {
    model: "qwen/qwen3-vl-8b",
    base_url: "http://127.0.0.1:1234/v1",
  },
  openrouter: {
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    base_url: "https://openrouter.ai/api/v1",
  },
  openai: {
    model: "gpt-4o-mini",
    base_url: "",
  },
};

const defaults: AppConfig = {
  provider: "openrouter",
  model: "nvidia/nemotron-3-ultra-550b-a55b:free",
  has_api_key: true,
  base_url: "https://openrouter.ai/api/v1",
  sql_url: "sqlite:///:memory:",
  recursion_limit: 10,
  enable_memory: true,
  proactive_mode: false,
  intent_parsing: true,
  include_studio_context: true,
  include_node_code: false,
  use_studio_node: true,
  sync_studio_state: true,
  mlflow_enabled: false,
  mlflow_tracking_uri: "sqlite:///mlflow.db",
  mlflow_artifact_root: "./mlflow_artifacts",
  mlflow_experiment_name: "H2O AutoML",
  verbose_logs: false,
  show_progress_in_chat: true,
  show_live_logs: true,
};

export default function SettingsPage() {
  const [config, setConfig] = useState<AppConfig>(defaults);
  const [apiKey, setApiKey] = useState("");
  const [persistPipelineDir, setPersistPipelineDir] = useState("C:\\Users\\aamod\\Desktop\\ai-data-science-team\\pipeline_reports\\pipelines");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    api.config()
      .then((cfg) => {
        setConfig((prev) => ({ ...prev, ...cfg }));
        const savedDir = localStorage.getItem("data-agents-pipeline-dir");
        if (savedDir) setPersistPipelineDir(savedDir);
      })
      .catch((cause) =>
        setStatus({
          type: "error",
          message: cause instanceof Error ? cause.message : "Could not connect to the API.",
        })
      )
      .finally(() => setBusy(false));
  }, []);

  const handleProviderChange = (newProvider: AppConfig["provider"]) => {
    const defaultSettings = providerDefaults[newProvider] || providerDefaults.openai;
    setConfig((prev: AppConfig) => ({
      ...prev,
      provider: newProvider,
      model: defaultSettings.model,
      base_url: defaultSettings.base_url,
    }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      localStorage.setItem("data-agents-pipeline-dir", persistPipelineDir);
      const saved = await api.updateConfig({
        ...config,
        ...(apiKey ? { api_key: apiKey } : {}),
      });
      setConfig((prev) => ({ ...prev, ...saved }));
      setApiKey("");
      setStatus({ type: "success", message: "Workspace configuration updated successfully." });
    } catch (cause) {
      setStatus({ type: "error", message: cause instanceof Error ? cause.message : "Could not save configuration." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page settings-page" style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: 60 }}>
      <div className="page-heading">
        <div>
          <p className="eyebrow mono">WORKSPACE CONFIGURATION</p>
          <h1>Settings &amp; Integrations</h1>
          <p className="muted">
            Configure LLM providers, pipeline context behaviors, agent execution parameters, SQL engines, and MLflow tracking.
          </p>
        </div>
      </div>

      <form className="settings-form" onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* 1. LLM PROVIDER & MODEL */}
        <div className="card">
          <div className="card-header">
            <h2>
              <Cpu size={14} style={{ color: "var(--primary, #3b82f6)", display: "inline", marginRight: 8 }} />
              LLM Provider &amp; Model Selection
            </h2>
            <span className={`badge ${config.has_api_key ? "badge-cleaned" : "badge-wrangled"}`}>
              <Lock size={11} aria-hidden="true" />
              {config.has_api_key ? "API KEY CONFIGURED" : "KEY REQUIRED"}
            </span>
          </div>

          <div className="settings-grid">
            <label>
              <span>LLM PROVIDER</span>
              <select
                className="select"
                value={config.provider}
                onChange={(e) => handleProviderChange(e.target.value as AppConfig["provider"])}
              >
                <option value="openrouter">OpenRouter (Multi-model Router)</option>
                <option value="nvidia">NVIDIA NIM (meta/llama-3.2-11b-vision-instruct, etc.)</option>
                <option value="openai">OpenAI (GPT-4o, GPT-4o-mini)</option>
                <option value="ollama">Ollama (Local Models via localhost:11434)</option>
                <option value="lm_studio">LM Studio (Local Server 1234)</option>
              </select>
            </label>

            <label>
              <span>MODEL SELECTION</span>
              <input
                className="input mono"
                value={config.model}
                onChange={(event) => setConfig({ ...config, model: event.target.value })}
                required
                placeholder="e.g. nvidia/nemotron-3-ultra-550b-a55b:free, gpt-4o-mini"
              />
            </label>

            <label className="full">
              <span>
                <KeyRound size={13} style={{ color: "var(--primary, #3b82f6)" }} /> API KEY {config.has_api_key && "(ALREADY CONFIGURED)"}
              </span>
              <input
                className="input mono"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  config.has_api_key
                    ? "•••••••••••••••• (Leave blank to keep active key)"
                    : "Enter API key (e.g. sk-or-...)"
                }
              />
            </label>

            <label>
              <span>BASE URL <small>(OPTIONAL)</small></span>
              <input
                className="input mono"
                value={config.base_url ?? ""}
                onChange={(event) => setConfig({ ...config, base_url: event.target.value })}
                placeholder="Default provider endpoint"
              />
            </label>
          </div>
        </div>

        {/* 2. AGENT & EXECUTION SETTINGS */}
        <div className="card">
          <div className="card-header">
            <h2>
              <Sliders size={14} style={{ color: "var(--primary, #3b82f6)", display: "inline", marginRight: 8 }} />
              Agent &amp; Workflow Execution Settings
            </h2>
          </div>

          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)" }}>
                RECURSION LIMIT: <strong>{config.recursion_limit ?? 10}</strong> (range 4 to 20)
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="mono" style={{ fontSize: 11 }}>4</span>
                <input
                  type="range"
                  min="4"
                  max="20"
                  value={config.recursion_limit ?? 10}
                  onChange={(e) => setConfig({ ...config, recursion_limit: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: "var(--primary, #3b82f6)" }}
                />
                <span className="mono" style={{ fontSize: 11 }}>20</span>
              </div>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={config.enable_memory ?? true}
                  onChange={(e) => setConfig({ ...config, enable_memory: e.target.checked })}
                  style={{ accentColor: "#ec4899" }}
                />
                <span>Enable short-term memory</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={config.proactive_mode ?? false}
                  onChange={(e) => setConfig({ ...config, proactive_mode: e.target.checked })}
                  style={{ accentColor: "#ec4899" }}
                />
                <span>Proactive workflow mode</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={config.intent_parsing ?? true}
                  onChange={(e) => setConfig({ ...config, intent_parsing: e.target.checked })}
                  style={{ accentColor: "#ec4899" }}
                />
                <span>LLM intent parsing</span>
              </label>
            </div>
          </div>
        </div>

        {/* 3. PIPELINE BEHAVIORS & CHAT CONTEXT */}
        <div className="card">
          <div className="card-header">
            <h2>
              <GitBranch size={14} style={{ color: "var(--primary, #3b82f6)", display: "inline", marginRight: 8 }} />
              Pipeline Behaviors &amp; Chat ↔ Pipeline Context
            </h2>
          </div>

          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)" }}>
                PERSIST PIPELINE DIRECTORY (OPTIONAL)
              </span>
              <input
                className="input mono"
                value={persistPipelineDir}
                onChange={(e) => setPersistPipelineDir(e.target.value)}
                placeholder="Path to save pipeline scripts and snapshots"
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={config.include_studio_context ?? true}
                  onChange={(e) => setConfig({ ...config, include_studio_context: e.target.checked })}
                  style={{ accentColor: "#ec4899" }}
                />
                <span>Include Pipeline Studio context in chat</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={config.include_node_code ?? false}
                  onChange={(e) => setConfig({ ...config, include_node_code: e.target.checked })}
                  style={{ accentColor: "#ec4899" }}
                />
                <span>Include selected node code snippet</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={config.use_studio_node ?? true}
                  onChange={(e) => setConfig({ ...config, use_studio_node: e.target.checked })}
                  style={{ accentColor: "#ec4899" }}
                />
                <span>Use selected Pipeline Studio node for chat</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={config.sync_studio_state ?? true}
                  onChange={(e) => setConfig({ ...config, sync_studio_state: e.target.checked })}
                  style={{ accentColor: "#ec4899" }}
                />
                <span>Sync Pipeline Studio state to AI</span>
              </label>
            </div>
          </div>
        </div>

        {/* 4. SQL & MLFLOW OPTIONS */}
        <div className="card">
          <div className="card-header">
            <h2>
              <Database size={14} style={{ color: "var(--primary, #3b82f6)", display: "inline", marginRight: 8 }} />
              SQL Database &amp; MLflow Experiment Tracking
            </h2>
          </div>

          <div className="settings-grid">
            <label className="full">
              <span>SQL DATABASE URL</span>
              <input
                className="input mono"
                value={config.sql_url}
                onChange={(event) => setConfig({ ...config, sql_url: event.target.value })}
                placeholder="sqlite:///:memory:"
              />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }} className="full">
              <input
                type="checkbox"
                checked={config.mlflow_enabled ?? false}
                onChange={(e) => setConfig({ ...config, mlflow_enabled: e.target.checked })}
                style={{ accentColor: "#ec4899" }}
              />
              <span>Enable MLflow logging in training</span>
            </label>

            <label>
              <span>MLFLOW TRACKING URI</span>
              <input
                className="input mono"
                value={config.mlflow_tracking_uri ?? "sqlite:///mlflow.db"}
                onChange={(e) => setConfig({ ...config, mlflow_tracking_uri: e.target.value })}
                placeholder="sqlite:///mlflow.db"
              />
            </label>

            <label>
              <span>MLFLOW ARTIFACT ROOT (LOCAL PATH)</span>
              <input
                className="input mono"
                value={config.mlflow_artifact_root ?? "./mlflow_artifacts"}
                onChange={(e) => setConfig({ ...config, mlflow_artifact_root: e.target.value })}
                placeholder="./mlflow_artifacts"
              />
            </label>

            <label className="full">
              <span>MLFLOW EXPERIMENT NAME</span>
              <input
                className="input mono"
                value={config.mlflow_experiment_name ?? "H2O AutoML"}
                onChange={(e) => setConfig({ ...config, mlflow_experiment_name: e.target.value })}
                placeholder="H2O AutoML"
              />
            </label>
          </div>
        </div>

        {/* 5. DEBUG OPTIONS */}
        <div className="card">
          <div className="card-header">
            <h2>
              <Activity size={14} style={{ color: "var(--primary, #3b82f6)", display: "inline", marginRight: 8 }} />
              Debug &amp; Logging Options
            </h2>
          </div>

          <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
              <input
                type="checkbox"
                checked={config.verbose_logs ?? false}
                onChange={(e) => setConfig({ ...config, verbose_logs: e.target.checked })}
                style={{ accentColor: "#ec4899" }}
              />
              <span>Verbose console logs</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
              <input
                type="checkbox"
                checked={config.show_progress_in_chat ?? true}
                onChange={(e) => setConfig({ ...config, show_progress_in_chat: e.target.checked })}
                style={{ accentColor: "#ec4899" }}
              />
              <span>Show progress in chat</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
              <input
                type="checkbox"
                checked={config.show_live_logs ?? true}
                onChange={(e) => setConfig({ ...config, show_live_logs: e.target.checked })}
                style={{ accentColor: "#ec4899" }}
              />
              <span>Show live logs while running</span>
            </label>
          </div>
        </div>

        {status && (
          <div
            className={status.type === "success" ? "settings-status" : "error-banner"}
            role="status"
          >
            {status.type === "success" ? <Check size={14} /> : null}
            <span>{status.message}</span>
          </div>
        )}

        <div className="settings-actions">
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={13} /> : <Check size={13} />}
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
