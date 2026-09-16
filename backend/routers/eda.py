from __future__ import annotations

import math
from typing import Any
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.models import Artifact
from backend.services.workspace import records_for_json, workspace
from data_agnets.tools.dataframe import _summarize_dataframe

router = APIRouter(prefix="/api/eda", tags=["eda"])


class ColumnProfile(BaseModel):
    name: str
    dtype: str
    kind: str  # numeric, categorical, datetime, boolean
    null_count: int
    null_pct: float
    unique_count: int
    sample_values: list[Any] = Field(default_factory=list)
    min_val: float | None = None
    max_val: float | None = None
    mean_val: float | None = None
    std_val: float | None = None
    median_val: float | None = None
    mode_val: Any | None = None
    variance_val: float | None = None
    q25: float | None = None
    q75: float | None = None
    iqr: float | None = None
    skewness: float | None = None
    kurtosis: float | None = None
    outliers_count: int = 0
    is_constant: bool = False
    is_near_constant: bool = False
    top_categories: list[dict[str, Any]] | None = None
    rare_categories: list[str] | None = None


class OutlierSummary(BaseModel):
    column: str
    outlier_count: int
    outlier_pct: float
    lower_bound: float | None = None
    upper_bound: float | None = None


class AutomatedInsights(BaseModel):
    factual_findings: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class DatasetProfile(BaseModel):
    dataset_id: str
    dataset_name: str
    file_type: str = "csv"
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
    health_score: int = 100
    health_summary: str = "Healthy"
    detected_target: str | None = None
    constant_columns: list[str] = Field(default_factory=list)
    near_constant_columns: list[str] = Field(default_factory=list)
    quality_warnings: list[str] = Field(default_factory=list)
    outlier_summary: list[OutlierSummary] = Field(default_factory=list)
    total_outliers: int = 0
    insights: AutomatedInsights = Field(default_factory=AutomatedInsights)
    agent_summary: str | None = None


def _clean_num(val: Any) -> float | None:
    if val is None or isinstance(val, (list, tuple, dict)):
        return None
    try:
        if pd.isna(val) or math.isinf(val):
            return None
        return float(round(val, 3))
    except Exception:
        return None


