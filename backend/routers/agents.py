from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.models import AgentInvocation, AgentRunCreated, AgentRunResult
from backend.services.agent_runner import agent_runner
from backend.services.workspace import workspace

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.post("/invoke", response_model=AgentRunCreated)
def invoke_agent(request: AgentInvocation) -> AgentRunCreated:
    try:
        if not request.dataset_id or request.dataset_id not in workspace._datasets:
            active_id = workspace.active_dataset_id()
            if active_id and active_id in workspace._datasets:
                request.dataset_id = active_id
            elif workspace._datasets:
                request.dataset_id = next(iter(workspace._datasets.keys()))
            else:
                sample = workspace.add_sample("telco_churn")
                request.dataset_id = sample.id

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
        last_ts: float = 0.0
        while True:
            run_obj = agent_runner.get(run_id)
            if run_obj.updated_at != last_ts:
                last_ts = run_obj.updated_at
                run = run_obj.snapshot()
                data = json.dumps(run.model_dump(mode="json"), default=str)
                event = "complete" if run.status in {"completed", "failed"} else "status"
                yield f"event: {event}\ndata: {data}\n\n"
                if run.status in {"completed", "failed"}:
                    break
            await asyncio.sleep(0.35)

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
