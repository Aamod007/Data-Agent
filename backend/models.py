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


class PublicConfig(BaseModel):
    provider: str
    model: str
    has_api_key: bool
    base_url: str | None
    sql_url: str


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
