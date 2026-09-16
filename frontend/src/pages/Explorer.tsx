import React, { useState, useEffect } from 'react';
import { Dataset, DatasetPreview } from '../types';
import { fetchDatasetPreview, getDownloadUrl } from '../api';
import { Table as TableIcon, Search, Download, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';

interface ExplorerProps {
  activeDataset: Dataset | undefined;
}

export const Explorer: React.FC<ExplorerProps> = ({ activeDataset }) => {
  const [data, setData] = useState<DatasetPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (activeDataset?.id) {
      loadData(activeDataset.id, page);
    }
  }, [activeDataset?.id, page]);

  const loadData = async (id: string, pg: number) => {
    setLoading(true);
    try {
      const res = await fetchDatasetPreview(id, pg, 50);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = (data?.rows || []).filter((row) => {
    if (!searchTerm) return true;
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div style={{
      flex: 1,
      height: '100%',
      overflowY: 'auto',
      padding: '24px 32px',
      backgroundColor: '#f8fafc',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <TableIcon size={20} color="#2563eb" />
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
              Data Explorer & Profiler
            </h1>
          </div>
          <p style={{ fontSize: 12, color: '#64748b' }}>
            Interactive tabular inspection of: <strong style={{ color: '#1e40af' }}>{activeDataset?.label || 'dataset'}</strong>
          </p>
        </div>

        {activeDataset && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              href={getDownloadUrl(activeDataset.id, 'csv')}
              download
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#334155',
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 6,
                textDecoration: 'none',
              }}
            >
              <Download size={13} /> Export CSV
            </a>
          </div>
        )}
      </div>

      {/* Column Schema / Profile Pills */}
      {data?.columns && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          padding: 16,
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <BarChart3 size={15} color="#2563eb" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Column Profiles ({data.columns.length} features)</span>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}>
            {data.columns.map((col) => (
              <div
                key={col.name}
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 11,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{col.name}</div>
                <div style={{ display: 'flex', gap: 8, color: '#64748b', fontSize: 10 }}>
                  <span>type: <strong style={{ color: '#2563eb' }}>{col.type}</strong></span>
                  <span>nulls: {col.missing_pct}%</span>
                  <span>unique: {col.unique}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Table with Search and Pagination */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 10,
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}>
        {/* Table Controls Bar */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ position: 'relative', width: 260 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 8, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search table rows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '5px 10px 5px 30px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#64748b' }}>
            <span>Page {data?.page || 1} of {data?.total_pages || 1}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                style={{
                  padding: 4,
                  borderRadius: 4,
                  border: '1px solid #e2e8f0',
                  color: page <= 1 ? '#cbd5e1' : '#334155',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={!data || page >= data.total_pages}
                style={{
                  padding: 4,
                  borderRadius: 4,
                  border: '1px solid #e2e8f0',
                  color: !data || page >= data.total_pages ? '#cbd5e1' : '#334155',
                  cursor: !data || page >= data.total_pages ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {data?.columns?.map((col) => (
                  <th key={col.name} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {data?.columns?.map((col) => (
                    <td key={col.name} style={{ padding: '8px 12px', color: '#1e293b' }}>
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
  );
};
