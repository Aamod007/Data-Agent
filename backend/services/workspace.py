from __future__ import annotations

import json
import os
import re
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd

from backend.models import ConfigUpdate, DatasetSummary

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
UPLOADS_DIR = REPO_ROOT / "temp" / "workspace_uploads"


def _json_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    if not isinstance(value, (list, tuple, dict)) and pd.isna(value):
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if hasattr(value, "item"):
        try:
            return _json_value(value.item())
        except ValueError:
            pass
    if isinstance(value, (list, tuple)):
        return [_json_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}
    return str(value)


def records_for_json(frame: pd.DataFrame) -> list[dict[str, Any]]:
    return [_json_value(record) for record in frame.to_dict(orient="records")]


def safe_filename(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", Path(name).name).strip(".-")
    return cleaned or "upload"


@dataclass
class Dataset:
    id: str
    name: str
    frame: pd.DataFrame
    source: str
    path: Path
    created_at: float = field(default_factory=time.time)
    stage: str = "raw"
    parent_id: str | None = None
    operation: str | None = None

    def summary(self, active_id: str | None) -> DatasetSummary:
        return DatasetSummary(
            id=self.id,
            name=self.name,
            stage=self.stage,
            shape=(int(self.frame.shape[0]), int(self.frame.shape[1])),
            source=self.source,
            created_at=self.created_at,
            is_active=self.id == active_id,
            parent_id=self.parent_id,
            operation=self.operation,
        )


class Workspace:
    """Sessionless local workspace for the first dashboard vertical slice.

    ponytail: one shared workspace is intentional for local development. Add
    authenticated per-user workspaces before deploying this process for multiple users.
    """

    def __init__(self) -> None:
        self._datasets: dict[str, Dataset] = {}
        self._active_dataset_id: str | None = None
        nvidia_key = os.environ.get("NVIDIA_API_KEY")
        openai_key = os.environ.get("OPENAI_API_KEY")
        if nvidia_key:
            self._config = ConfigUpdate(
                provider="nvidia",
                model="meta/llama-3.2-11b-vision-instruct",
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=nvidia_key,
            )
        elif openai_key:
            self._config = ConfigUpdate(
                provider="openai",
                model="gpt-4o-mini",
                api_key=openai_key,
            )
        else:
            self._config = ConfigUpdate(
                provider="ollama",
                model="llama3",
                base_url="http://localhost:11434",
            )
        self._lock = threading.RLock()

    def config(self) -> ConfigUpdate:
        with self._lock:
            return self._config.model_copy()

    def update_config(self, update: ConfigUpdate) -> ConfigUpdate:
        with self._lock:
            if update.api_key is None:
                update.api_key = (
                    self._config.api_key
                    or os.environ.get("NVIDIA_API_KEY")
                    or os.environ.get("OPENAI_API_KEY")
                )
            self._config = update
            return self._config.model_copy()

    def add_upload(self, *, original_name: str, content: bytes) -> Dataset:
        from data_agnets.tools.data_loader import auto_load_file

        if not content:
            raise ValueError("The uploaded file is empty.")
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        dataset_id = uuid.uuid4().hex
        name = safe_filename(original_name)
        path = UPLOADS_DIR / f"{dataset_id}_{name}"
        path.write_bytes(content)
        loaded = auto_load_file(str(path))
        if not isinstance(loaded, pd.DataFrame):
            path.unlink(missing_ok=True)
            raise ValueError(str(loaded))

        dataset = Dataset(
            id=dataset_id,
            name=Path(name).stem,
            frame=loaded,
            source=f"upload · {name}",
            path=path,
        )
        with self._lock:
            self._datasets[dataset.id] = dataset
            self._active_dataset_id = dataset.id
        return dataset

    def add_from_local_directory(self, directory: str) -> list["Dataset"]:
        """Load all supported tabular files from a local directory."""
        from data_agnets.tools.data_loader import auto_load_file

        dir_path = Path(directory).resolve()
        if not dir_path.is_dir():
            raise FileNotFoundError(f"Directory not found: {directory}")

        supported_exts = {".csv", ".tsv", ".json", ".jsonl", ".ndjson", ".parquet", ".xlsx", ".xls"}
        loaded: list[Dataset] = []

        for file_path in sorted(dir_path.iterdir()):
            if file_path.is_dir():
                continue
            if file_path.suffix.lower() not in supported_exts:
                continue

            try:
                result = auto_load_file(str(file_path))
                if not isinstance(result, pd.DataFrame):
                    continue  # Skip files that fail to load
                dataset_id = uuid.uuid4().hex
                name = file_path.stem
                dataset = Dataset(
                    id=dataset_id,
                    name=name,
                    frame=result,
                    source=f"upload · {file_path.name}",
                    path=file_path,
                )
                with self._lock:
                    self._datasets[dataset.id] = dataset
                    self._active_dataset_id = dataset.id
                loaded.append(dataset)
            except Exception:
                continue  # Skip problematic files

        if not loaded:
            raise ValueError(f"No loadable tabular files found in {directory}")

        return loaded

    def add_sample(self, sample_name: str) -> Dataset:
        from data_agnets.tools.data_loader import auto_load_file

        samples_map = {
            "bike_sales_data": ("bike_sales_data.csv", "Bike Sales Transactions"),
            "bike_model_specs": ("bike_model_specs.csv", "Bike Model Specifications"),
            "dirty_dataset": ("dirty_dataset.csv", "Dirty Dataset (Cleaning)"),
        }
        if sample_name not in samples_map:
            raise KeyError(f"Unknown sample dataset: {sample_name}")

        filename, label = samples_map[sample_name]
        sample_path = (REPO_ROOT / "data" / filename).resolve()
        if not sample_path.exists():
            raise FileNotFoundError(f"Sample file not found at {sample_path}")

        loaded = auto_load_file(str(sample_path))
        if not isinstance(loaded, pd.DataFrame):
            raise ValueError(str(loaded))

        dataset_id = uuid.uuid4().hex
        dataset = Dataset(
            id=dataset_id,
            name=label,
            frame=loaded,
            source=f"sample · {filename}",
            path=sample_path.resolve(),
        )
        with self._lock:
            self._datasets[dataset.id] = dataset
            self._active_dataset_id = dataset.id
        return dataset

    def list_samples(self) -> list[dict[str, str]]:
        return [
            {"id": "bike_sales_data", "name": "Bike Sales", "description": "15,644 bike sales records with date, customer, model, and revenue details."},
            {"id": "bike_model_specs", "name": "Bike Model Specs", "description": "Product catalog with model specifications, categories, and price."},
            {"id": "dirty_dataset", "name": "Dirty Dataset", "description": "Messy dataset with nulls, duplicates, and inconsistent casing for cleaning."},
        ]

    def add_derived(self, *, parent_id: str, frame: pd.DataFrame, stage: str, operation: str) -> Dataset:
        parent = self.get_dataset(parent_id)
        dataset = Dataset(
            id=uuid.uuid4().hex,
            name=f"{parent.name} · {stage}",
            frame=frame,
            source=f"agent · {operation}",
            path=parent.path,
            stage=stage,
            parent_id=parent_id,
            operation=operation,
        )
        with self._lock:
            self._datasets[dataset.id] = dataset
            self._active_dataset_id = dataset.id
        return dataset

    def list_datasets(self) -> list[DatasetSummary]:
        with self._lock:
            values = [item.summary(self._active_dataset_id) for item in self._datasets.values()]
        return sorted(values, key=lambda item: item.created_at, reverse=True)

    def get_dataset(self, dataset_id: str) -> Dataset:
        with self._lock:
            dataset = self._datasets.get(dataset_id)
        if dataset is None:
            raise KeyError(dataset_id)
        return dataset

    def remove_dataset(self, dataset_id: str) -> None:
        with self._lock:
            dataset = self._datasets.pop(dataset_id, None)
            if self._active_dataset_id == dataset_id:
                self._active_dataset_id = next(iter(self._datasets), None)
        # Only delete files this workspace owns (uploads it wrote). Sample datasets
        # and directory loads point at the user's/bundled originals — unlinking
        # those would destroy the source and break re-loading the sample forever.
        if dataset and dataset.parent_id is None:
            try:
                owned = dataset.path.resolve().is_relative_to(UPLOADS_DIR.resolve())
            except (OSError, ValueError):
                owned = False
            if owned:
                dataset.path.unlink(missing_ok=True)

    def set_active(self, dataset_id: str) -> DatasetSummary:
        dataset = self.get_dataset(dataset_id)
        with self._lock:
            self._active_dataset_id = dataset.id
            return dataset.summary(self._active_dataset_id)

    def active_dataset_id(self) -> str | None:
        with self._lock:
            return self._active_dataset_id

    @staticmethod
    def columns(frame: pd.DataFrame) -> list[dict[str, Any]]:
        return [
            {
                "name": str(name),
                "dtype": str(series.dtype),
                "nulls": int(series.isna().sum()),
                "unique": int(series.nunique(dropna=True)),
            }
            for name, series in frame.items()
        ]

    @staticmethod
    def stats(frame: pd.DataFrame) -> list[dict[str, Any]]:
        numeric = frame.select_dtypes(include="number")
        if numeric.empty:
            return []
        described = numeric.describe().transpose().reset_index(names="column")
        return records_for_json(described)


workspace = Workspace()
