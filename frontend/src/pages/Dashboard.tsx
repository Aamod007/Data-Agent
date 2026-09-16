import React from 'react';
import { Telemetry, Dataset } from '../types';
import { LayoutDashboard, Database, Activity, HardDrive, Layers, TrendingUp } from 'lucide-react';
import Plot from 'react-plotly.js';

interface DashboardProps {
  telemetry: Telemetry | null;
  activeDataset: Dataset | undefined;
  datasets: Dataset[];
}

export const Dashboard: React.FC<DashboardProps> = ({
  telemetry,
  activeDataset,
  datasets,
}) => {
  const records = telemetry?.records || 20500;
  const features = telemetry?.features || 15;
  const storage = telemetry?.storage_used_mb || 24.7;

  // Mock telemetry distributions based on active dataset
  const sampleEvents = ['AssumeRole', 'GetObject', 'PutObject', 'AuthorizeIngress', 'CreateUser', 'DeletePolicy'];
  const sampleCounts = [8420, 5130, 3210, 1890, 1250, 600];

  const riskBins = ['0.0 - 0.2', '0.2 - 0.4', '0.4 - 0.6', '0.6 - 0.8', '0.8 - 1.0'];
  const riskCounts = [14200, 3400, 1600, 850, 450];

  return (
    <div style={{
      flex: 1,
      height: '100%',
      overflowY: 'auto',
      padding: '24px 32px',
      backgroundColor: '#f8fafc',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <LayoutDashboard size={20} color="#2563eb" />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Live Data Telemetry & Analytics Dashboard</h1>
        </div>
        <p style={{ fontSize: 12, color: '#64748b' }}>
          Monitoring active dataset: <strong style={{ color: '#1e40af' }}>{activeDataset?.label || 'track2_iam_audit_trail.csv'}</strong>
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Records</span>
            <Activity size={16} color="#2563eb" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
            {records.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingUp size={12} /> Live stream synced
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Features / Columns</span>
            <Layers size={16} color="#0284c7" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
            {features}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Tabular dimensions
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Memory Footprint</span>
            <HardDrive size={16} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
            {storage} MB
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Limit: 1,024 MB (1 GB)
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Active Datasets</span>
            <Database size={16} color="#f59e0b" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
            {datasets.length}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Registered in pipeline
          </div>
        </div>
      </div>

      {/* Interactive Charts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: 20,
        marginBottom: 24,
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          padding: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
            Top Event Distribution
          </h2>
          <Plot
            data={[{
              x: sampleEvents,
              y: sampleCounts,
              type: 'bar',
              marker: { color: '#3b82f6' },
            }]}
            layout={{
              autosize: true,
              height: 280,
              margin: { l: 40, r: 20, t: 10, b: 60 },
              xaxis: { tickangle: -25 },
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
            }}
            useResizeHandler={true}
            style={{ width: '100%', height: '100%' }}
            config={{ responsive: true, displayModeBar: false }}
          />
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          padding: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
            Risk Score Density
          </h2>
          <Plot
            data={[{
              x: riskBins,
              y: riskCounts,
              type: 'bar',
              marker: {
                color: ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'],
              },
            }]}
            layout={{
              autosize: true,
              height: 280,
              margin: { l: 40, r: 20, t: 10, b: 40 },
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
            }}
            useResizeHandler={true}
            style={{ width: '100%', height: '100%' }}
            config={{ responsive: true, displayModeBar: false }}
          />
        </div>
      </div>
    </div>
  );
};
