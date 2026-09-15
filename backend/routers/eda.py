from __future__ import annotations

import math
from typing import Any
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.models import Artifact
from backend.services.workspace import records_for_json, workspace

router = APIRouter(prefix="/api/eda", tags=["eda"])


class ColumnProfile(BaseModel):
    name: str
    dtype: str
    kind: str  # numeric, categorical, datetime, boolean
    null_count: int
    null_pct: float
    unique_count: int
    sample_values: list[Any]
    min_val: Any | None = None
    max_val: Any | None = None
    mean_val: float | None = None
    std_val: float | None = None


class DatasetProfile(BaseModel):
    dataset_id: str
    dataset_name: str
    row_count: int
    col_count: int
    total_cells: int
    total_missing_cells: int
    missing_pct: float
    duplicate_rows: int
    memory_usage_bytes: int
    columns: list[ColumnProfile]
    correlations: dict[str, Any] | None = None
    missing_by_col: list[dict[str, Any]]


def _clean_num(val: Any) -> float | None:
    if val is None or pd.isna(val) or math.isinf(val):
        return None
    return float(val)


@router.get("/{dataset_id}/profile", response_model=DatasetProfile)
def get_dataset_profile(dataset_id: str) -> DatasetProfile:
    try:
        dataset = workspace.get_dataset(dataset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc

    df = dataset.frame
    n_rows, n_cols = df.shape
    total_cells = n_rows * n_cols
    total_missing = int(df.isna().sum().sum())
    missing_pct = (total_missing / total_cells * 100) if total_cells > 0 else 0.0

    try:
        dup_count = int(df.duplicated().sum())
    except Exception:
        dup_count = 0

    try:
        mem_bytes = int(df.memory_usage(deep=True).sum())
    except Exception:
        mem_bytes = 0

    col_profiles: list[ColumnProfile] = []
    missing_by_col: list[dict[str, Any]] = []

    for col_name in df.columns:
        s = df[col_name]
        null_c = int(s.isna().sum())
        null_p = (null_c / n_rows * 100) if n_rows > 0 else 0.0
        uniq_c = int(s.nunique(dropna=True))

        missing_by_col.append({
            "column": str(col_name),
            "missing_count": null_c,
            "missing_pct": round(null_p, 2),
            "present_count": n_rows - null_c,
        })

        # Determine semantic kind
        if pd.api.types.is_bool_dtype(s):
            kind = "boolean"
        elif pd.api.types.is_datetime64_any_dtype(s):
            kind = "datetime"
        elif pd.api.types.is_numeric_dtype(s):
            kind = "numeric"
        else:
            kind = "categorical"

        samples = [_clean_val(x) for x in s.dropna().head(5).tolist()]

        min_v = None
        max_v = None
        mean_v = None
        std_v = None

        if kind == "numeric":
            valid = s.dropna()
            if not valid.empty:
                min_v = _clean_num(valid.min())
                max_v = _clean_num(valid.max())
                mean_v = _clean_num(valid.mean())
                std_v = _clean_num(valid.std())

        col_profiles.append(
            ColumnProfile(
                name=str(col_name),
                dtype=str(s.dtype),
                kind=kind,
                null_count=null_c,
                null_pct=round(null_p, 2),
                unique_count=uniq_c,
                sample_values=samples,
                min_val=min_v,
                max_val=max_v,
                mean_val=round(mean_v, 3) if mean_v is not None else None,
                std_val=round(std_v, 3) if std_v is not None else None,
            )
        )

    # Correlation matrix for numeric columns
    correlations = None
    num_df = df.select_dtypes(include="number")
    if num_df.shape[1] >= 2 and n_rows >= 2:
        try:
            corr = num_df.corr().fillna(0)
            cols = [str(c) for c in corr.columns]
            z_vals = [[round(float(val), 3) for val in row] for row in corr.values]
            correlations = {
                "columns": cols,
                "z": z_vals,
            }
        except Exception:
            correlations = None

    return DatasetProfile(
        dataset_id=dataset.id,
        dataset_name=dataset.name,
        row_count=n_rows,
        col_count=n_cols,
        total_cells=total_cells,
        total_missing_cells=total_missing,
        missing_pct=round(missing_pct, 2),
        duplicate_rows=dup_count,
        memory_usage_bytes=mem_bytes,
        columns=col_profiles,
        correlations=correlations,
        missing_by_col=missing_by_col,
    )


def _clean_val(val: Any) -> Any:
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        return float(val) if not math.isnan(val) and not math.isinf(val) else None
    return str(val)
