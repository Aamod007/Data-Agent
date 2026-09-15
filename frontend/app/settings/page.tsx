"use client";

import { useEffect, useState } from "react";
import { Check, Database, KeyRound, LoaderCircle, Lock, ServerCog, Sparkles } from "lucide-react";
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
  provider: "nvidia",
  model: "meta/llama-3.2-11b-vision-instruct",
  has_api_key: true,
  base_url: "https://integrate.api.nvidia.com/v1",
  sql_url: "sqlite:///:memory:",
};

export default function SettingsPage() {
  const [config, setConfig] = useState<AppConfig>(defaults);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    api.config()
      .then(setConfig)
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
      const saved = await api.updateConfig({ ...config, ...(apiKey ? { api_key: apiKey } : {}) });
      setConfig(saved);
      setApiKey("");
      setStatus({ type: "success", message: "Workspace configuration updated successfully." });
    } catch (cause) {
      setStatus({ type: "error", message: cause instanceof Error ? cause.message : "Could not save configuration." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page settings-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow mono">WORKSPACE CONFIGURATION</p>
          <h1>Settings &amp; Integrations</h1>
          <p className="muted">
            Configure LLM providers, API keys, and SQL database engines. Credentials remain in local process memory.
          </p>
        </div>
      </div>

      <form className="settings-form card" onSubmit={save}>
        <div className="card-header">
          <h2>LLM Provider &amp; Model Configuration</h2>
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
              <option value="nvidia">NVIDIA NIM (meta/llama-3.2-11b-vision-instruct, etc.)</option>
              <option value="openai">OpenAI (GPT-4o, GPT-4o-mini)</option>
              <option value="ollama">Ollama (Local Models via localhost:11434)</option>
              <option value="lm_studio">LM Studio (Local Server 1234)</option>
              <option value="openrouter">OpenRouter (Multi-model Router)</option>
            </select>
          </label>

          <label>
            <span>MODEL NAME</span>
            <input
              className="input mono"
              value={config.model}
              onChange={(event) => setConfig({ ...config, model: event.target.value })}
              required
              placeholder="e.g. gpt-4o-mini, llama3, qwen2.5-coder"
            />
          </label>

          <label className="full">
            <span>
              <KeyRound size={13} style={{ color: "var(--primary)" }} /> API KEY {config.has_api_key && "(ALREADY CONFIGURED)"}
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
                  : config.provider === "ollama" || config.provider === "lm_studio"
                  ? "Optional for local providers (e.g. ollama / lm-studio)"
                  : "Enter API key (e.g. sk-...)"
              }
            />
          </label>

          <label>
            <span>BASE URL <small>(OPTIONAL)</small></span>
            <input
              className="input mono"
              value={config.base_url ?? ""}
              onChange={(event) => setConfig({ ...config, base_url: event.target.value })}
              placeholder={config.provider === "ollama" ? "http://localhost:11434" : "Default provider endpoint"}
            />
          </label>

          <label>
            <span>
              <ServerCog size={13} style={{ color: "var(--primary)" }} /> SQL DATABASE URL
            </span>
            <input
              className="input mono"
              value={config.sql_url}
              onChange={(event) => setConfig({ ...config, sql_url: event.target.value })}
              placeholder="sqlite:///data/northwind.db"
            />
          </label>
        </div>

        {status && (
          <div
            className={status.type === "success" ? "settings-status" : "error-banner"}
            role="status"
            style={{ margin: "0 20px 14px" }}
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
