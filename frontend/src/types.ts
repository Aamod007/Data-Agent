export interface Dataset {
  id: string;
  label: string;
  stage: string;
  records: number;
  features: number;
  created_at?: string;
  is_active: boolean;
  source?: string;
}

export interface Telemetry {
  active_dataset_id: string | null;
  active_dataset_label: string;
  stage: string;
  records: number;
  features: number;
  storage_used_mb: number;
  storage_limit_mb: number;
  storage_text: string;
  total_datasets: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  agent?: string;
  content: string;
  thoughts?: string[];
  code?: string;
  plotly_spec?: any;
  dataframe_preview?: any[];
  timestamp: string;
  active_dataset_id?: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  missing: number;
  missing_pct: number;
  unique: number;
}

export interface DatasetPreview {
  id: string;
  label: string;
  stage: string;
  records: number;
  features: number;
  columns: ColumnInfo[];
  summary: Record<string, Record<string, any>>;
  page: number;
  limit: number;
  total_pages: number;
  rows: Record<string, any>[];
}

export interface PipelineNode {
  id: string;
  label: string;
  stage: string;
  shape: [number, number];
  created_at?: string;
  created_by?: string;
  fingerprint?: string;
  is_active: boolean;
  is_target?: boolean;
  is_stale?: boolean;
  is_hidden?: boolean;
  is_deleted?: boolean;
  artifacts?: {
    chart: number;
    eda: number;
    model: number;
    predictions: number;
    mlflow: number;
  };
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
}

export interface StudioTemplate {
  id: string;
  title: string;
  kind: string;
  stage: string;
  desc: string;
  code: string;
}

export interface StudioCompareResult {
  node_a: {
    id: string;
    label: string;
    shape: [number, number];
    stage: string;
  };
  node_b: {
    id: string;
    label: string;
    shape: [number, number];
    stage: string;
  };
  columns_added: string[];
  columns_removed: string[];
  columns_common_count: number;
  dtype_changes: {
    column: string;
    dtype_a: string;
    dtype_b: string;
  }[];
  rows_delta: number;
  features_delta: number;
  missing_delta: {
    node_a_nulls: number;
    node_b_nulls: number;
  };
  preview_a: any[];
  preview_b: any[];
}

export interface PipelineProject {
  dir_name: string;
  dir_path: string;
  name: string;
  datasets_total: number;
  data_mode: string;
  saved_ts: number;
  archived?: boolean;
}

export interface AppConfig {
  llm_provider: string;
  model_name: string;
  openai_api_key?: string;
  has_openai_key?: boolean;
  openrouter_api_key?: string;
  has_openrouter_key?: boolean;
  openrouter_model?: string;
  lm_studio_base_url?: string;
  lm_studio_model?: string;
  ollama_base_url?: string;
  ollama_model?: string;
  sql_url?: string;
  enable_mlflow_logging?: boolean;
  mlflow_tracking_uri?: string;
  mlflow_artifact_root?: string;
  mlflow_experiment_name?: string;
  memory?: boolean;
  recursion_limit?: number;
  proactive_workflow_mode?: boolean;
  use_llm_intent_parser?: boolean;
  preview_rows?: number;
  active_dataset_id_override?: string;
  pipeline_persist_dir?: string;
  pipeline_persist_enabled?: boolean;
  pipeline_persist_overwrite?: boolean;
  pipeline_persist_include_sql?: boolean;
  pipeline_preserve_all_nodes?: boolean;
  pipeline_preserve_studio_nodes?: boolean;
  pipeline_dataset_persist_enabled?: boolean;
  pipeline_dataset_restore_enabled?: boolean;
  pipeline_dataset_cache_format?: string;
  pipeline_dataset_cache_max_items?: number;
  pipeline_dataset_cache_max_mb?: number;
  pipeline_chat_context_enabled?: boolean;
  pipeline_chat_context_include_code?: boolean;
  pipeline_use_selected_node_for_chat?: boolean;
  pipeline_sync_state_to_agents?: boolean;
  debug_mode?: boolean;
  show_progress?: boolean;
  show_live_logs?: boolean;
  pipeline_studio_docked?: boolean;
}

export interface AnalysisResultsDetails {
  status: string;
  selected_dataset_id: string;
  selected_dataset_label: string;
  active_dataset_id: string;
  model_dataset_id: string;
  latest_dataset_id: string;
  target: string;
  reasoning_items: [string, string][];
  pipeline: {
    pipeline_hash: string;
    target: string;
    target_dataset_id: string;
    model_dataset_id: string;
    active_dataset_id: string;
    inputs: string[];
    persisted_dir: string;
    lineage: {
      step: number;
      dataset_id: string;
      label: string;
      stage: string;
      shape: string;
      action: string;
      timestamp: string;
    }[];
    script: string;
  };
  feature_engineering_code?: string;
  model_training_code?: string;
  prediction_code?: string;
  stages: Record<
    string,
    {
      dataset_id: string;
      label: string;
      stage_label: string;
      shape: [number, number];
      columns: string[];
      rows: Record<string, any>[];
      download_csv: string;
      download_parquet: string;
      download_json: string;
    }
  >;
  sql: {
    query: string;
    executor: string;
    executor_name: string;
    executor_path: string;
  };
  charts: {
    plotly_spec: any;
    viz_error?: string | null;
    viz_warning?: string | null;
  };
  eda_reports: {
    sweetviz_file: string;
    sweetviz_url: string;
    sweetviz_download_url: string;
    dtale_url?: string | null;
  };
  models: {
    leaderboard: {
      model_id: string;
      algorithm: string;
      auc: number;
      logloss: number;
      accuracy: number;
      f1_score: number;
      training_time_s: number;
      status: string;
    }[];
    eval_metrics: {
      auc: number;
      pr_auc: number;
      logloss: number;
      accuracy: number;
      f1_optimal: number;
      optimal_threshold: number;
      confusion_matrix: {
        true_positive: number;
        false_positive: number;
        false_negative: number;
        true_negative: number;
      };
    };
    eval_plotly_spec: any;
  };
  predictions: {
    rows: Record<string, any>[];
    has_predictions: boolean;
  };
  mlflow: {
    tracking_uri: string;
    experiment_name: string;
    artifact_location: string;
    runs: {
      run_id: string;
      run_name: string;
      status: string;
      start_time: string;
      duration_seconds: number;
      has_model: boolean;
      model_uri: string;
      params_preview: string;
      metrics_preview: string;
    }[];
    experiments: {
      experiment_id: string;
      name: string;
      lifecycle_stage: string;
      creation_time: string;
      last_update_time: string;
      artifact_location: string;
    }[];
  };
}

