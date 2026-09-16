from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class DatasetSummary(BaseModel):
    id: str
    name: str
    stage: str = "raw"
    shape: tuple[int, int]
    source: str
    created_at: float
    is_active: bool = False
    parent_id: str | None = None
    operation: str | None = None


class DatasetPreview(BaseModel):
    dataset: DatasetSummary
    columns: list[dict[str, Any]]
    rows: list[dict[str, Any]]
    total_rows: int
    offset: int
    limit: int


class DatasetDetails(BaseModel):
    dataset: DatasetSummary
    columns: list[dict[str, Any]]
    stats: list[dict[str, Any]]
    load_code: str


class ConfigUpdate(BaseModel):
    provider: Literal["openai", "ollama", "lm_studio", "openrouter", "nvidia"] = "nvidia"
    model: str = "meta/llama-3.2-11b-vision-instruct"
    api_key: str | None = Field(default=None, exclude=True)
    base_url: str | None = "https://integrate.api.nvidia.com/v1"
    sql_url: str = "sqlite:///:memory:"
    recursion_limit: int = 10
    enable_memory: bool = True
    proactive_mode: bool = False
    intent_parsing: bool = True
    include_studio_context: bool = True
    include_node_code: bool = False
    use_studio_node: bool = True
    sync_studio_state: bool = True
    mlflow_enabled: bool = False
    mlflow_tracking_uri: str = "sqlite:///mlflow.db"
    mlflow_artifact_root: str = "./mlflow_artifacts"
    mlflow_experiment_name: str = "H2O AutoML"
    verbose_logs: bool = False
    show_progress_in_chat: bool = True
    show_live_logs: bool = True


class PublicConfig(BaseModel):
    provider: str
    model: str
    has_api_key: bool
    base_url: str | None
    sql_url: str
    recursion_limit: int = 10
    enable_memory: bool = True
    proactive_mode: bool = False
    intent_parsing: bool = True
    include_studio_context: bool = True
    include_node_code: bool = False
    use_studio_node: bool = True
    sync_studio_state: bool = True
    mlflow_enabled: bool = False
    mlflow_tracking_uri: str = "sqlite:///mlflow.db"
    mlflow_artifact_root: str = "./mlflow_artifacts"
    mlflow_experiment_name: str = "H2O AutoML"
    verbose_logs: bool = False
    show_progress_in_chat: bool = True
    show_live_logs: bool = True


class RunDraftRequest(BaseModel):
    dataset_id: str
    code: str
    stage: str = "custom"


class AgentInvocation(BaseModel):
    dataset_id: str
    instructions: str = Field(min_length=1, max_length=20_000)
    agent: Literal[
        "analyst",
        "eda",
        "visualization",
        "wrangling",
        "cleaning",
        "sql",
        "loader",
    ] = "analyst"


class AgentRunCreated(BaseModel):
    run_id: str
    status: Literal["queued"] = "queued"


class Artifact(BaseModel):
    type: Literal["table", "chart", "code", "text", "report", "warning", "error"]
    title: str
    payload: Any
    language: str | None = None


class AgentRunResult(BaseModel):
    run_id: str
    status: Literal["queued", "running", "completed", "failed"]
    message: str | None = None
    artifacts: list[Artifact] = Field(default_factory=list)
    logs: list[str] = Field(default_factory=list)
    route: str | None = None


class PipelineLineageNode(BaseModel):
    id: str
    label: str | None = None
    stage: str = "raw"
    parent_id: str | None = None
    parent_ids: list[str] = Field(default_factory=list)
    shape: tuple[int, int] | None = None
    transform_kind: str | None = None
    is_target: bool = False
    is_active: bool = False


class PipelineSnapshotResponse(BaseModel):
    pipeline_hash: str | None = None
    target_dataset_id: str | None = None
    active_dataset_id: str | None = None
    target: str = "model"
    lineage: list[PipelineLineageNode] = Field(default_factory=list)
    datasets: list[DatasetSummary] = Field(default_factory=list)


class PipelineCompareResponse(BaseModel):
    node_a_id: str
    node_b_id: str
    shape_a: tuple[int, int]
    shape_b: tuple[int, int]
    added_columns: list[str] = Field(default_factory=list)
    removed_columns: list[str] = Field(default_factory=list)
    common_columns: list[str] = Field(default_factory=list)
    dtype_changes: list[dict[str, str]] = Field(default_factory=list)
    missingness_delta: list[dict[str, Any]] = Field(default_factory=list)
    preview_a: list[dict[str, Any]] = Field(default_factory=list)
    preview_b: list[dict[str, Any]] = Field(default_factory=list)

