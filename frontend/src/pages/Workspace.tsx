import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Send,
  Sparkles,
  Copy,
  Check,
  ChevronRight,
  Code2,
  Table as TableIcon,
  RefreshCw,
  ExternalLink,
  Bot,
  User,
  Info,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ChatMessage, Dataset } from '../types';
import { sendChatMessage, clearChat } from '../api';
import Plot from 'react-plotly.js';

interface WorkspaceProps {
  activeDataset: Dataset | undefined;
  datasets?: Dataset[];
  messages: ChatMessage[];
  onMessagesChange: (msgs: ChatMessage[]) => void;
  onRefreshTelemetry: () => void;
  onUploadClick: () => void;
  onSelectDataset?: (id: string) => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  activeDataset,
  datasets = [],
  messages,
  onMessagesChange,
  onRefreshTelemetry,
  onUploadClick,
  onSelectDataset,
}) => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('SUPERVISOR');
  const [autoRoute, setAutoRoute] = useState(true);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const datasetName = activeDataset?.label || 'None';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!prompt.trim() || loading) return;
    const textToSend = prompt.trim();
    setPrompt('');
    setLoading(true);

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      active_dataset_id: activeDataset?.id,
    };

    // Optimistically add user message immediately
    const newMessages = [...messages, userMsg];
    onMessagesChange(newMessages);

    try {
      const assistantMsg = await sendChatMessage(
        textToSend,
        selectedAgent.toLowerCase(),
        autoRoute,
        activeDataset?.id
      );
      onMessagesChange([...newMessages, assistantMsg]);
      onRefreshTelemetry();
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        agent: 'SYSTEM',
        content: `Error: ${err.message || 'Failed to process request'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      onMessagesChange([...newMessages, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const toggleThoughts = (id: string) => {
    setExpandedThoughts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleClear = async () => {
    try {
      await clearChat();
      onMessagesChange([]);
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  // Markdown rendering helper matching Streamlit's rich text (with emojis strictly stripped)
  const stripEmojis = (str: string) => {
    if (!str) return '';
    return str
      .replace(
        /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
        ''
      )
      .replace(/[ \t]+/g, ' ')
      .trim();
  };

  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const cleanedText = stripEmojis(text);
    const lines = cleanedText.split('\n');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} style={{ height: 4 }} />;

          // Headings
          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} style={{ fontSize: 13, fontWeight: 700, margin: '6px 0 2px', color: '#0f172a' }}>
                {trimmed.replace('### ', '')}
              </h4>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={idx} style={{ fontSize: 14, fontWeight: 700, margin: '8px 0 4px', color: '#0f172a' }}>
                {trimmed.replace('## ', '')}
              </h3>
            );
          }
          if (trimmed.startsWith('# ')) {
            return (
              <h2 key={idx} style={{ fontSize: 15, fontWeight: 700, margin: '10px 0 4px', color: '#0f172a' }}>
                {trimmed.replace('# ', '')}
              </h2>
            );
          }

          // Bullet items
          const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
          const contentText = isBullet ? trimmed.substring(2) : line;

          const renderFormattedSpans = (str: string) => {
            const parts = str.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g);
            return parts.map((part, pidx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={pidx}>{part.slice(2, -2)}</strong>;
              }
              if (part.startsWith('`') && part.endsWith('`')) {
                return (
                  <code
                    key={pidx}
                    style={{
                      backgroundColor: '#f1f5f9',
                      padding: '1px 5px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      color: '#0369a1',
                    }}
                  >
                    {part.slice(1, -1)}
                  </code>
                );
              }
              if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
                const linkText = part.substring(1, part.indexOf(']('));
                const linkUrl = part.substring(part.indexOf('](') + 2, part.length - 1);
                return (
                  <a
                    key={pidx}
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 600 }}
                  >
                    {linkText}
                  </a>
                );
              }
              return part;
            });
          };

          if (isBullet) {
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, paddingLeft: 6 }}>
                <span style={{ color: '#2563eb', fontWeight: 700 }}>•</span>
                <div>{renderFormattedSpans(contentText)}</div>
              </div>
            );
          }

          return <div key={idx}>{renderFormattedSpans(contentText)}</div>;
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8fafc',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ============================================================ */}
      {/* MAIN CONVERSATION STREAM */}
      {/* ============================================================ */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 20px 140px 20px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.length === 0 ? (
          /* Streamlit Empty State Greeting */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              paddingBottom: 40,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
                marginBottom: 16,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)',
              }}
            >
              <Bot size={26} strokeWidth={1.8} />
            </div>

            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                marginBottom: 8,
              }}
            >
              How can Vector X help today?
            </h1>

            <p
              style={{
                fontSize: 13,
                color: '#64748b',
                lineHeight: 1.6,
                maxWidth: 520,
                marginBottom: 24,
              }}
            >
              Your AI-powered data science companion — ready to analyze, model, and visualize.
            </p>

            {/* Quick starter prompts matching Streamlit capabilities */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                maxWidth: 620,
                justifyContent: 'center',
              }}
            >
              {[
                `Show distribution chart of ${activeDataset?.label || 'active dataset'}`,
                'Clean missing values and outlier detection',
                'Generate exploratory EDA summary & Sweetviz dashboard',
                'What are the key numerical correlations?',
                'Engineer features and train AutoML models',
                'connect to data/northwind.db',
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setPrompt(suggestion)}
                  style={{
                    fontSize: 12,
                    color: '#334155',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    padding: '6px 14px',
                    borderRadius: 18,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#93c5fd';
                    e.currentTarget.style.color = '#1d4ed8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.color = '#334155';
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages List */
          <div
            style={{
              maxWidth: 880,
              width: '100%',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    width: '100%',
                  }}
                >
                  {/* Sender Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      color: isUser ? '#64748b' : '#2563eb',
                    }}
                  >
                    {isUser ? <User size={12} /> : <Sparkles size={12} />}
                    <span>{isUser ? 'You' : (msg.agent && msg.agent !== 'SUPERVISOR' && msg.agent !== 'WORKFLOW_PLANNER_AGENT' ? msg.agent : 'Vector X')}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>{msg.timestamp}</span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    style={{
                      maxWidth: '92%',
                      backgroundColor: isUser ? '#2563eb' : '#ffffff',
                      color: isUser ? '#ffffff' : '#0f172a',
                      padding: '14px 18px',
                      borderRadius: 10,
                      border: isUser ? 'none' : '1px solid #e2e8f0',
                      boxShadow: isUser ? '0 2px 6px rgba(37, 99, 235, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
                      fontSize: 13.5,
                      lineHeight: 1.6,
                    }}
                  >
                    {/* Expandable Thoughts */}
                    {!isUser && msg.thoughts && msg.thoughts.length > 0 && (
                      <div
                        style={{
                          marginBottom: 10,
                          borderBottom: '1px solid #f1f5f9',
                          paddingBottom: 8,
                        }}
                      >
                        <button
                          onClick={() => toggleThoughts(msg.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            color: '#64748b',
                            fontWeight: 600,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          <ChevronRight
                            size={12}
                            style={{
                              transform: expandedThoughts[msg.id] ? 'rotate(90deg)' : 'none',
                              transition: 'transform 0.15s ease',
                            }}
                          />
                          Agent Reasoning ({msg.thoughts.length} steps)
                        </button>
                        {expandedThoughts[msg.id] && (
                          <div
                            style={{
                              marginTop: 6,
                              padding: '8px 12px',
                              backgroundColor: '#f8fafc',
                              borderRadius: 6,
                              fontSize: 11,
                              color: '#475569',
                              fontFamily: 'var(--font-mono)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                            }}
                          >
                            {msg.thoughts.map((th, i) => (
                              <div key={i}>• {th}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Rich Markdown Content */}
                    {isUser ? (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    ) : (
                      renderMarkdown(msg.content)
                    )}

                    {/* Executed Code Block */}
                    {msg.code && msg.code.trim().length > 0 && !msg.code.startsWith('# Current active dataset') && (
                      <div
                        style={{
                          marginTop: 12,
                          backgroundColor: '#0f172a',
                          borderRadius: 8,
                          overflow: 'hidden',
                          color: '#e2e8f0',
                          fontSize: 12,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 12px',
                            backgroundColor: '#1e293b',
                            borderBottom: '1px solid #334155',
                            fontSize: 11,
                            color: '#94a3b8',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Code2 size={13} color="#38bdf8" />
                            <span>Python / SQL Executor</span>
                          </div>
                          <button
                            onClick={() => handleCopyCode(msg.id, msg.code!)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              color: '#cbd5e1',
                              fontSize: 11,
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            {copiedCodeId === msg.id ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                            <span>{copiedCodeId === msg.id ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <pre style={{ padding: 12, overflowX: 'auto', margin: 0, fontFamily: 'var(--font-mono)', lineHeight: 1.45 }}>
                          {msg.code}
                        </pre>
                      </div>
                    )}

                    {/* Plotly Figure */}
                    {msg.plotly_spec && (
                      <div
                        style={{
                          marginTop: 12,
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: 10,
                        }}
                      >
                        <Plot
                          data={msg.plotly_spec.data || []}
                          layout={{
                            ...msg.plotly_spec.layout,
                            autosize: true,
                            width: undefined,
                            height: 380,
                            margin: { l: 40, r: 20, t: 40, b: 40 },
                          }}
                          useResizeHandler={true}
                          style={{ width: '100%', height: '100%' }}
                          config={{ responsive: true, displayModeBar: false }}
                        />
                      </div>
                    )}

                    {/* Dataframe Preview Table */}
                    {msg.dataframe_preview && msg.dataframe_preview.length > 0 && (
                      <div
                        style={{
                          marginTop: 12,
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          overflowX: 'auto',
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <div
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#f8fafc',
                            borderBottom: '1px solid #e2e8f0',
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <TableIcon size={13} color="#2563eb" />
                          <span>Generated Output Preview (First {msg.dataframe_preview.length} rows)</span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                              {Object.keys(msg.dataframe_preview[0]).slice(0, 8).map((col) => (
                                <th key={col} style={{ padding: '6px 10px', textAlign: 'left', color: '#475569' }}>
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.dataframe_preview.map((row, rIdx) => (
                              <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                {Object.values(row).slice(0, 8).map((val: any, cidx) => (
                                  <td key={cidx} style={{ padding: '6px 10px', color: '#1e293b' }}>
                                    {String(val ?? '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Streamlit-Style Analysis Details Expander - only when actual artifacts or analysis deliverables were produced */}
                    {!isUser && Boolean(
                      (msg.dataframe_preview && msg.dataframe_preview.length > 0) ||
                      msg.plotly_spec ||
                      (msg.code && msg.code.trim().length > 0 && !msg.code.startsWith('# Current active dataset'))
                    ) && (
                      <div
                        style={{
                          marginTop: 10,
                          paddingTop: 8,
                          borderTop: '1px solid #f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          Artifacts & lineage tracked
                        </span>
                        <button
                          onClick={() => navigate('/results')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#2563eb',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <ExternalLink size={12} /> View Analysis Details
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading Spinner */}
            {loading && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  backgroundColor: '#ffffff',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  width: 'fit-content',
                  fontSize: 12,
                  color: '#2563eb',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    border: '2px solid #93c5fd',
                    borderTopColor: '#2563eb',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <span>Vector X is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* STREAMLIT-PARITY DOCKED CHAT INPUT BAR */}
      {/* ============================================================ */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 48px)',
          maxWidth: 880,
          backgroundColor: '#ffffff',
          borderRadius: 12,
          border: '1px solid #cbd5e1',
          boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask Vector X about ${datasetName}...`}
            rows={2}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: 13,
              color: '#0f172a',
              backgroundColor: 'transparent',
              lineHeight: 1.5,
              padding: '4px',
            }}
          />

          <button
            onClick={handleSend}
            disabled={!prompt.trim() || loading}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: prompt.trim() && !loading ? '#2563eb' : '#e2e8f0',
              color: prompt.trim() && !loading ? '#ffffff' : '#94a3b8',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: prompt.trim() && !loading ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.15s ease',
              flexShrink: 0,
            }}
          >
            <Send size={16} />
          </button>
        </div>

        {/* Footer info row matching Streamlit caption */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 10.5,
            color: '#94a3b8',
            padding: '0 4px',
          }}
        >
          <span>Press Enter to send, Shift + Enter for new line</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                title="Clear conversation history"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: 10.5,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: 0,
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
              >
                <RefreshCw size={10} /> Clear chat
              </button>
            )}
            <span>Target: {activeDataset ? activeDataset.label : 'None'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
