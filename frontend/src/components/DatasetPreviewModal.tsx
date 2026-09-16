import React, { useState, useEffect } from 'react';
import {
  X,
  Table as TableIcon,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { fetchDatasetPreview, getDownloadUrl } from '../api';
import { DatasetPreview } from '../types';

interface DatasetPreviewModalProps {
  datasetId: string | null;
  onClose: () => void;
}

export const DatasetPreviewModal: React.FC<DatasetPreviewModalProps> = ({ datasetId, onClose }) => {
  const [data, setData] = useState<DatasetPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');

  // Load preview data when datasetId, page, or limit changes
  useEffect(() => {
    if (!datasetId) {
      setData(null);
      return;
    }
    loadData(datasetId, page, limit);
  }, [datasetId, page, limit]);

  // Reset page to 1 when datasetId changes
  useEffect(() => {
    setPage(1);
    setSearchQuery('');
  }, [datasetId]);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const loadData = async (id: string, pg: number, lim: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDatasetPreview(id, pg, lim);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dataset preview');
    } finally {
      setLoading(false);
    }
  };

  if (!datasetId) return null;

  // Client-side quick filter on currently loaded rows
  const filteredRows = (data?.rows || []).filter((row) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(row).some((val) => String(val ?? '').toLowerCase().includes(q));
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.records / limit)) : 1;
  const startRow = (page - 1) * limit + 1;
  const endRow = data ? Math.min(page * limit, data.records) : 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 14,
          width: '95vw',
          maxWidth: 1200,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#0f172a',
                    margin: 0,
                  }}
                >
                  {data?.label || 'Dataset Preview'}
                </h2>
                {data && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      backgroundColor: data.stage === 'cleaned' ? '#dcfce7' : '#fee2e2',
                      color: data.stage === 'cleaned' ? '#16a34a' : '#ef4444',
                      textTransform: 'uppercase',
                    }}
                  >
                    {data.stage}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0 0' }}>
                {data ? (
                  <>
                    <strong>{data.records.toLocaleString()}</strong> rows ×{' '}
                    <strong>{data.features}</strong> columns (ID: <code>{data.id}</code>)
                  </>
                ) : (
                  'Fetching dataset dimensions and schema...'
                )}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {data && (
              <a
                href={getDownloadUrl(data.id, 'csv')}
                download
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#2563eb',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  padding: '7px 14px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <Download size={14} /> Export CSV
              </a>
            )}
            <button
              onClick={onClose}
              title="Close preview (Esc)"
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                padding: 6,
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar: Search filter + Pagination limit */}
        <div
          style={{
            padding: '10px 24px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          {/* Quick Filter */}
          <div style={{ position: 'relative', width: 280 }}>
            <Search
              size={13}
              style={{ position: 'absolute', left: 10, top: 9, color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Search current page rows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                outline: 'none',
              }}
            />
          </div>

          {/* Rows per page selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}>
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 12,
                backgroundColor: '#ffffff',
                color: '#0f172a',
                cursor: 'pointer',
              }}
            >
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
          </div>
        </div>

        {/* Table Content Area */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative', minHeight: 320 }}>
          {loading ? (
            <div
              style={{
                height: 380,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                color: '#2563eb',
              }}
            >
              <Loader2 size={32} className="animate-spin" />
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                Loading dataset preview rows...
              </span>
            </div>
          ) : error ? (
            <div
              style={{
                height: 380,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: 24,
                textAlign: 'center',
              }}
            >
              <AlertCircle size={36} color="#ef4444" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                Unable to load preview
              </span>
              <p style={{ fontSize: 12, color: '#64748b', maxWidth: 400 }}>{error}</p>
              <button
                onClick={() => loadData(datasetId, page, limit)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#ffffff',
                  backgroundColor: '#2563eb',
                  border: 'none',
                  padding: '7px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          ) : data && data.columns.length > 0 ? (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 11.5,
                textAlign: 'left',
              }}
            >
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f1f5f9' }}>
                <tr>
                  <th
                    style={{
                      padding: '10px 12px',
                      color: '#64748b',
                      borderBottom: '1px solid #cbd5e1',
                      width: 50,
                      fontWeight: 600,
                    }}
                  >
                    #
                  </th>
                  {data.columns.map((col) => (
                    <th
                      key={col.name}
                      style={{
                        padding: '10px 12px',
                        color: '#1e293b',
                        borderBottom: '1px solid #cbd5e1',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{col.name}</div>
                      <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 500 }}>
                        {col.type}
                        {col.missing > 0 && (
                          <span style={{ color: '#ef4444', marginLeft: 4 }}>
                            ({col.missing} null)
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={data.columns.length + 1}
                      style={{ textAlign: 'center', padding: 40, color: '#64748b' }}
                    >
                      No rows match search filter '{searchQuery}'.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: rIdx % 2 === 0 ? '#ffffff' : '#fafafa',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          rIdx % 2 === 0 ? '#ffffff' : '#fafafa')
                      }
                    >
                      <td
                        style={{
                          padding: '7px 12px',
                          color: '#94a3b8',
                          fontSize: 10.5,
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {startRow + rIdx}
                      </td>
                      {data.columns.map((col) => {
                        const val = row[col.name];
                        const isNull = val === null || val === undefined;
                        return (
                          <td
                            key={col.name}
                            style={{
                              padding: '7px 12px',
                              color: isNull ? '#94a3b8' : '#334155',
                              fontStyle: isNull ? 'italic' : 'normal',
                              whiteSpace: 'nowrap',
                              maxWidth: 320,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {isNull ? 'null' : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              No preview data available for this dataset.
            </div>
          )}
        </div>

        {/* Modal Footer with Pagination Controls */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {data && (
              <span>
                Showing <strong>{startRow.toLocaleString()}</strong>–
                <strong>{endRow.toLocaleString()}</strong> of{' '}
                <strong>{data.records.toLocaleString()}</strong> records
              </span>
            )}
          </div>

          {/* Pagination Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1 || loading}
              title="First Page"
              style={{
                padding: '5px 8px',
                borderRadius: 5,
                border: '1px solid #cbd5e1',
                backgroundColor: page <= 1 ? '#f8fafc' : '#ffffff',
                color: page <= 1 ? '#cbd5e1' : '#334155',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              title="Previous Page"
              style={{
                padding: '5px 8px',
                borderRadius: 5,
                border: '1px solid #cbd5e1',
                backgroundColor: page <= 1 ? '#f8fafc' : '#ffffff',
                color: page <= 1 ? '#cbd5e1' : '#334155',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronLeft size={14} />
            </button>

            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', padding: '0 8px' }}>
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              title="Next Page"
              style={{
                padding: '5px 8px',
                borderRadius: 5,
                border: '1px solid #cbd5e1',
                backgroundColor: page >= totalPages ? '#f8fafc' : '#ffffff',
                color: page >= totalPages ? '#cbd5e1' : '#334155',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || loading}
              title="Last Page"
              style={{
                padding: '5px 8px',
                borderRadius: 5,
                border: '1px solid #cbd5e1',
                backgroundColor: page >= totalPages ? '#f8fafc' : '#ffffff',
                color: page >= totalPages ? '#cbd5e1' : '#334155',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronsRight size={14} />
            </button>

            <button
              onClick={onClose}
              style={{
                marginLeft: 16,
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#334155',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
