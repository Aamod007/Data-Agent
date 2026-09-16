"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  Code2,
  Database,
  FileCode2,
  FileUp,
  LoaderCircle,
  Paperclip,
  Play,
  Settings2,
  Sparkles,
  Terminal,
  User,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { ArtifactView } from "@/components/artifact-view";
import { api, streamRun } from "@/lib/api";
import type { AgentRun, Dataset } from "@/lib/types";
import { useWorkspaceStore } from "@/stores/workspace-store";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  run?: AgentRun;
  time?: string;
};

const agentList = [
  { id: "analyst", label: "Pandas Analyst (Auto-Route)", tag: "AUTO" },
  { id: "eda", label: "EDA Tools Agent", tag: "PROFILE" },
  { id: "visualization", label: "Visualization Agent", tag: "PLOT" },
  { id: "wrangling", label: "Data Wrangling Agent", tag: "TRANSFORM" },
  { id: "cleaning", label: "Data Cleaning Agent", tag: "CLEAN" },
  { id: "sql", label: "SQL Database Agent", tag: "QUERY" },
  { id: "loader", label: "Data Loader Agent", tag: "FILES" },
] as const;

export function ChatWorkspace() {
  const {
    datasets,
    activeDatasetId,
    selectedAgent,
    autoRoute,
    setDatasets,
    setActive,
    setSelectedAgent,
    setAutoRoute,
  } = useWorkspaceStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [instructions, setInstructions] = useState("");
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const streamBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!datasets.length) api.datasets().then(setDatasets).catch(() => undefined);
  }, [datasets.length, setDatasets]);

  useEffect(() => {
    streamBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, run]);

  useEffect(() => () => cleanup.current?.(), []);

  // Close agent dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAgentDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keyboard navigation for Agent Dropdown
  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (!agentDropdownOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setAgentDropdownOpen(true);
        const idx = agentList.findIndex((a) => a.id === selectedAgent);
        setFocusedIndex(idx >= 0 ? idx : 0);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % agentList.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + agentList.length) % agentList.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (agentList[focusedIndex]) {
        setSelectedAgent(agentList[focusedIndex].id);
        setAgentDropdownOpen(false);
        dropdownButtonRef.current?.focus();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAgentDropdownOpen(false);
      dropdownButtonRef.current?.focus();
    }
  };

  const activeDataset = datasets.find((d) => d.id === activeDatasetId) ?? datasets[0];

  const nowTime = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
  };

  const loadQuickSample = async (sampleId = "bike_sales_data") => {
    try {
      setError(null);
      const loaded = await api.loadSample(sampleId);
      const list = await api.datasets();
      setDatasets(list);
      setActive(loaded.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load sample dataset.");
    }
  };

  const handleExecute = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = instructions.trim();
    if (!prompt) return;
    if (run?.status === "running" || run?.status === "queued") return;

    let targetDataset = activeDataset;
    if (!targetDataset) {
      if (datasets.length > 0) {
        targetDataset = datasets[0];
        setActive(targetDataset.id);
      } else {
        try {
          targetDataset = await api.loadSample("telco_churn");
          const list = await api.datasets();
          setDatasets(list);
          setActive(targetDataset.id);
        } catch {
          // Fallback
        }
      }
    }

    setInstructions("");
    setError(null);

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: prompt, time: nowTime() },
    ]);

    try {
      const agentMode = autoRoute ? "analyst" : selectedAgent;
      const created = await api.invoke({
        dataset_id: targetDataset?.id || "",
        instructions: prompt,
        agent: agentMode,
      });

      const queued: AgentRun = {
        run_id: created.run_id,
        status: "queued",
        message: null,
        artifacts: [],
        logs: [`Task queued for ${agentMode.toUpperCase()} agent.`],
        route: null,
      };
      setRun(queued);
      cleanup.current?.();

      cleanup.current = streamRun(
        created.run_id,
        (next) => {
          setRun(next);
          if (next.status === "completed" || next.status === "failed") {
            cleanup.current?.();
            cleanup.current = null;
            setMessages((prev) => [
              ...prev,
              {
                id: next.run_id,
                role: "assistant",
                text:
                  next.message ||
                  (next.status === "failed" ? "Agent execution failed." : "Execution complete."),
                run: next,
                time: nowTime(),
              },
            ]);
            setRun(null);
            api.datasets().then(setDatasets).catch(() => undefined);
          }
        },
        (errMsg) => {
          cleanup.current?.();
          cleanup.current = null;
          setError(errMsg);
          setRun(null);
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              text: `Agent execution notice: ${errMsg}`,
              time: nowTime(),
            },
          ]);
        }
      );
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "Failed to trigger agent.";
      setError(msg);
      setRun(null);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Failed to start agent: ${msg}`,
          time: nowTime(),
        },
      ]);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const uploaded = await api.upload(file);
      const list = await api.datasets();
      setDatasets(list);
      setActive(uploaded.id);
    } catch {
      // ignore
    }
  };

  const currentAgent = agentList.find((a) => a.id === selectedAgent) ?? agentList[0];

  return (
    <div className="theme-center-workbench">
      {/* Messages Stream or Empty Hero */}
      {messages.length === 0 ? (
        <div className="workbench-empty-hero">
          {/* Subtle Glow Backdrop & 3D Cube Icon */}
          <div className="hero-glow-container">
            <div className="hero-glow-sphere" aria-hidden="true" />
            <div className="hero-cube-icon">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
          </div>

          <h1>Agent Data Workbench</h1>
          <p>
            Select a dataset and start working with your data using AI agents.
            <br />
            Ask a question, run an analysis, or generate a visualization.
          </p>

        </div>
      ) : (
        <div className="theme-stream-scroll">
          {messages.map((m) => (
            <div key={m.id} className={`stream-entry ${m.role}`}>
              <div className="stream-gutter mono">
                {m.role === "user" ? (
                  <span className="gutter-role user"><User size={12} /> YOU</span>
                ) : (
                  <span className="gutter-role agent"><Bot size={12} /> AGENT</span>
                )}
                {m.time && <span className="gutter-time">{m.time}</span>}
              </div>

              <div className="stream-content">
                {m.run?.route && (
                  <div className="stream-route-badge mono">
                    <span>ROUTED VIA: {m.run.route.toUpperCase()}</span>
                  </div>
                )}
                <div className="stream-text">{m.text}</div>

                {/* Inline Artifacts */}
                {m.run?.artifacts && m.run.artifacts.length > 0 && (
                  <div className="stream-artifacts">
                    {m.run.artifacts
                      .filter((art) => art.type !== "code")
                      .map((art, idx) => (
                        <ArtifactView key={`${art.type}-${idx}`} artifact={art} />
                      ))}
                  </div>
                )}

                {/* Collapsible Execution Trace */}
                {m.run?.logs && m.run.logs.length > 0 && (
                  <details className="execution-trace-details mono">
                    <summary>Execution Trace ({m.run.logs.length} steps)</summary>
                    <pre>{m.run.logs.join("\n")}</pre>
                  </details>
                )}
              </div>
            </div>
          ))}

          {/* Running Progress */}
          {run && (
            <div className="stream-entry assistant running">
              <div className="stream-gutter mono">
                <span className="gutter-role agent"><LoaderCircle className="spin" size={12} /> RUNNING</span>
              </div>
              <div className="stream-content">
                <div className="running-status-bar mono">
                  <span>{run.logs.at(-1) ?? "Executing LangGraph pipeline…"}</span>
                </div>
                <div className="stream-progress-bar">
                  <span />
                </div>
              </div>
            </div>
          )}

          <div ref={streamBottomRef} />
        </div>
      )}

      {/* Floating Glassmorphic Prompt Composer (Fixed layout per Image #12) */}
      <div className="theme-floating-composer-container">
        <div className="glass-composer-card">
          {error && (
            <div className="error-banner" style={{ margin: "0 0 6px", padding: "6px 10px", fontSize: 11 }}>
              <CircleAlert size={14} />
              <span>{error}</span>
            </div>
          )}

          <textarea
            className="glass-input-field"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (instructions.trim() && !run) void handleExecute();
              }
            }}
            placeholder={
              activeDataset
                ? `Ask your agent anything about ${activeDataset.name}...`
                : "Select or upload a dataset to start asking questions..."
            }
            rows={1}
            disabled={Boolean(run)}
          />

          <div className="glass-composer-bottom-row">
            {/* Bottom Left Controls */}
            <div className="glass-bottom-left">
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
                className="glass-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach or upload dataset"
                aria-label="Attach dataset"
              >
                <Paperclip size={14} />
              </button>

              {/* Redesigned Compact IDE Control Dropdown (Fixed per Image #12) */}
              <div className="agent-ide-dropdown-anchor" ref={dropdownRef}>
                <button
                  ref={dropdownButtonRef}
                  type="button"
                  className="agent-ide-trigger-btn mono"
                  onClick={() => {
                    const next = !agentDropdownOpen;
                    setAgentDropdownOpen(next);
                    if (next) {
                      const idx = agentList.findIndex((a) => a.id === selectedAgent);
                      setFocusedIndex(idx >= 0 ? idx : 0);
                    }
                  }}
                  onKeyDown={handleDropdownKeyDown}
                  aria-haspopup="listbox"
                  aria-expanded={agentDropdownOpen}
                  aria-label="Select active agent"
                >
                  <Sparkles size={11} className="agent-trigger-sparkle" />
                  <span className="agent-trigger-name">{selectedAgent.toUpperCase()}</span>
                  <ChevronDown size={10} className={`agent-trigger-arrow ${agentDropdownOpen ? "open" : ""}`} />
                </button>

                {/* Compact IDE Control Menu Overlay (240px, non-displacing) */}
                {agentDropdownOpen && (
                  <div
                    className="agent-ide-popover-menu"
                    role="listbox"
                    aria-label="Agent options"
                    onKeyDown={handleDropdownKeyDown}
                  >
                    <div className="agent-popover-header mono">AGENT PIPELINE</div>
                    {agentList.map((opt, idx) => {
                      const isSelected = selectedAgent === opt.id;
                      const isFocused = focusedIndex === idx;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`agent-popover-item mono ${isSelected ? "selected" : ""} ${isFocused ? "focused" : ""}`}
                          onClick={() => {
                            setSelectedAgent(opt.id);
                            setAgentDropdownOpen(false);
                            dropdownButtonRef.current?.focus();
                          }}
                          onMouseEnter={() => setFocusedIndex(idx)}
                        >
                          <span className="agent-popover-item-text">{opt.label}</span>
                          {isSelected ? (
                            <Check size={11} className="agent-popover-check" />
                          ) : (
                            <span className="agent-popover-tag">{opt.tag}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Auto-Route Toggle Switch */}
              <div
                className="glass-switch-wrap"
                onClick={() => setAutoRoute(!autoRoute)}
                role="switch"
                aria-checked={autoRoute}
                title="Auto-route queries to best agent"
              >
                <span>Auto-route</span>
                <div className={`custom-switch ${autoRoute ? "on" : ""}`}>
                  <span className="custom-switch-dot" />
                </div>
              </div>
            </div>

            {/* Bottom Right Controls */}
            <div className="glass-bottom-right">
              <span className="glass-hint-text">Shift + Enter for new line</span>
              <button
                type="button"
                className="glass-send-btn"
                disabled={!instructions.trim() || Boolean(run)}
                onClick={() => void handleExecute()}
                title="Send query"
                aria-label="Send query"
              >
                {run ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={15} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