def _clean_val(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, (list, tuple, dict)):
        return val
    try:
        if pd.isna(val):
            return None
    except Exception:
        return None
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        return float(round(val, 3)) if not math.isnan(val) and not math.isinf(val) else None
    return str(val)


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
    outliers_list: list[OutlierSummary] = []
    total_outliers_count = 0
    constant_cols: list[str] = []
    near_constant_cols: list[str] = []
    quality_warnings: list[str] = []
    factual_findings: list[str] = []
    recommendations: list[str] = []

    # File type extraction
    file_type = "csv"
    if dataset.source:
        for ext in [".parquet", ".xlsx", ".xls", ".json", ".csv", ".tsv"]:
            if ext in dataset.source.lower():
                file_type = ext.replace(".", "")
                break

    # Target detection heuristic
    target_names = {"target", "label", "churn", "status", "class", "survived", "price", "is_churn", "default", "y"}
    detected_target: str | None = None
    for c in reversed(df.columns):
        if str(c).lower() in target_names or any(str(c).lower().endswith(f"_{t}") for t in target_names):
            detected_target = str(c)
            break

    for col_name in df.columns:
        s = df[col_name]
        null_c = int(s.isna().sum())
        null_p = (null_c / n_rows * 100) if n_rows > 0 else 0.0
        try:
            uniq_c = int(s.nunique(dropna=True))
        except (TypeError, Exception):
            try:
                uniq_c = int(s.astype(str).nunique(dropna=True))
            except Exception:
                uniq_c = 0

        missing_by_col.append({
            "column": str(col_name),
            "missing_count": null_c,
            "missing_pct": round(null_p, 2),
            "present_count": n_rows - null_c,
        })

        if null_p > 20:
            quality_warnings.append(f"Column '{col_name}' contains high missingness ({null_p:.1f}% missing).")

        # Constant & Near-constant checks
        is_const = uniq_c <= 1
        is_near_const = False
        if is_const:
            constant_cols.append(str(col_name))
            quality_warnings.append(f"Column '{col_name}' is constant (has only {uniq_c} unique value).")
        elif not s.empty:
            try:
                top_ratio = s.value_counts(normalize=True, dropna=True).iloc[0] if len(s.dropna()) > 0 else 0
                if top_ratio >= 0.95:
                    is_near_const = True
                    near_constant_cols.append(str(col_name))
                    quality_warnings.append(f"Column '{col_name}' is near-constant ({top_ratio*100:.1f}% single value).")
            except Exception:
                pass

        # High cardinality ID check
        if uniq_c == n_rows and n_rows > 50:
            quality_warnings.append(f"Column '{col_name}' has 100% unique values (likely identifier/key).")

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
        median_v = None
        mode_v = None
        variance_v = None
        q25 = None
        q75 = None
        iqr = None
        skewness = None
        kurtosis = None
        col_outliers = 0
        top_cats = None
        rare_cats = None

        if kind == "numeric":
            valid = s.dropna()
            if not valid.empty:
                min_v = _clean_num(valid.min())
                max_v = _clean_num(valid.max())
                mean_v = _clean_num(valid.mean())
                std_v = _clean_num(valid.std())
                median_v = _clean_num(valid.median())
                modes = valid.mode()
                if not modes.empty:
                    mode_v = _clean_val(modes.iloc[0])
                variance_v = _clean_num(valid.var())
                q25 = _clean_num(valid.quantile(0.25))
                q75 = _clean_num(valid.quantile(0.75))
                if q75 is not None and q25 is not None:
                    iqr = _clean_num(q75 - q25)
                    lower = q25 - 1.5 * iqr
                    upper = q75 + 1.5 * iqr
                    col_outliers = int(((valid < lower) | (valid > upper)).sum())
                    if col_outliers > 0:
                        total_outliers_count += col_outliers
                        outliers_list.append(OutlierSummary(
                            column=str(col_name),
                            outlier_count=col_outliers,
                            outlier_pct=round(col_outliers / len(valid) * 100, 2),
                            lower_bound=_clean_num(lower),
                            upper_bound=_clean_num(upper),
                        ))

                try:
                    skewness = _clean_num(valid.skew())
                    kurtosis = _clean_num(valid.kurt())
                except Exception:
                    pass

        elif kind in ("categorical", "boolean"):
            try:
                modes = s.dropna().mode()
                if not modes.empty:
                    mode_v = _clean_val(modes.iloc[0])
            except Exception:
                pass
            try:
                val_counts = s.dropna().value_counts()
                top_cats = [
                    {"category": str(k), "count": int(v), "pct": round(v / max(1, len(s.dropna())) * 100, 1)}
                    for k, v in val_counts.head(8).items()
                ]
                rare_cats = [
                    str(k) for k, v in val_counts.items() if (v / max(1, len(s.dropna()))) < 0.02
                ][:10]
            except Exception:
                top_cats = []
                rare_cats = []

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
                mean_val=mean_v,
                std_val=std_v,
                median_val=median_v,
                mode_val=mode_v,
                variance_val=variance_v,
                q25=q25,
                q75=q75,
                iqr=iqr,
                skewness=skewness,
                kurtosis=kurtosis,
                outliers_count=col_outliers,
                is_constant=is_const,
                is_near_constant=is_near_const,
                top_categories=top_cats,
                rare_categories=rare_cats,
            )
        )

    # Correlation matrix for numeric columns
    correlations = None
    num_df = df.select_dtypes(include="number")
    strong_corrs: list[tuple[str, str, float]] = []
    if num_df.shape[1] >= 2 and n_rows >= 2:
        try:
            corr = num_df.corr().fillna(0)
            cols = [str(c) for c in corr.columns]
            z_vals = [
                [
                    round(float(val), 3) if not math.isnan(val) and not math.isinf(val) else 0.0
                    for val in row
                ]
                for row in corr.values
            ]
            correlations = {
                "columns": cols,
                "z": z_vals,
            }
            # Identify strong pairwise correlations (|r| >= 0.7, excluding diagonal)
            for i in range(len(cols)):
                for j in range(i + 1, len(cols)):
                    r_val = corr.iloc[i, j]
                    if abs(r_val) >= 0.7:
                        strong_corrs.append((cols[i], cols[j], round(float(r_val), 2)))
        except Exception:
            correlations = None

    # Calculate overall data health score (0 - 100)
    health_penalty = 0.0
    health_penalty += min(40, missing_pct * 1.5)
    health_penalty += min(20, (dup_count / max(1, n_rows)) * 100 * 2)
    health_penalty += min(20, (len(constant_cols) + len(near_constant_cols)) * 5)
    health_score = max(10, min(100, round(100.0 - health_penalty)))
    health_summary = (
        "Optimal" if health_score >= 90
        else "Good" if health_score >= 75
        else "Moderate" if health_score >= 60
        else "Degraded"
    )

    # ── Automated Insights Generation ──
    # Factual Findings
    factual_findings.append(f"Dataset contains {n_rows:,} rows and {n_cols} columns ({mem_bytes / 1024:.1f} KB in-memory).")
    if total_missing > 0:
        worst_missing = max(col_profiles, key=lambda c: c.null_pct)
        factual_findings.append(f"Data has {total_missing:,} missing cells ({missing_pct:.2f}% total). Highest in '{worst_missing.name}' ({worst_missing.null_pct}%).")
    else:
        factual_findings.append("Zero missing values: All features are 100% complete.")

    if dup_count > 0:
        factual_findings.append(f"{dup_count:,} duplicate rows ({dup_count / n_rows * 100:.1f}%) detected.")

    if total_outliers_count > 0:
        factual_findings.append(f"{total_outliers_count:,} potential outliers detected across {len(outliers_list)} numerical features via 1.5×IQR.")

    for c1, c2, r in strong_corrs[:3]:
        rel = "positive" if r > 0 else "negative"
        factual_findings.append(f"Strong {rel} correlation between '{c1}' and '{c2}' (Pearson r = {r}).")

    for cp in col_profiles:
        if cp.skewness is not None and abs(cp.skewness) > 1.5:
            factual_findings.append(f"Column '{cp.name}' exhibits severe skewness (skew = {cp.skewness:.2f}).")
            break

    # Recommendations
    if total_missing > 0:
        recommendations.append("Apply missing value imputation: Use median for numerical columns and mode/most-frequent for categorical features.")
    if dup_count > 0:
        recommendations.append("Deduplicate dataset records to avoid data leakage and model bias.")
    if constant_cols:
        recommendations.append(f"Drop constant column(s) {constant_cols}: Zero variance features provide no predictive signal.")
    if near_constant_cols:
        recommendations.append(f"Review near-constant column(s) {near_constant_cols} for potential feature removal or binning.")
    if strong_corrs:
        recommendations.append("Mitigate multicollinearity: Consider removing one feature from highly correlated pairs before linear modeling.")
    for cp in col_profiles:
        if cp.skewness is not None and abs(cp.skewness) > 1.5:
            recommendations.append(f"Apply power or log1p transformation to '{cp.name}' to stabilize variance and normalize distribution.")
            break
    if detected_target:
        recommendations.append(f"Detected likely target attribute '{detected_target}'. Validate target class balance prior to training.")

    # Agent summary calibrated from data_agnets
    agent_summary = None
    try:
        agent_summary = _summarize_dataframe(df, dataset.name, n_sample=5, skip_stats=False)
    except Exception:
        pass

    return DatasetProfile(
        dataset_id=dataset.id,
        dataset_name=dataset.name,
        file_type=file_type,
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
        health_score=health_score,
        health_summary=health_summary,
        detected_target=detected_target,
        constant_columns=constant_cols,
        near_constant_columns=near_constant_cols,
        quality_warnings=quality_warnings,
        outlier_summary=outliers_list,
        total_outliers=total_outliers_count,
        insights=AutomatedInsights(
            factual_findings=factual_findings,
            recommendations=recommendations,
        ),
        agent_summary=agent_summary,
    )

