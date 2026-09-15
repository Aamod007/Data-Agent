"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Database,
  FileChartColumnIncreasing,
  FolderOpen,
  GitBranch,
  Grid,
  HardDrive,
  Home,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  Plus,
  Search,
  Settings,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { InspectorPanel } from "@/components/inspector-panel";
import { api } from "@/lib/api";
import type { Dataset } from "@/lib/types";
import { useWorkspaceStore } from "@/stores/workspace-store";

const navItems = [
  { href: "/chat", label: "Workspace", icon: Home },
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/explorer", label: "Explorer", icon: Grid },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/results", label: "Results", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const {
    datasets,
    activeDatasetId,
    leftSidebarOpen,
    inspectorOpen,
    setDatasets,
    setActive,
    toggleLeftSidebar,
    toggleInspector,
  } = useWorkspaceStore();

  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [isResizing, setIsResizing] = useState(false);
  const [datasetSearch, setDatasetSearch] = useState("");
  const [topbarDatasetMenuOpen, setTopbarDatasetMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const topbarDatasetRef = useRef<HTMLDivElement>(null);

  // Load datasets on mount
  useEffect(() => {
    api.datasets().then(setDatasets).catch(() => undefined);
  }, [setDatasets]);

  // Sidebar width setup
  useEffect(() => {
    const savedWidth = localStorage.getItem("data-agents-sidebar-width");
    if (savedWidth) {
      const w = Number(savedWidth);
      if (w >= 180 && w <= 450) setSidebarWidth(w);
    }
  }, []);

  // Sidebar drag resizer
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(180, Math.min(450, e.clientX));
      setSidebarWidth(newWidth);
      localStorage.setItem("data-agents-sidebar-width", String(newWidth));
    };

    const handleMouseUp = () => {
      if (isResizing) setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (topbarDatasetRef.current && !topbarDatasetRef.current.contains(e.target as Node)) {
        setTopbarDatasetMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeDataset = useMemo(
    () => datasets.find((d) => d.id === activeDatasetId) ?? datasets[0] ?? null,
    [datasets, activeDatasetId]
  );

  const filteredDatasets = useMemo(
    () =>
      datasets.filter((d) =>
        `${d.name} ${d.source} ${d.stage}`.toLowerCase().includes(datasetSearch.toLowerCase())
      ),
    [datasets, datasetSearch]
  );

  const totalStorageMB = useMemo(() => {
    const bytes = datasets.reduce((acc, d) => acc + d.shape[0] * d.shape[1] * 8, 0);
    return Math.max(24.7, Number((bytes / (1024 * 1024)).toFixed(1)));
  }, [datasets]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await api.upload(file);
      const list = await api.datasets();
      setDatasets(list);
      setActive(uploaded.id);
      if (pathname !== "/chat" && pathname !== "/") router.push("/chat");
    } catch {
      // Ignored
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="theme-app-container">
      {/* 1. TOP HEADER (Exact from theme.png) */}
      <header className="theme-topbar">
        <div className="topbar-left">
          <Link href="/chat" className="topbar-logo" aria-label="Data Agents Home">
            <svg
              className="topbar-logo-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <span>DATA AGENTS</span>
          </Link>

          <button
            type="button"
            className="topbar-collapse-btn"
            onClick={toggleLeftSidebar}
            title={leftSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-label={leftSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <PanelLeftClose size={15} />
          </button>
        </div>

        {/* Center Selectors with Popovers */}
        <div className="topbar-center-selectors">
          {/* Dataset Selector */}
          <div className="topbar-custom-dropdown-wrap" ref={topbarDatasetRef}>
            <button
              type="button"
              className="topbar-pill-select-btn"
              onClick={() => setTopbarDatasetMenuOpen((o) => !o)}
            >
              <FolderOpen size={12} className="pill-icon" />
              <span className="pill-prefix">Workspace &gt;</span>
              <span className="pill-active-val">
                {activeDataset ? `${activeDataset.name} (${activeDataset.stage.toUpperCase()})` : "No dataset"}
              </span>
              <ChevronDown size={11} className="pill-arrow" />
            </button>

            {topbarDatasetMenuOpen && (
              <div className="topbar-menu-popover">
                <div className="topbar-menu-header mono">SELECT ACTIVE DATASET</div>
                {datasets.length === 0 ? (
                  <div className="topbar-menu-empty mono">No datasets in workspace</div>
                ) : (
                  datasets.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`topbar-menu-item mono ${d.id === activeDatasetId ? "active" : ""}`}
                      onClick={() => {
                        void api.setActive(d.id).then(() => {
                          setActive(d.id);
                          return api.datasets();
                        }).then(setDatasets);
                        setTopbarDatasetMenuOpen(false);
                      }}
                    >
                      <span>{d.name}</span>
                      <span className="badge-stage-soft">{d.stage}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Topbar Right Tools */}
        <div className="topbar-right">
          <Link href="/datasets" className="topbar-icon-btn" title="Open Datasets view">
            <Grid size={14} />
          </Link>

          <button
            type="button"
            className={`topbar-icon-btn ${inspectorOpen ? "active" : ""}`}
            onClick={toggleInspector}
            title={inspectorOpen ? "Hide Inspector" : "Show Inspector"}
          >
            <PanelRight size={14} />
          </button>
        </div>
      </header>

      {/* 2. MAIN 3-PANEL BODY */}
      <div className="theme-main-body">
        {/* Left Sidebar (Full or Compact Icon Rail per Image #16) */}
        {leftSidebarOpen ? (
          <aside
            className="theme-left-sidebar"
            style={{ width: `${sidebarWidth}px`, flex: `0 0 ${sidebarWidth}px` }}
            aria-label="Left Sidebar"
          >
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
              {/* Navigation Menu Links */}
              <nav className="left-sidebar-nav">
                {navItems.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href || (href === "/chat" && pathname === "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`nav-link-row ${isActive ? "active" : ""}`}
                    >
                      <div className="nav-link-left">
                        <Icon size={14} />
                        <span>{label}</span>
                      </div>
                      {href === "/datasets" && datasets.length > 0 && (
                        <span className="nav-link-count">{datasets.length}</span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              {/* DATASETS SECTION */}
              <div className="left-sidebar-datasets-section">
                <div className="datasets-header-row">
                  <span>DATASETS</span>
                  <button
                    type="button"
                    className="datasets-add-btn"
                    title="Import new dataset"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <div className="sidebar-search-box">
                  <Search size={12} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
                  <input
                    placeholder="Search datasets..."
                    value={datasetSearch}
                    onChange={(e) => setDatasetSearch(e.target.value)}
                  />
                </div>

                <div className="sidebar-datasets-scroll">
                  {filteredDatasets.length === 0 ? (
                    <p className="sidebar-empty mono">No matching datasets</p>
                  ) : (
                    filteredDatasets.map((d) => {
                      const isActive = d.id === activeDatasetId;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          className={`dataset-list-item-soft ${isActive ? "active" : ""}`}
                          onClick={() => {
                            void api.setActive(d.id).then(() => {
                              setActive(d.id);
                              return api.datasets();
                            }).then(setDatasets);
                          }}
                          title={`${d.name} (${d.shape[0]}×${d.shape[1]})`}
                        >
                          <div className="dataset-item-left">
                            <Database size={12} className="dataset-item-icon" />
                            <span className="dataset-item-name">{d.name}</span>
                          </div>
                          <div className="dataset-item-right">
                            <span className="dataset-item-shape">{d.shape[0].toLocaleString()}r</span>
                            <span className="badge-stage-soft">{d.stage}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Upload Button at bottom of datasets panel */}
                <div className="sidebar-upload-trigger-wrap">
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
                    className="sidebar-upload-btn"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={12} />
                    <span>{uploading ? "IMPORTING…" : "UPLOAD DATASET"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Storage Row */}
            <div className="left-sidebar-footer">
              <div className="storage-indicator">
                <HardDrive size={12} />
                <span>Storage</span>
              </div>
              <span>{totalStorageMB} MB / 1 GB</span>
            </div>

            {/* Drag Resizer Handle (Image #15) */}
            <div
              className={`sidebar-resizer-handle ${isResizing ? "resizing" : ""}`}
              onMouseDown={() => setIsResizing(true)}
              title="Drag to resize sidebar"
              aria-label="Resize sidebar"
            />
          </aside>
        ) : (
          /* Collapsed Icon Rail (Image #16 Fixed) */
          <aside className="theme-left-sidebar is-compact" aria-label="Compact Left Navigation">
            <div className="compact-icon-rail">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || (href === "/chat" && pathname === "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`compact-nav-icon-btn ${isActive ? "active" : ""}`}
                    title={label}
                    aria-label={label}
                  >
                    <Icon size={16} />
                  </Link>
                );
              })}
            </div>
            <div className="compact-icon-rail" style={{ marginTop: "auto", borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                className="compact-nav-icon-btn"
                onClick={toggleLeftSidebar}
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen size={16} />
              </button>
            </div>
          </aside>
        )}

        {/* Main Center View */}
        <main className="theme-center-workbench">{children}</main>

        {/* Right Inspector Panel */}
        <InspectorPanel />
      </div>
    </div>
  );
}
