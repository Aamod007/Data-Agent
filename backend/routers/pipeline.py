from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import PlainTextResponse

from backend.models import (
    DatasetSummary,
    PipelineCompareResponse,
    PipelineLineageNode,
    PipelineSnapshotResponse,
    RunDraftRequest,
)
from backend.services.workspace import records_for_json, workspace
from data_agnets.utils.pipeline import (
    build_pipeline_snapshot,
    build_reproducible_pipeline_script,
)

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


@router.get("", response_model=PipelineSnapshotResponse)
def get_pipeline_snapshot(target: str = Query(default="model")) -> PipelineSnapshotResponse:
    """Expose dataset lineage snapshot for AI Pipeline Studio."""
    pipe_dict = workspace.to_pipeline_dict()
    active_id = workspace.active_dataset_id()
    snap = build_pipeline_snapshot(pipe_dict, active_dataset_id=active_id, target=target)

    lineage_nodes: list[PipelineLineageNode] = []
    target_id = snap.get("target_dataset_id")
    for item in snap.get("lineage") or []:
        did = str(item.get("id") or "")
        shape = item.get("shape")
        lineage_nodes.append(
            PipelineLineageNode(
                id=did,
                label=item.get("label") or did,
                stage=item.get("stage") or "raw",
                parent_id=item.get("parent_ids", [None])[0] if item.get("parent_ids") else None,
                parent_ids=[str(p) for p in (item.get("parent_ids") or [])],
                shape=(int(shape[0]), int(shape[1])) if shape and len(shape) >= 2 else None,
                transform_kind=item.get("transform_kind"),
                is_target=did == target_id,
                is_active=did == active_id,
            )
        )

    return PipelineSnapshotResponse(
        pipeline_hash=snap.get("pipeline_hash"),
        target_dataset_id=target_id,
        active_dataset_id=active_id,
        target=target,
        lineage=lineage_nodes,
        datasets=workspace.list_datasets(),
    )


@router.get("/script", response_class=PlainTextResponse)
def get_pipeline_script(target_id: Optional[str] = None) -> Response:
    """Generate reproducible Python script for replaying lineage to target."""
    pipe_dict = workspace.to_pipeline_dict()
    active_id = workspace.active_dataset_id()
    snap = build_pipeline_snapshot(pipe_dict, active_dataset_id=active_id, target="model")
    chosen_target = target_id or snap.get("target_dataset_id") or active_id
    if not chosen_target:
        return Response(content="# No datasets in workspace to generate script for.\n", media_type="text/x-python")

    script = build_reproducible_pipeline_script(pipe_dict, target_dataset_id=chosen_target)
    return Response(content=script, media_type="text/x-python")


@router.get("/spec")
def get_pipeline_spec(target: str = Query(default="model")) -> dict[str, Any]:
    """Export full pipeline specification JSON."""
    pipe_dict = workspace.to_pipeline_dict()
    active_id = workspace.active_dataset_id()
    return build_pipeline_snapshot(pipe_dict, active_dataset_id=active_id, target=target)


@router.get("/registry")
def get_pipeline_registry() -> dict[str, Any]:
    """Export pipeline dataset registry."""
    return workspace.to_pipeline_dict()


@router.post("/undo", response_model=Optional[DatasetSummary])
def undo_pipeline_step() -> Optional[DatasetSummary]:
    """Undo the latest derived step in the pipeline."""
    return workspace.undo()


@router.post("/redo", response_model=Optional[DatasetSummary])
def redo_pipeline_step() -> Optional[DatasetSummary]:
    """Redo the latest undone step in the pipeline."""
    return workspace.redo()


@router.get("/compare", response_model=PipelineCompareResponse)
def compare_nodes(node_a: str = Query(...), node_b: str = Query(...)) -> PipelineCompareResponse:
    """Compare two pipeline dataset nodes (schema diff, shape delta, and sample previews)."""
    try:
        ds_a = workspace.get_dataset(node_a)
        ds_b = workspace.get_dataset(node_b)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset node not found") from exc

    cols_a = list(ds_a.frame.columns)
    cols_b = list(ds_b.frame.columns)
    set_a = set(cols_a)
    set_b = set(cols_b)

    added_cols = [c for c in cols_b if c not in set_a]
    removed_cols = [c for c in cols_a if c not in set_b]
    common_cols = [c for c in cols_b if c in set_a]

    dtype_changes: list[dict[str, str]] = []
    missingness_delta: list[dict[str, Any]] = []

    for col in common_cols:
        dt_a = str(ds_a.frame[col].dtype)
        dt_b = str(ds_b.frame[col].dtype)
        if dt_a != dt_b:
            dtype_changes.append({"column": col, "dtype_a": dt_a, "dtype_b": dt_b})

        nulls_a = int(ds_a.frame[col].isna().sum())
        nulls_b = int(ds_b.frame[col].isna().sum())
        if nulls_a != nulls_b:
            missingness_delta.append({
                "column": col,
                "nulls_a": nulls_a,
                "nulls_b": nulls_b,
                "diff": nulls_b - nulls_a,
            })

    preview_a = records_for_json(ds_a.frame.head(20))
    preview_b = records_for_json(ds_b.frame.head(20))

    return PipelineCompareResponse(
        node_a_id=ds_a.id,
        node_b_id=ds_b.id,
        shape_a=(int(ds_a.frame.shape[0]), int(ds_a.frame.shape[1])),
        shape_b=(int(ds_b.frame.shape[0]), int(ds_b.frame.shape[1])),
        added_columns=added_cols,
        removed_columns=removed_cols,
        common_columns=common_cols,
        dtype_changes=dtype_changes,
        missingness_delta=missingness_delta,
        preview_a=preview_a,
        preview_b=preview_b,
    )


@router.post("/run-draft", response_model=DatasetSummary)
def run_pipeline_draft(payload: RunDraftRequest) -> DatasetSummary:
    """Execute Python transform code on dataset and produce a derived step."""
    try:
        ds = workspace.get_dataset(payload.dataset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc

    import numpy as np
    import pandas as pd

    exec_env: dict[str, Any] = {"pd": pd, "np": np}
    try:
        exec(payload.code, exec_env, exec_env)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Code execution error: {exc}") from exc

    fn = None
    for name, obj in exec_env.items():
        if callable(obj) and not name.startswith("_"):
            fn = obj
            break
    if not fn:
        raise HTTPException(
            status_code=400,
            detail="No callable transform function found (e.g. def transform(df): ...).",
        )

    try:
        out_df = fn(ds.frame.copy())
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Transform execution failed: {exc}"
        ) from exc

    if not isinstance(out_df, pd.DataFrame):
        raise HTTPException(
            status_code=400,
            detail="Transform function must return a pandas DataFrame.",
        )

    derived = workspace.add_derived(
        parent_id=ds.id,
        frame=out_df,
        stage=payload.stage or "custom",
        operation=payload.code,
    )
    return derived.summary(workspace.active_dataset_id())


@router.delete("/nodes/{dataset_id}")
def delete_pipeline_node(
    dataset_id: str, clear_history: bool = False
) -> dict[str, str]:
    """Delete a dataset node and optionally clear undo/redo history."""
    workspace.remove_dataset(dataset_id)
    if clear_history:
        with workspace._lock:
            workspace._undo_stack.clear()
            workspace._redo_stack.clear()
    return {"status": "deleted", "dataset_id": dataset_id}

