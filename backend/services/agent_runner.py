from __future__ import annotations

import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

import pandas as pd
import sqlalchemy as sa

from backend.models import AgentInvocation, AgentRunResult, Artifact
from backend.services.workspace import records_for_json, workspace


@dataclass
class Run:
    id: str
    status: str = "queued"
    message: str | None = None
    artifacts: list[Artifact] = field(default_factory=list)
    logs: list[str] = field(default_factory=list)
    route: str | None = None
    updated_at: float = field(default_factory=time.time)

    def snapshot(self) -> AgentRunResult:
        return AgentRunResult(
            run_id=self.id,
            status=self.status,  # type: ignore[arg-type]
            message=self.message,
            artifacts=self.artifacts,
            logs=self.logs,
            route=self.route,
        )


class AgentRunner:
    """Runs existing Data Agents without changing their implementation."""

    def __init__(self) -> None:
        self._runs: dict[str, Run] = {}
        self._lock = threading.RLock()

    def start(self, request: AgentInvocation) -> Run:
        workspace.get_dataset(request.dataset_id)
        run = Run(id=uuid.uuid4().hex, logs=["Queued for execution."])
        with self._lock:
            self._runs[run.id] = run
        threading.Thread(target=self._execute, args=(run, request), daemon=True).start()
        return run

    def get(self, run_id: str) -> Run:
        with self._lock:
            run = self._runs.get(run_id)
        if run is None:
            raise KeyError(run_id)
        return run

    def completed(self) -> list[AgentRunResult]:
        with self._lock:
            runs = [run.snapshot() for run in self._runs.values() if run.status in {"completed", "failed"}]
        return sorted(runs, key=lambda run: self._runs[run.run_id].updated_at, reverse=True)

    @staticmethod
    def _model() -> Any:
        from langchain_openai import ChatOpenAI

        config = workspace.config()
        if config.provider == "nvidia":
            api_key = config.api_key or os.environ.get("NVIDIA_API_KEY")
            if not api_key:
                raise ValueError("Add an NVIDIA API key in Settings or set NVIDIA_API_KEY in environment before running an agent.")
            return ChatOpenAI(
                model=config.model or "meta/llama-3.2-11b-vision-instruct",
                base_url=config.base_url or "https://integrate.api.nvidia.com/v1",
                api_key=api_key,
                temperature=0.1,
            )
        if config.provider == "ollama":
            from langchain_ollama import ChatOllama

            return ChatOllama(model=config.model or "llama3", base_url=config.base_url or None)
        if config.provider == "lm_studio":
            return ChatOpenAI(
                model=config.model,
                base_url=config.base_url or "http://127.0.0.1:1234/v1",
                api_key=config.api_key or "lm-studio",
            )
        if config.provider == "openrouter":
            return ChatOpenAI(
                model=config.model,
                base_url=config.base_url or "https://openrouter.ai/api/v1",
                api_key=config.api_key or os.environ.get("OPENROUTER_API_KEY"),
            )
        api_key = config.api_key or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("Add an API key in Settings before running an agent.")
        return ChatOpenAI(model=config.model, api_key=api_key)

    @staticmethod
    def _latest_message(response: dict[str, Any]) -> str | None:
        for message in reversed(response.get("messages") or []):
            content = getattr(message, "content", None)
            if isinstance(content, str) and content.strip():
                return content
        return None

    @staticmethod
    def _frame_artifact(title: str, value: Any) -> Artifact | None:
        try:
            frame = value if isinstance(value, pd.DataFrame) else pd.DataFrame(value)
        except Exception:
            return None
        return Artifact(
            type="table",
            title=title,
            payload={
                "shape": [int(frame.shape[0]), int(frame.shape[1])],
                "columns": [str(column) for column in frame.columns],
                "rows": records_for_json(frame.head(250)),
                "truncated": len(frame) > 250,
            },
        )

    @classmethod
    def _artifacts(cls, response: dict[str, Any], agent: str) -> list[Artifact]:
        artifacts: list[Artifact] = []
        seen: set[tuple[str, str]] = set()

        def add(artifact: Artifact) -> None:
            key = (artifact.type, artifact.title)
            if key not in seen:
                seen.add(key)
                artifacts.append(artifact)

        text = cls._latest_message(response)
        if text:
            add(Artifact(type="text", title="Agent response", payload=text))

        table_keys = {
            "data_wrangled": "Wrangled data",
            "data_cleaned": "Cleaned data",
            "data_engineered": "Engineered features",
            "data_sql": "SQL result",
            "dataframe": "Data table",
        }
        for key, title in table_keys.items():
            if response.get(key) is not None:
                artifact = cls._frame_artifact(title, response[key])
                if artifact:
                    add(artifact)

        code_keys = {
            "data_wrangler_function": ("Data wrangling code", "python"),
            "data_cleaner_function": ("Data cleaning code", "python"),
            "feature_engineer_function": ("Feature engineering code", "python"),
            "data_visualization_function": ("Visualization code", "python"),
            "sql_query_code": ("SQL query", "sql"),
        }
        for key, (title, language) in code_keys.items():
            code = response.get(key)
            if isinstance(code, str) and code.strip():
                add(Artifact(type="code", title=title, payload=code, language=language))

        chart = response.get("plotly_graph")
        if isinstance(chart, dict):
            add(Artifact(type="chart", title="Interactive chart", payload=chart))

        for key in ("data_visualization_warning", "data_cleaning_warning", "warning"):
            warning = response.get(key)
            if isinstance(warning, str) and warning.strip():
                add(Artifact(type="warning", title="Run warning", payload=warning))
        for key in ("data_visualization_error", "data_cleaning_error", "error"):
            error = response.get(key)
            if isinstance(error, str) and error.strip():
                add(Artifact(type="error", title="Agent error", payload=error))

        if agent == "eda":
            eda = response.get("eda_artifacts")
            if isinstance(eda, dict):
                for tool_name, payload in eda.items():
                    if isinstance(payload, dict) and "plotly_figure" in payload:
                        add(Artifact(type="chart", title=tool_name.replace("_", " ").title(), payload=payload["plotly_figure"]))
                    elif isinstance(payload, dict) and "report_html" in payload:
                        add(Artifact(type="report", title=tool_name.replace("_", " ").title(), payload={"html": payload["report_html"]}))
                    elif payload is not None:
                        table = cls._frame_artifact(tool_name.replace("_", " ").title(), payload)
                        if table:
                            add(table)
        return artifacts

    def _execute(self, run: Run, request: AgentInvocation) -> None:
        try:
            run.status = "running"
            run.updated_at = time.time()
            run.logs.append(f"Starting {request.agent} agent.")
            dataset = workspace.get_dataset(request.dataset_id)
            model = self._model()
            response: dict[str, Any]

            if request.agent == "analyst":
                from data_agnets.agents import DataVisualizationAgent, DataWranglingAgent
                from data_agnets.multiagents import PandasDataAnalyst

                run.logs.append("Routing request through wrangling and visualization agents.")
                agent = PandasDataAnalyst(
                    model=model,
                    data_wrangling_agent=DataWranglingAgent(model=model, log=False, n_samples=100),
                    data_visualization_agent=DataVisualizationAgent(model=model, log=False, n_samples=100),
                )
                agent.invoke_agent(user_instructions=request.instructions, data_raw=dataset.frame)
                response = agent.get_response() or {}
                run.route = response.get("routing_preprocessor_decision")
            elif request.agent == "eda":
                from data_agnets.ds_agents import EDAToolsAgent

                agent = EDAToolsAgent(model, log_tool_calls=True)
                agent.invoke_agent(user_instructions=request.instructions, data_raw=dataset.frame)
                response = agent.response or {}
            elif request.agent == "visualization":
                from data_agnets.agents import DataVisualizationAgent

                agent = DataVisualizationAgent(model=model, log=False)
                agent.invoke_agent(user_instructions=request.instructions, data_raw=dataset.frame)
                response = agent.get_response() or {}
            elif request.agent == "wrangling":
                from data_agnets.agents import DataWranglingAgent

                agent = DataWranglingAgent(model=model, log=False)
                agent.invoke_agent(user_instructions=request.instructions, data_raw=dataset.frame)
                response = agent.response or {}
            elif request.agent == "cleaning":
                from data_agnets.agents import DataCleaningAgent

                agent = DataCleaningAgent(model=model, log=False)
                agent.invoke_agent(user_instructions=request.instructions, data_raw=dataset.frame)
                response = agent.response or {}
            elif request.agent == "sql":
                from data_agnets.agents import SQLDatabaseAgent

                config = workspace.config()
                engine = sa.create_engine(config.sql_url)
                with engine.connect() as connection:
                    agent = SQLDatabaseAgent(model=model, connection=connection, log=False, safe_mode=True)
                    agent.invoke_agent(user_instructions=request.instructions)
                    response = agent.response or {}
            else:
                from data_agnets.agents import DataLoaderToolsAgent

                agent = DataLoaderToolsAgent(model)
                agent.invoke_agent(user_instructions=request.instructions)
                response = agent.response or {}

            run.artifacts = self._artifacts(response, request.agent)
            derived_key = {"wrangling": ("data_wrangled", "wrangled"), "cleaning": ("data_cleaned", "cleaned")}.get(request.agent)
            if derived_key and response.get(derived_key[0]) is not None:
                frame = pd.DataFrame(response[derived_key[0]])
                derived = workspace.add_derived(
                    parent_id=dataset.id,
                    frame=frame,
                    stage=derived_key[1],
                    operation=request.agent,
                )
                run.logs.append(f"Created derived dataset: {derived.name}.")
            run.message = self._latest_message(response) or "Workflow completed."
            run.status = "completed"
            run.logs.append("Agent run completed.")
        except Exception as exc:
            run.status = "failed"
            run.message = str(exc)
            run.logs.append(f"Run failed: {exc}")
        finally:
            run.updated_at = time.time()


agent_runner = AgentRunner()
