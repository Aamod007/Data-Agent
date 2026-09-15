from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.models import AgentInvocation, AgentRunCreated, AgentRunResult
from backend.services.agent_runner import agent_runner

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.post("/invoke", response_model=AgentRunCreated)
def invoke_agent(request: AgentInvocation) -> AgentRunCreated:
    try:
        run = agent_runner.start(request)
        return AgentRunCreated(run_id=run.id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc


@router.get("", response_model=list[AgentRunResult])
def list_completed_runs() -> list[AgentRunResult]:
    return agent_runner.completed()


@router.get("/{run_id}", response_model=AgentRunResult)
def get_run(run_id: str) -> AgentRunResult:
    try:
        return agent_runner.get(run_id).snapshot()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Run not found") from exc


@router.get("/{run_id}/events")
async def stream_run(run_id: str) -> StreamingResponse:
    try:
        agent_runner.get(run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Run not found") from exc

    async def events():
        last_signature: str | None = None
        while True:
            run = agent_runner.get(run_id).snapshot()
            data = run.model_dump(mode="json")
            signature = json.dumps(data, sort_keys=True, default=str)
            if signature != last_signature:
                event = "complete" if run.status in {"completed", "failed"} else "status"
                yield f"event: {event}\ndata: {signature}\n\n"
                last_signature = signature
            if run.status in {"completed", "failed"}:
                break
            await asyncio.sleep(0.35)

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
