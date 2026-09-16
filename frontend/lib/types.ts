// Mirrors backend/models.py + backend/routers/eda.py response shapes.
// Kept narrow and explicit; everything the pages already consume.

export type Provider = "openai" | "ollama" | "lm_studio" | "openrouter" | "nvidia";

export type AgentKind =
  | "analyst"
  | "eda"
  | "visualization"
  | "wrangling"
  | "cleaning"
  | "sql"
  | "loader";

export type DatasetStage = "raw" | "cleaned" | "wrangled" | "engineered" | string;

export interface Dataset {
  id: string;
  name: string;
  stage: DatasetStage;
  shape: [number, number];
  source: string;
  created_at: number;
  is_active: boolean;
  parent_id: string | null;
  operation: string | null;
}

export interface DatasetColumn {
  name: string;
  dtype: string;
  nulls: number;
  unique: number;
}

export interface DatasetPreview {
  dataset: Dataset;
  columns: DatasetColumn[];
  rows: Record<string, unknown>[];
  total_rows: number;
  offset: number;
  limit: number;
}

export interface DatasetDetails {
  dataset: Dataset;
  columns: DatasetColumn[];
  stats: Record<string, unknown>[];
  load_code: string;
}

export type ArtifactType = "table" | "chart" | "code" | "text" | "report" | "warning" | "error";

export interface Artifact {
  type: ArtifactType;
  title: string;
  payload: unknown;
  language?: string | null;
}

export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface AgentRun {
  run_id: string;
  status: RunStatus;
  message: string | null;
  artifacts: Artifact[];
  logs: string[];
  route: string | null;
}

export interface ColumnProfile {
  name: string;
  dtype: string;
  kind: "numeric" | "categorical" | "datetime" | "boolean";
  null_count: number;
  null_pct: number;
  unique_count: number;
  sample_values: unknown[];
  min_val: number | null;
  max_val: number | null;
  mean_val: number | null;
  std_val: number | null;
}

export interface DatasetProfile {
  dataset_id: string;
  dataset_name: string;
  row_count: number;
  col_count: number;
  total_cells: number;
  total_missing_cells: number;
  missing_pct: number;
  duplicate_rows: number;
  memory_usage_bytes: number;
  columns: ColumnProfile[];
  correlations: { columns: string[]; z: number[][] } | null;
  missing_by_col: { column: string; missing_count: number; missing_pct: number; present_count: number }[];
}

export interface SampleDataset {
  id: string;
  name: string;
  description: string;
}

export interface AppConfig {
  provider: Provider;
  model: string;
  has_api_key: boolean;
  base_url: string | null;
  sql_url: string;
  recursion_limit?: number;
  enable_memory?: boolean;
  proactive_mode?: boolean;
  intent_parsing?: boolean;
  include_studio_context?: boolean;
  include_node_code?: boolean;
  use_studio_node?: boolean;
  sync_studio_state?: boolean;
  mlflow_enabled?: boolean;
  mlflow_tracking_uri?: string;
  mlflow_artifact_root?: string;
  mlflow_experiment_name?: string;
  verbose_logs?: boolean;
  show_progress_in_chat?: boolean;
  show_live_logs?: boolean;
}

// Payload shape accepted by POST /api/agents/invoke.
export interface InvokeAgentRequest {
  dataset_id: string;
  instructions: string;
  agent: AgentKind;
}

// Payload shape accepted by PUT /api/config. `api_key` is write-only.
export interface ConfigUpdateRequest {
  provider: Provider;
  model: string;
  api_key?: string | null;
  base_url?: string | null;
  sql_url?: string;
  recursion_limit?: number;
  enable_memory?: boolean;
  proactive_mode?: boolean;
  intent_parsing?: boolean;
  include_studio_context?: boolean;
  include_node_code?: boolean;
  use_studio_node?: boolean;
  sync_studio_state?: boolean;
  mlflow_enabled?: boolean;
  mlflow_tracking_uri?: string;
  mlflow_artifact_root?: string;
  mlflow_experiment_name?: string;
  verbose_logs?: boolean;
  show_progress_in_chat?: boolean;
  show_live_logs?: boolean;
}

export interface PipelineLineageNode {
  id: string;
  label?: string;
  stage: string;
  parent_id?: string | null;
  parent_ids: string[];
  shape?: [number, number] | null;
  transform_kind?: string | null;
  is_target?: boolean;
  is_active?: boolean;
}

export interface PipelineSnapshot {
  pipeline_hash: string | null;
  target_dataset_id: string | null;
  active_dataset_id: string | null;
  target: string;
  lineage: PipelineLineageNode[];
  datasets: Dataset[];
}

export interface PipelineCompareResult {
  node_a_id: string;
  node_b_id: string;
  shape_a: [number, number];
  shape_b: [number, number];
  added_columns: string[];
  removed_columns: string[];
  common_columns: string[];
  dtype_changes: { column: string; dtype_a: string; dtype_b: string }[];
  missingness_delta: { column: string; nulls_a: number; nulls_b: number; diff: number }[];
  preview_a: Record<string, any>[];
  preview_b: Record<string, any>[];
}

