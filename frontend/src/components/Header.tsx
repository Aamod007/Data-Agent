import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, LayoutGrid, PanelLeft, Database, Check } from 'lucide-react';
import { Dataset } from '../types';

interface HeaderProps {
  activeDataset: Dataset | undefined;
  datasets: Dataset[];
  onSelectDataset: (id: string) => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeDataset,
  datasets,
  onSelectDataset,
  onToggleSidebar,
}) => {
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Hide header completely on /chat route to remove all chat navbar content matching Streamlit
  const isChat = location.pathname === '/chat' || location.pathname === '/';
  if (isChat) {
    return null;
  }

  // Get current section name
  const path = location.pathname.replace('/', '') || 'Workspace';
  const sectionName = path.charAt(0).toUpperCase() + path.slice(1);

  return (
    <header style={{
      height: 48,
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      flexShrink: 0,
      position: 'relative',
      zIndex: 20,
    }}>
      <div style={{ width: 80 }} />

      {/* Center Breadcrumb */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            fontSize: 12,
            color: '#334155',
            fontWeight: 500,
          }}
        >
          <span style={{ color: '#64748b' }}>{sectionName}</span>
          <span style={{ color: '#94a3b8' }}>&gt;</span>
          <span style={{
            fontWeight: 600,
            color: '#0f172a',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {activeDataset?.label || 'No dataset selected'}
          </span>
          <ChevronDown size={14} color="#64748b" />
        </button>

        {dropdownOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 4,
            width: 280,
            backgroundColor: '#ffffff',
            borderRadius: 8,
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.05)',
            border: '1px solid #e2e8f0',
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            zIndex: 50,
          }}>
            <div style={{
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
            }}>
              Switch Active Dataset
            </div>
            {datasets.map((ds) => {
              const isCurrent = ds.id === activeDataset?.id;
              return (
                <div
                  key={ds.id}
                  onClick={() => {
                    onSelectDataset(ds.id);
                    setDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                    backgroundColor: isCurrent ? '#eff6ff' : 'transparent',
                    color: isCurrent ? '#1d4ed8' : '#334155',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    <Database size={13} color={isCurrent ? '#2563eb' : '#94a3b8'} />
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 180,
                      fontWeight: isCurrent ? 600 : 400,
                    }}>
                      {ds.label}
                    </span>
                  </div>
                  {isCurrent && <Check size={14} color="#2563eb" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Utility Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          title="Grid view"
          style={{
            padding: 6,
            borderRadius: 6,
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LayoutGrid size={16} />
        </button>
        <button
          onClick={onToggleSidebar}
          title="Toggle panel"
          style={{
            padding: 6,
            borderRadius: 6,
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PanelLeft size={16} />
        </button>
      </div>
    </header>
  );
};
