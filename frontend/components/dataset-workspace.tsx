"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Database,
  Download,
  FileChartColumnIncreasing,
  FileUp,
  FolderOpen,
  LoaderCircle,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  TableProperties,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Dataset, DatasetDetails, DatasetPreview, SampleDataset } from "@/lib/types";
import { useWorkspaceStore } from "@/stores/workspace-store";

function dateLabel(timestamp: number) {
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.round((timestamp - Date.now() / 1000) / 60),
    "minute"
  );
}

export function DatasetWorkspace() {
  const { datasets, activeDatasetId, setDatasets, setActive } = useWorkspaceStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [details, setDetails] = useState<DatasetDetails | null>(null);
  const [samples, setSamples] = useState<SampleDataset[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"data" | "schema" | "stats" | "code">("data");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDirInput, setShowDirInput] = useState(false);
  const [dirPath, setDirPath] = useState("C:\\Users\\yashv\\Desktop\\data_datathon");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDatasets = async () => {
    try {
      const list = await api.datasets();
      setDatasets(list);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load datasets.");
    }
  };

  useEffect(() => {
    void loadDatasets();
    api.samples().then(setSamples).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedId && activeDatasetId) setSelectedId(activeDatasetId);
  }, [activeDatasetId, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setPreview(null);
      setDetails(null);
      return;
    }
    Promise.all([api.preview(selectedId), api.details(selectedId)])
      .then(([nextPreview, nextDetails]) => {
        setPreview(nextPreview);
        setDetails(nextDetails);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load dataset preview."));
  }, [selectedId]);

  const visible = useMemo(
    () => datasets.filter((dataset) => `${dataset.name} ${dataset.source}`.toLowerCase().includes(query.toLowerCase())),
    [datasets, query]
  );

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const uploaded = await api.upload(file);
      await loadDatasets();
      setSelectedId(uploaded.id);
      setActive(uploaded.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const loadSample = async (sampleId: string) => {
    setBusy(true);
    setError(null);
    try {
      const loaded = await api.loadSample(sampleId);
      await loadDatasets();
      setSelectedId(loaded.id);
      setActive(loaded.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load sample dataset.");
    } finally {
      setBusy(false);
    }
  };

  const loadDirectory = async (targetDir: string) => {
    setBusy(true);
    setError(null);
    try {
      const loaded = await api.loadLocal(targetDir);
      await loadDatasets();
      if (loaded.length > 0) {
        setSelectedId(loaded[0].id);
        setActive(loaded[0].id);
      }
      setShowDirInput(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load directory.");
    } finally {
      setBusy(false);
    }
  };

  const activate = async (dataset: Dataset) => {
    try {
      await api.setActive(dataset.id);
      setActive(dataset.id);
      await loadDatasets();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not set active dataset.");
    }
  };

  const remove = async (dataset: Dataset) => {
    if (!window.confirm(`Remove ${dataset.name}?`)) return;
    try {
      await api.remove(dataset.id);
      if (selectedId === dataset.id) setSelectedId(null);
      await loadDatasets();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove dataset.");
    }
  };

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow mono">WORKSPACE DATASETS</p>
          <h1>Dataset Management</h1>
          <p className="muted">Upload tabular datasets or load quick start samples into workspace memory.</p>
        </div>
        <div className="heading-actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".csv,.csv.gz,.tsv,.json,.jsonl,.ndjson,.parquet,.xlsx,.xls"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.currentTarget.value = "";
            }}
          />
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setShowDirInput((prev) => !prev)}
            title="Load all tabular datasets from a local directory"
          >
            <FolderOpen size={15} />
            <span className="mono">LOAD FOLDER</span>
          </button>
          <button className="button primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <LoaderCircle size={15} className="spin" /> : <FileUp size={15} />}
            <span className="mono">{busy ? "IMPORTING…" : "UPLOAD FILE"}</span>
          </button>
        </div>
      </div>

      {showDirInput && (
        <section className="card" style={{ padding: "12px 16px", marginBottom: "16px", background: "var(--card-bg-elevated, #161a23)", borderColor: "var(--border-color, #272d3b)" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              LOCAL DIRECTORY:
            </span>
            <input
              className="mono"
              style={{
                flex: "1 1 300px",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border-color, #333)",
                background: "var(--bg-secondary, #0d1117)",
                color: "inherit",
                fontSize: 12,
              }}
              value={dirPath}
              onChange={(e) => setDirPath(e.target.value)}
              placeholder="e.g. C:\Users\yashv\Desktop\data_datathon"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && dirPath.trim()) void loadDirectory(dirPath.trim());
              }}
            />
            <button
              className="button primary"
              disabled={busy || !dirPath.trim()}
              onClick={() => void loadDirectory(dirPath.trim())}
              style={{ whiteSpace: "nowrap" }}
            >
              {busy ? <LoaderCircle size={14} className="spin" /> : <FolderOpen size={14} />}
              <span className="mono">LOAD ALL FILES</span>
            </button>
            <button
              className="button ghost"
              disabled={busy}
              onClick={() => setShowDirInput(false)}
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {error && <div role="alert" className="error-banner mono">{error}</div>}

      <section className="sample-bar card">
        <div className="sample-bar-header mono">
          <span>QUICK LOAD / SAMPLES (CLICK TO LOAD)</span>
        </div>
        <div className="sample-chips">
          <button
            className="sample-chip mono"
            disabled={busy}
            onClick={() => void loadDirectory("C:\\Users\\yashv\\Desktop\\data_datathon")}
            title="Load all datathon data files from C:\Users\yashv\Desktop\data_datathon"
            style={{ borderColor: "var(--accent-blue, #3b82f6)", background: "rgba(59, 130, 246, 0.1)" }}
          >
            <FolderOpen size={12} aria-hidden="true" style={{ color: "#3b82f6" }} />
            <span style={{ fontWeight: 600, color: "#60a5fa" }}>Datathon Data Folder</span>
          </button>
          {samples.map((s) => (
            <button
              key={s.id}
              className="sample-chip mono"
              disabled={busy}
              onClick={() => void loadSample(s.id)}
              title={s.description}
            >
              <Plus size={12} aria-hidden="true" />
              <span>{s.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card dataset-card">
        <div className="card-header dataset-toolbar">
          <div className="search">
            <Search size={14} aria-hidden="true" />
            <input
              className="mono"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search datasets by name or source…"
              aria-label="Filter datasets"
            />
          </div>
          <span className="muted mono" style={{ fontSize: 11 }}>
            {datasets.length} dataset{datasets.length === 1 ? "" : "s"} loaded
          </span>
        </div>

        {visible.length === 0 ? (
          <div className="empty">
            <Database size={28} aria-hidden="true" />
            <p className="mono" style={{ fontSize: 12 }}>
              <strong>No datasets in workspace.</strong>
              <br />
              Upload a file or click a Quick Sample above.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>STATUS</th>
                  <th>NAME</th>
                  <th>STAGE</th>
                  <th>DIMENSIONS</th>
                  <th>SOURCE</th>
                  <th>CREATED</th>
                  <th aria-label="Actions">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((dataset) => (
                  <tr
                    key={dataset.id}
                    className={selectedId === dataset.id ? "selected" : ""}
                    onClick={() => setSelectedId(dataset.id)}
                  >
                    <td>
                      <button
                        className={`status-btn mono ${dataset.is_active ? "active" : ""}`}
                        title={dataset.is_active ? "Active dataset" : "Click to select"}
                        aria-label={`Make ${dataset.name} active`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void activate(dataset);
                        }}
                      >
                        <span className="active-dot" />
                        <span>{dataset.is_active ? "ACTIVE" : "SELECT"}</span>
                      </button>
                    </td>
                    <td>
                      <strong className="mono" style={{ fontSize: 12 }}>{dataset.name}</strong>
                    </td>
                    <td>
                      <span className={`badge badge-${dataset.stage}`}>{dataset.stage}</span>
                    </td>
                    <td className="mono">{dataset.shape[0].toLocaleString()} × {dataset.shape[1]}</td>
                    <td className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{dataset.source}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{dateLabel(dataset.created_at)}</td>
                    <td className="row-actions">
                      <Link
                        href={`/chat`}
                        className="table-icon"
                        title="Open in Agent Workbench"
                        aria-label={`Open ${dataset.name} in Workbench`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void activate(dataset);
                        }}
                      >
                        <MessageSquare size={15} />
                      </Link>
                      <a
                        className="table-icon"
                        href={`http://localhost:8000/api/datasets/${dataset.id}/download?format=csv`}
                        title="Download CSV"
                        aria-label={`Download ${dataset.name} as CSV`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Download size={15} />
                      </a>
                      <button
                        className="table-icon danger-text"
                        title="Delete dataset"
                        aria-label={`Delete ${dataset.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void remove(dataset);
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {preview && details && (
        <section className="card preview-card">
          <div className="card-header preview-header">
            <div>
              <div className="preview-title-row">
                <h2 className="mono">{preview.dataset.name}</h2>
                <span className={`badge badge-${preview.dataset.stage}`}>{preview.dataset.stage}</span>
              </div>
              <p className="muted mono" style={{ fontSize: 11 }}>
                {preview.total_rows.toLocaleString()} rows · {preview.columns.length} columns · {preview.dataset.source}
              </p>
            </div>
            <div className="preview-header-actions">
              <Link href="/chat" className="button primary preview-action-btn">
                <MessageSquare size={13} /> Open Workbench
              </Link>
              <div className="tabs" role="tablist" aria-label="Dataset details">
                {(["data", "schema", "stats", "code"] as const).map((item) => (
                  <button
                    role="tab"
                    aria-selected={tab === item}
                    className={`tab mono ${tab === item ? "active" : ""}`}
                    key={item}
                    onClick={() => setTab(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {tab === "data" && (
            <div className="table-scroll preview-table">
              <table>
                <thead>
                  <tr>
                    {preview.columns.map((column) => (
                      <th key={column.name}>
                        {column.name}
                        <small className="mono">{column.dtype}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, index) => (
                    <tr key={index}>
                      {preview.columns.map((column) => (
                        <td key={column.name} className="mono" style={{ fontSize: 12 }}>
                          {row[column.name] == null ? <span className="null">null</span> : String(row[column.name])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "schema" && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>COLUMN NAME</th>
                    <th>DATA TYPE</th>
                    <th>MISSING</th>
                    <th>UNIQUE</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.columns.map((column) => (
                    <tr key={column.name}>
                      <td><strong className="mono">{column.name}</strong></td>
                      <td><code>{column.dtype}</code></td>
                      <td className="mono">
                        {column.nulls > 0 ? (
                          <span className="warn-nulls">{column.nulls.toLocaleString()}</span>
                        ) : (
                          <span className="no-nulls">0</span>
                        )}
                      </td>
                      <td className="mono">{column.unique.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "stats" && (
            details.stats.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {Object.keys(details.stats[0]).map((key) => (
                        <th key={key}>{key.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {details.stats.map((row, index) => (
                      <tr key={index}>
                        {Object.entries(row).map(([key, value]) => (
                          <td key={key} className="mono" style={{ fontSize: 11 }}>
                            {value == null
                              ? "—"
                              : typeof value === "number"
                              ? value.toLocaleString(undefined, { maximumFractionDigits: 3 })
                              : String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty mono" style={{ fontSize: 11 }}>
                No numeric columns available for summary statistics.
              </div>
            )
          )}

          {tab === "code" && (
            <pre className="code-block mono"><code>{details.load_code}</code></pre>
          )}
        </section>
      )}
    </div>
  );
}
