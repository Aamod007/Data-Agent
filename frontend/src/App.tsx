import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Workspace } from './pages/Workspace';
import { Dashboard } from './pages/Dashboard';
import { Datasets } from './pages/Datasets';
import { PipelineStudio } from './pages/PipelineStudio';
import { Results } from './pages/Results';
import { Settings } from './pages/Settings';
import { DatasetPreviewModal } from './components/DatasetPreviewModal';
import { UploadDatasetModal } from './components/UploadDatasetModal';
import { Dataset, Telemetry, ChatMessage } from './types';
import { fetchTelemetry, fetchDatasets, selectDataset, fetchChatHistory } from './api';

function AppContent() {
  const navigate = useNavigate();
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [previewDatasetId, setPreviewDatasetId] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [tel, dsList, hist] = await Promise.all([
        fetchTelemetry(),
        fetchDatasets(),
        fetchChatHistory(),
      ]);
      setTelemetry(tel);
      setDatasets(dsList.datasets);
      setActiveDatasetId(dsList.active_dataset_id);
      setMessages(hist.messages);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  const refreshTelemetry = async () => {
    try {
      const [tel, dsList] = await Promise.all([
        fetchTelemetry(),
        fetchDatasets(),
      ]);
      setTelemetry(tel);
      setDatasets(dsList.datasets);
      setActiveDatasetId(dsList.active_dataset_id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectDataset = async (id: string) => {
    try {
      await selectDataset(id);
      setActiveDatasetId(id);
      await refreshTelemetry();
    } catch (err) {
      console.error(err);
    }
  };

  const activeDataset = datasets.find((d) => d.id === activeDatasetId);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {sidebarOpen && (
        <Sidebar
          telemetry={telemetry}
          datasets={datasets}
          activeDatasetId={activeDatasetId}
          onSelectDataset={handleSelectDataset}
          onUploadClick={() => setUploadModalOpen(true)}
          onPreviewDataset={setPreviewDatasetId}
        />
      )}

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        <Header
          activeDataset={activeDataset}
          datasets={datasets}
          onSelectDataset={handleSelectDataset}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <main style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route
              path="/chat"
              element={
                <Workspace
                  activeDataset={activeDataset}
                  datasets={datasets}
                  messages={messages}
                  onMessagesChange={setMessages}
                  onRefreshTelemetry={refreshTelemetry}
                  onUploadClick={() => setUploadModalOpen(true)}
                  onSelectDataset={handleSelectDataset}
                />
              }
            />
            <Route
              path="/dashboard"
              element={
                <Dashboard
                  telemetry={telemetry}
                  activeDataset={activeDataset}
                  datasets={datasets}
                />
              }
            />
            <Route
              path="/datasets"
              element={
                <Datasets
                  datasets={datasets}
                  activeDatasetId={activeDatasetId}
                  onRefresh={refreshTelemetry}
                  onSelectDataset={handleSelectDataset}
                  onPreviewDataset={setPreviewDatasetId}
                  onUploadClick={() => setUploadModalOpen(true)}
                />
              }
            />
            <Route
              path="/upload"
              element={<Navigate to="/datasets" replace />}
            />
            <Route
              path="/explorer"
              element={<Navigate to="/datasets" replace />}
            />
            <Route
              path="/pipeline"
              element={<PipelineStudio onRefreshTelemetry={refreshTelemetry} />}
            />
            <Route
              path="/pipeline-studio"
              element={<Navigate to="/pipeline" replace />}
            />
            <Route
              path="/results"
              element={
                <Results
                  activeDataset={activeDataset}
                  datasets={datasets}
                  onSelectDataset={handleSelectDataset}
                  onRefreshTelemetry={refreshTelemetry}
                />
              }
            />
            <Route
              path="/settings"
              element={<Settings />}
            />
          </Routes>
        </main>
      </div>

      {/* Global Dataset Preview Modal */}
      <DatasetPreviewModal
        datasetId={previewDatasetId}
        onClose={() => setPreviewDatasetId(null)}
      />

      {/* Global Dataset Upload Modal */}
      <UploadDatasetModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={async (newId) => {
          await refreshTelemetry();
          if (newId) {
            handleSelectDataset(newId);
          }
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
