import React, { useState } from 'react';
import { Dataset, DatasetPreview } from '../types';
import { uploadDataset, selectDataset, fetchDatasetPreview, getDownloadUrl } from '../api';
import { Database, Upload, Download, Eye, Check, X, FileSpreadsheet } from 'lucide-react';

interface DatasetsProps {
  datasets: Dataset[];
  activeDatasetId: string | null;
  onRefresh: () => void;
  onSelectDataset: (id: string) => void;
  onPreviewDataset?: (id: string) => void;
  onUploadClick?: () => void;
}

export const Datasets: React.FC<DatasetsProps> = ({
  datasets,
  activeDatasetId,
  onRefresh,
  onSelectDataset,
  onPreviewDataset,
  onUploadClick,
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState<DatasetPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files);
    setUploading(true);
    try {
      await uploadDataset(fileList);
      onRefresh();
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleOpenPreview = async (datasetId: string) => {
    setPreviewLoading(true);
    try {
      const data = await fetchDatasetPreview(datasetId, 1, 50);
      setPreviewData(data);
    } catch (err: any) {
      alert(`Preview failed: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div style={{
      flex: 1,
      height: '100%',
      overflowY: 'auto',
      padding: '24px 32px',
      backgroundColor: '#f8fafc',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Database size={20} color="#2563eb" />
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Dataset Manager & Lineage</h1>
          </div>
          <p style={{ fontSize: 12, color: '#64748b' }}>
            Upload, inspect, transform, and export datasets across all pipeline stages.
          </p>
        </div>

        {/* Upload Button Trigger */}
        {onUploadClick ? (
          <button
            onClick={onUploadClick}
            disabled={uploading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: uploading ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(37,99,235,0.2)',
            }}
          >
            <Upload size={14} />
            <span>Upload Datasets</span>
          </button>
        ) : (
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#2563eb',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 600,
            padding: '8px 16px',
            borderRadius: 6,
            cursor: uploading ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 3px rgba(37,99,235,0.2)',
          }}>
            <Upload size={14} />
            <span>{uploading ? 'Uploading...' : 'Upload Datasets'}</span>
            <input
              type="file"
              multiple
              accept=".csv,.parquet,.json,.jsonl,.xlsx,.xls,.tsv"
              onChange={handleFileUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
        )}
      </div>

      {/* Datasets Table */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 10,
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Dataset Label</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Stage</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Records</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Features</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Created</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((ds) => {
              const isActive = ds.id === activeDatasetId;
              return (
                <tr
                  key={ds.id}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: isActive ? '#f0f9ff' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileSpreadsheet size={15} color={isActive ? '#2563eb' : '#64748b'} />
                      <span>{ds.label}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      backgroundColor: ds.stage === 'cleaned' ? '#dcfce7' : '#fee2e2',
                      color: ds.stage === 'cleaned' ? '#16a34a' : '#ef4444',
                      textTransform: 'uppercase',
                    }}>
                      {ds.stage}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>
                    {ds.records.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>
                    {ds.features}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 11 }}>
                    {ds.created_at || 'Initial'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {isActive ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#0284c7',
                      }}>
                        <Check size={13} /> Active
                      </span>
                    ) : (
                      <button
                        onClick={() => onSelectDataset(ds.id)}
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: '#2563eb',
                          backgroundColor: '#eff6ff',
                          padding: '3px 8px',
                          borderRadius: 4,
                        }}
                      >
                        Set Active
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      <button
                        onClick={() => (onPreviewDataset ? onPreviewDataset(ds.id) : handleOpenPreview(ds.id))}
                        title="Preview Table"
                        style={{
                          padding: 5,
                          borderRadius: 4,
                          color: '#475569',
                          backgroundColor: '#f1f5f9',
                          cursor: 'pointer',
                        }}
                      >
                        <Eye size={14} />
                      </button>
                      <a
                        href={getDownloadUrl(ds.id, 'csv')}
                        download
                        title="Download CSV"
                        style={{
                          padding: 5,
                          borderRadius: 4,
                          color: '#475569',
                          backgroundColor: '#f1f5f9',
                          display: 'inline-flex',
                        }}
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Preview Modal */}
      {previewData && (
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
            borderRadius: 12,
            width: '95vw',
            maxWidth: 1100,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                  {previewData.label} ({previewData.records.toLocaleString()} rows × {previewData.features} cols)
                </h3>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  Stage: {previewData.stage.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <a
                  href={getDownloadUrl(previewData.id, 'csv')}
                  download
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#2563eb',
                    backgroundColor: '#eff6ff',
                    padding: '6px 12px',
                    borderRadius: 6,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Download size={13} /> Export CSV
                </a>
                <button
                  onClick={() => setPreviewData(null)}
                  style={{ color: '#64748b', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content Table */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {previewData.columns.map((col) => (
                      <th key={col.name} style={{ padding: '8px 10px', textAlign: 'left', color: '#334155' }}>
                        <div>{col.name}</div>
                        <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 400 }}>{col.type}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {previewData.columns.map((col) => (
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
        </div>
      )}
    </div>
  );
};
