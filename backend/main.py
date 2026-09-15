from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import agents, config, datasets, eda, pipeline

app = FastAPI(title="Data Agents API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
