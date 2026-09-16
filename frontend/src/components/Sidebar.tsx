import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Home,
  Database,
  Table,
  GitFork,
  FileText,
  Settings,
  Search,
  Plus,
  Upload,
  Eye,
} from 'lucide-react';
import { Dataset, Telemetry } from '../types';

interface SidebarProps {
  telemetry: Telemetry | null;
  datasets: Dataset[];
  activeDatasetId: string | null;
  onSelectDataset: (id: string) => void;
  onUploadClick: () => void;
  onPreviewDataset?: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  telemetry,
  datasets,
  activeDatasetId,
  onSelectDataset,
  onUploadClick,
  onPreviewDataset,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDatasets = datasets.filter((ds) =>
    ds.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside style={{
      width: 256,
      height: '100vh',
      backgroundColor: '#f8fafc',
      borderRight: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '16px 18px 12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#2563eb',
        }}>
          <Box size={18} strokeWidth={2.2} />
        </div>
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: '#0f172a',
          textTransform: 'uppercase',
        }}>
          VECTOR X
        </span>
      </div>

      {/* Main Nav Items */}
      <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NavLink
          to="/chat"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '7px 12px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: isActive ? 600 : 500,
            color: isActive ? '#0284c7' : '#475569',
            backgroundColor: isActive ? '#e0f2fe' : 'transparent',
            textDecoration: 'none',
          })}
        >
          <Home size={16} />
          <span>Workspace</span>
        </NavLink>

        <NavLink
          to="/datasets"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '7px 12px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: isActive ? 600 : 500,
            color: isActive ? '#0284c7' : '#475569',
            backgroundColor: isActive ? '#e0f2fe' : 'transparent',
            textDecoration: 'none',
          })}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={16} />
            <span>Datasets</span>
          </div>
          <span style={{
            fontSize: 11,
            color: '#64748b',
            backgroundColor: '#e2e8f0',
            padding: '1px 6px',
            borderRadius: 10,
            fontWeight: 600,
          }}>
            {datasets.length}
          </span>
        </NavLink>

        <NavLink
          to="/pipeline"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '7px 12px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: isActive ? 600 : 500,
            color: isActive ? '#0284c7' : '#475569',
            backgroundColor: isActive ? '#e0f2fe' : 'transparent',
            textDecoration: 'none',
          })}
        >
          <GitFork size={16} />
          <span>Pipeline Studio</span>
        </NavLink>

        <NavLink
          to="/results"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '7px 12px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: isActive ? 600 : 500,
            color: isActive ? '#0284c7' : '#475569',
            backgroundColor: isActive ? '#e0f2fe' : 'transparent',
            textDecoration: 'none',
          })}
        >
          <FileText size={16} />
          <span>Results</span>
        </NavLink>

        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '7px 12px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: isActive ? 600 : 500,
            color: isActive ? '#0284c7' : '#475569',
            backgroundColor: isActive ? '#e0f2fe' : 'transparent',
            textDecoration: 'none',
          })}
        >
          <Settings size={16} />
          <span>Settings</span>
        </NavLink>
      </div>

      {/* Datasets Section */}
      <div style={{
        padding: '10px 12px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: '#64748b',
            textTransform: 'uppercase',
          }}>
            DATASETS
          </span>
          <button
            onClick={onUploadClick}
            title="Add dataset"
            style={{
              color: '#64748b',
              padding: 2,
              borderRadius: 4,
            }}
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Search datasets */}
        <div style={{
          position: 'relative',
          marginBottom: 8,
        }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: 7, color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search datasets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '5px 8px 5px 26px',
              fontSize: 11,
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#0f172a',
            }}
          />
        </div>

        {/* Dataset List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {filteredDatasets.map((ds) => {
            const isActive = ds.id === activeDatasetId;
            return (
              <div
                key={ds.id}
                onClick={() => onSelectDataset(ds.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  backgroundColor: isActive ? '#eff6ff' : '#ffffff',
                  border: isActive ? '1px solid #bfdbfe' : '1px solid #f1f5f9',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  overflow: 'hidden',
                }}>
                  <Table size={13} color={isActive ? '#2563eb' : '#64748b'} style={{ flexShrink: 0 }} />
                  <span
                    title={ds.label}
                    style={{
                      fontSize: 11,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? '#1e40af' : '#334155',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 110,
                    }}
                  >
                    {ds.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>
                    {ds.records > 999 ? `${(ds.records / 1000).toFixed(1)}k` : ds.records}r
                  </span>
                  <span style={{
                    fontSize: 8,
                    fontWeight: 700,
                    padding: '1px 3px',
                    borderRadius: 2,
                    backgroundColor: ds.stage === 'cleaned' ? '#dcfce7' : '#fee2e2',
                    color: ds.stage === 'cleaned' ? '#16a34a' : '#ef4444',
                    textTransform: 'uppercase',
                  }}>
                    {ds.stage}
                  </span>
                  {onPreviewDataset && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreviewDataset(ds.id);
                      }}
                      title={`Preview ${ds.label}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        padding: '2px 4px',
                        borderRadius: 3,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#2563eb';
                        e.currentTarget.style.backgroundColor = '#eff6ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#94a3b8';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <Eye size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Upload Button */}
        <button
          onClick={onUploadClick}
          style={{
            marginTop: 8,
            width: '100%',
            border: '1px dashed #cbd5e1',
            borderRadius: 6,
            padding: '6px 0',
            fontSize: 11,
            fontWeight: 600,
            color: '#475569',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Upload size={12} />
          UPLOAD DATASET
        </button>
      </div>

      {/* Footer Profile */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
          }}>
            N
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Storage</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>
              {telemetry?.storage_text || '24.7 MB / 1 GB'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
