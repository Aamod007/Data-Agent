from fastapi import APIRouter

from backend.models import DatasetSummary
from backend.services.workspace import workspace

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


@router.get("", response_model=list[DatasetSummary])
def pipeline() -> list[DatasetSummary]:
    """Expose dataset lineage for the React Flow workspace canvas."""
    return workspace.list_datasets()
