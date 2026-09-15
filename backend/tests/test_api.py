from fastapi.testclient import TestClient

from backend.main import app
from backend.services.agent_runner import AgentRunner


client = TestClient(app)


def test_dataset_api_round_trip():
    upload = client.post(
        "/api/datasets/upload",
        files={"file": ("api.csv", b"segment,revenue\nA,12.5\nB,8.0\n", "text/csv")},
    )
    assert upload.status_code == 200
    dataset = upload.json()

    preview = client.get(f"/api/datasets/{dataset['id']}")
    assert preview.status_code == 200
    assert preview.json()["rows"] == [
        {"segment": "A", "revenue": 12.5},
        {"segment": "B", "revenue": 8.0},
    ]

    details = client.get(f"/api/datasets/{dataset['id']}/details")
    assert details.status_code == 200
    assert details.json()["stats"][0]["column"] == "revenue"


def test_agent_artifact_normalization():
    artifacts = AgentRunner._artifacts(
        {
            "data_wrangled": {"segment": {0: "A"}, "revenue": {0: 12.5}},
            "data_wrangler_function": "def wrangle(data):\n    return data",
            "plotly_graph": {"data": [], "layout": {"title": "Revenue"}},
            "data_visualization_warning": "Fallback chart used.",
        },
        "analyst",
    )
    assert [(artifact.type, artifact.title) for artifact in artifacts] == [
        ("table", "Wrangled data"),
        ("code", "Data wrangling code"),
        ("chart", "Interactive chart"),
        ("warning", "Run warning"),
    ]
