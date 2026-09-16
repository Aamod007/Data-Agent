import os
import sys
from pathlib import Path
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import agents, config, datasets, eda, pipeline

app = FastAPI(title="Data Agents API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://[::1]:3000",
        "http://0.0.0.0:3000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(datasets.router)
app.include_router(eda.router)
app.include_router(agents.router)
app.include_router(config.router)
app.include_router(pipeline.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.environ.get("PORT", "8001"))
    uvicorn.run("backend.main:app", host="127.0.0.1", port=port, reload=True)
