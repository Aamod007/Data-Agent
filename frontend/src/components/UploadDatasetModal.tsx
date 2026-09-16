import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { uploadDataset, selectDataset } from '../api';

interface UploadDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (datasetId: string) => void;
}

export const UploadDatasetModal: React.FC<UploadDatasetModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFiles([]);
      setError(null);
      setSuccessMsg(null);
      setUploading(false);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !uploading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, uploading, onClose]);

  if (!isOpen) return null;

  const addFiles = (newFiles: FileList | File[]) => {
    const validFiles: File[] = [];
    Array.from(newFiles).forEach((f) => {
      // Avoid duplicate names in the current selection
      if (!selectedFiles.some((existing) => existing.name === f.name && existing.size === f.size)) {
        validFiles.push(f);
      }
    });
    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);
      setError(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    // reset input so same file can be re-selected if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one dataset to upload.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const res = await uploadDataset(selectedFiles);
      const count = res.uploaded_count || selectedFiles.length;
      setSuccessMsg(`Successfully uploaded and registered ${count} dataset${count > 1 ? 's' : ''}! Activating...`);

      // Automatically select latest dataset
      if (res.dataset_id) {
        await selectDataset(res.dataset_id);
      }

      setTimeout(() => {
        onSuccess(res.dataset_id);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Failed to upload datasets. Please verify file formats.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 14,
          width: '100%',
          maxWidth: 580,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              <Upload size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Upload Multiple Datasets
              </h2>
              <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0 0' }}>
                Select one or multiple CSV, Parquet, JSON, or Excel files
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              padding: 6,
              borderRadius: 6,
              cursor: uploading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#2563eb' : '#cbd5e1'}`,
              borderRadius: 12,
              padding: selectedFiles.length > 0 ? '20px 16px' : '32px 20px',
              textAlign: 'center',
              backgroundColor: dragOver ? '#eff6ff' : '#f8fafc',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv,.parquet,.json,.jsonl,.xlsx,.xls,.tsv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              {selectedFiles.length > 0 ? <Plus size={22} /> : <Upload size={22} />}
            </div>

            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>
                {selectedFiles.length > 0
                  ? 'Click to add more files, or drag & drop here'
                  : 'Click to select multiple datasets, or drag and drop'}
              </div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 3 }}>
                You can select multiple files at once (CSV, Parquet, JSON, TSV, Excel)
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {['CSV', 'PARQUET', 'JSON', 'EXCEL'].map((fmt) => (
                <span
                  key={fmt}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#64748b',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  {fmt}
                </span>
              ))}
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                  Selected Files ({selectedFiles.length}) • {formatFileSize(totalBytes)}
                </span>
                <button
                  onClick={() => setSelectedFiles([])}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Clear all
                </button>
              </div>

              <div
                style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderBottom: idx < selectedFiles.length - 1 ? '1px solid #f1f5f9' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <FileSpreadsheet size={16} color="#2563eb" />
                      <div style={{ overflow: 'hidden' }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 340,
                          }}
                        >
                          {file.name}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#64748b' }}>
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => removeFile(idx)}
                      title="Remove file"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Notice */}
          {error && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                borderRadius: 8,
                border: '1px solid #fee2e2',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: '#dc2626',
              }}
            >
              <AlertCircle size={16} flex-shrink="0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Notice */}
          {successMsg && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#f0fdf4',
                borderRadius: 8,
                border: '1px solid #dcfce7',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: '#16a34a',
              }}
            >
              <CheckCircle2 size={16} flex-shrink="0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 11.5, color: '#64748b' }}>
            {selectedFiles.length > 0 ? (
              <span>
                <strong>{selectedFiles.length}</strong> file{selectedFiles.length > 1 ? 's' : ''} ready ({formatFileSize(totalBytes)})
              </span>
            ) : (
              <span>No files selected</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={onClose}
              disabled={uploading}
              style={{
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 500,
                color: '#475569',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                cursor: uploading ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploading}
              style={{
                padding: '8px 18px',
                fontSize: 12,
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: selectedFiles.length === 0 || uploading ? '#94a3b8' : '#2563eb',
                border: 'none',
                borderRadius: 6,
                cursor: selectedFiles.length === 0 || uploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: selectedFiles.length === 0 || uploading ? 'none' : '0 1px 3px rgba(37,99,235,0.25)',
                transition: 'background-color 0.15s ease',
              }}
            >
              {uploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Uploading {selectedFiles.length} dataset{selectedFiles.length > 1 ? 's' : ''}...</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>
                    Upload & Register{selectedFiles.length > 0 ? ` (${selectedFiles.length})` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
