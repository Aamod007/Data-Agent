from __future__ import annotations

import io
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.models import DatasetDetails, DatasetPreview, DatasetSummary
from backend.services.workspace import records_for_json, workspace

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("", response_model=list[DatasetSummary])
def list_datasets() -> list[DatasetSummary]:
    return workspace.list_datasets()


@router.get("/samples")
def list_sample_datasets() -> list[dict[str, str]]:
    return workspace.list_samples()


@router.post("/samples/{sample_id}", response_model=DatasetSummary)
def load_sample_dataset(sample_id: str) -> DatasetSummary:
    try:
        dataset = workspace.add_sample(sample_id)
        return dataset.summary(workspace.active_dataset_id())
    except (KeyError, FileNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/upload", response_model=DatasetSummary)
async def upload_dataset(file: Annotated[UploadFile, File(...)]) -> DatasetSummary:
    try:
        dataset = workspace.add_upload(
            original_name=file.filename or "upload",
            content=await file.read(),
        )
        return dataset.summary(workspace.active_dataset_id())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


class LoadLocalRequest(BaseModel):
    directory: str


@router.post("/load-local", response_model=list[DatasetSummary])
def load_local_directory(payload: LoadLocalRequest) -> list[DatasetSummary]:
    """Load all supported tabular files from a local directory path."""
    directory = payload.directory.strip()
    if not directory:
        raise HTTPException(status_code=422, detail="No directory path provided.")
    try:
        loaded = workspace.add_from_local_directory(directory)
        return [ds.summary(workspace.active_dataset_id()) for ds in loaded]
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc



@router.get("/{dataset_id}", response_model=DatasetPreview)
def preview_dataset(
    dataset_id: str,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
) -> DatasetPreview:
    try:
        dataset = workspace.get_dataset(dataset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc
    frame = dataset.frame.iloc[offset : offset + limit]
    return DatasetPreview(
        dataset=dataset.summary(workspace.active_dataset_id()),
        columns=workspace.columns(dataset.frame),
        rows=records_for_json(frame),
        total_rows=len(dataset.frame),
        offset=offset,
        limit=limit,
    )


@router.get("/{dataset_id}/details", response_model=DatasetDetails)
def dataset_details(dataset_id: str) -> DatasetDetails:
    try:
        dataset = workspace.get_dataset(dataset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc
    suffix = dataset.path.suffix.lower() or ".csv"
    return DatasetDetails(
        dataset=dataset.summary(workspace.active_dataset_id()),
        columns=workspace.columns(dataset.frame),
        stats=workspace.stats(dataset.frame),
        load_code=f"import pandas as pd\n\ndf = pd.read_{'parquet' if suffix == '.parquet' else 'csv'}({dataset.path.name!r})",
    )


@router.post("/{dataset_id}/active", response_model=DatasetSummary)
def set_active_dataset(dataset_id: str) -> DatasetSummary:
    try:
        return workspace.set_active(dataset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc


@router.get("/{dataset_id}/download")
def download_dataset(dataset_id: str, format: str = Query(default="csv", pattern="^(csv|parquet)$")) -> StreamingResponse:
    try:
        dataset = workspace.get_dataset(dataset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc
    buffer = io.BytesIO()
    if format == "parquet":
        dataset.frame.to_parquet(buffer, index=False)
        media_type = "application/vnd.apache.parquet"
        filename = f"{dataset.name}.parquet"
    else:
        buffer.write(dataset.frame.to_csv(index=False).encode())
        media_type = "text/csv"
        filename = f"{dataset.name}.csv"
    buffer.seek(0)
    return StreamingResponse(buffer, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.delete("/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: str) -> None:
    try:
        workspace.get_dataset(dataset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc
    workspace.remove_dataset(dataset_id)
