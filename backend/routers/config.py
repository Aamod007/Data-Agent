from fastapi import APIRouter

from backend.models import ConfigUpdate, PublicConfig
from backend.services.workspace import workspace

router = APIRouter(prefix="/api/config", tags=["config"])


def public_config(config: ConfigUpdate) -> PublicConfig:
    return PublicConfig(
        provider=config.provider,
        model=config.model,
        has_api_key=bool(config.api_key),
        base_url=config.base_url,
        sql_url=config.sql_url,
    )


@router.get("", response_model=PublicConfig)
def get_config() -> PublicConfig:
    return public_config(workspace.config())


@router.put("", response_model=PublicConfig)
def update_config(update: ConfigUpdate) -> PublicConfig:
    return public_config(workspace.update_config(update))
