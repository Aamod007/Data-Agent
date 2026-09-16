import {
  Dataset,
  Telemetry,
  ChatMessage,
  DatasetPreview,
  PipelineNode,
  PipelineEdge,
  StudioTemplate,
  StudioCompareResult,
  AppConfig,
  AnalysisResultsDetails,
  PipelineProject,
} from './types';

const BASE_URL = '/api';

export async function fetchTelemetry(): Promise<Telemetry> {
  const res = await fetch(`${BASE_URL}/telemetry`);
  if (!res.ok) throw new Error('Failed to fetch telemetry');
  return res.json();
}

export async function fetchDatasets(q?: string): Promise<{ datasets: Dataset[]; active_dataset_id: string }> {
  const url = q ? `${BASE_URL}/datasets?q=${encodeURIComponent(q)}` : `${BASE_URL}/datasets`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch datasets');
  return res.json();
}

export async function selectDataset(dataset_id: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/datasets/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_id }),
  });
  if (!res.ok) throw new Error('Failed to select dataset');
  return res.json();
}

export async function uploadDataset(files: File | File[]): Promise<any> {
  const formData = new FormData();
  if (Array.isArray(files)) {
    files.forEach((f) => formData.append('files', f));
    if (files.length === 1) {
      formData.append('file', files[0]);
    }
  } else {
    formData.append('file', files);
    formData.append('files', files);
  }
  const res = await fetch(`${BASE_URL}/datasets/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to upload dataset');
  return res.json();
}

export async function fetchDatasetPreview(dataset_id: string, page = 1, limit = 50): Promise<DatasetPreview> {
  const res = await fetch(`${BASE_URL}/datasets/${encodeURIComponent(dataset_id)}/preview?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch dataset preview');
  return res.json();
}

export function getDownloadUrl(dataset_id: string, format: 'csv' | 'parquet' | 'json'): string {
  return `${BASE_URL}/datasets/${encodeURIComponent(dataset_id)}/download?format=${format}`;
}

export async function fetchChatHistory(): Promise<{ messages: ChatMessage[]; active_dataset_id: string }> {
  const res = await fetch(`${BASE_URL}/chat/history`);
  if (!res.ok) throw new Error('Failed to fetch chat history');
  return res.json();
}

export async function sendChatMessage(message: string, agent = 'analyst', auto_route = true, dataset_id?: string): Promise<ChatMessage> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, agent, auto_route, dataset_id }),
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

export async function clearChat(): Promise<void> {
  const res = await fetch(`${BASE_URL}/chat/clear`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to clear chat');
}

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${BASE_URL}/config`);
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

export async function updateConfig(update: Partial<AppConfig>): Promise<any> {
  const res = await fetch(`${BASE_URL}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error('Failed to update config');
  return res.json();
}

// ---------------- Pipeline Studio Extended API ----------------

export async function fetchStudioState(): Promise<{
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  active_node_id: string;
  model_node_id: string;
  latest_node_id: string;
  target: 'model' | 'active' | 'latest';
  templates: StudioTemplate[];
  drafts: Record<string, string>;
  can_undo: boolean;
  can_redo: boolean;
}> {
  const res = await fetch(`${BASE_URL}/pipeline/studio`);
  if (!res.ok) throw new Error('Failed to fetch pipeline studio state');
  return res.json();
}

export async function setStudioTarget(target: 'model' | 'active' | 'latest'): Promise<any> {
  const res = await fetch(`${BASE_URL}/pipeline/studio/target?target=${target}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to set target');
  return res.json();
}

export async function runStudioDraft(params: {
  parent_id: string;
  code: string;
  label: string;
  stage?: string;
  replay_downstream?: boolean;
  replace_mode?: boolean;
}): Promise<any> {
  const res = await fetch(`${BASE_URL}/pipeline/studio/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Execution error' }));
    throw new Error(err.detail || 'Execution failed');
  }
  return res.json();
}

export async function executeStudioAction(action: string, node_id?: string, data?: Record<string, any>): Promise<any> {
  const res = await fetch(`${BASE_URL}/pipeline/studio/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, node_id, data }),
  });
  if (!res.ok) throw new Error('Action execution failed');
  return res.json();
}

export async function compareStudioNodes(node_a: string, node_b: string): Promise<StudioCompareResult> {
  const res = await fetch(`${BASE_URL}/pipeline/studio/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ node_a, node_b }),
  });
  if (!res.ok) throw new Error('Compare request failed');
  return res.json();
}

export async function fetchNodeViewPayload(node_id: string, view_name: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/pipeline/studio/node/${encodeURIComponent(node_id)}/view/${encodeURIComponent(view_name)}`);
  if (!res.ok) throw new Error(`Failed to fetch view ${view_name}`);
  return res.json();
}

export function getStudioScriptUrl(): string {
  return `${BASE_URL}/pipeline/studio/script`;
}

export function getStudioSpecUrl(): string {
  return `${BASE_URL}/pipeline/studio/spec`;
}

export function getSweetvizReportUrl(nodeId: string, target?: string): string {
  const q = target && target !== '(None)' ? `?target=${encodeURIComponent(target)}` : '';
  return `${BASE_URL}/eda/sweetviz/${encodeURIComponent(nodeId)}${q}`;
}

export function getSweetvizDownloadUrl(nodeId: string, target?: string): string {
  const q = target && target !== '(None)' ? `?target=${encodeURIComponent(target)}` : '';
  return `${BASE_URL}/eda/sweetviz/${encodeURIComponent(nodeId)}/download${q}`;
}

export async function generateSweetvizReport(nodeId: string, target?: string): Promise<{ status: string; url: string; download_url: string }> {
  const res = await fetch(`${BASE_URL}/eda/sweetviz/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ node_id: nodeId, target: target && target !== '(None)' ? target : null }),
  });
  if (!res.ok) throw new Error('Failed to generate Sweetviz report');
  return res.json();
}

export async function fetchAnalysisResultsDetails(
  datasetId?: string,
  target: 'model' | 'active' | 'latest' | 'all' = 'model'
): Promise<AnalysisResultsDetails> {
  const params = new URLSearchParams();
  if (datasetId) params.append('dataset_id', datasetId);
  if (target) params.append('target', target);

  const res = await fetch(`${BASE_URL}/results/details?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch analysis results details');
  return res.json();
}

export async function checkConnection(params: {
  provider: string;
  api_key?: string;
  base_url?: string;
  model?: string;
}): Promise<{ status: string; message: string }> {
  const res = await fetch(`${BASE_URL}/config/check-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to check connection');
  return res.json();
}


export async function listProjects(showArchived: boolean = false, search?: string): Promise<PipelineProject[]> {
  const params = new URLSearchParams();
  if (showArchived) params.append('show_archived', 'true');
  if (search) params.append('search', search);

  const res = await fetch(`${BASE_URL}/projects?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to list projects');
  return res.json();
}

export async function loadProject(dirName: string, rehydrate: boolean = true): Promise<{ status: string; message: string; manifest?: any }> {
  const res = await fetch(`${BASE_URL}/projects/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir_name: dirName, rehydrate }),
  });
  if (!res.ok) throw new Error('Failed to load project');
  return res.json();
}


