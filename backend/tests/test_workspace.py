import pandas as pd

from backend.services import workspace as workspace_module
from backend.services.workspace import Workspace


def test_upload_registers_preview_and_schema(tmp_path, monkeypatch):
    monkeypatch.setattr(workspace_module, "UPLOADS_DIR", tmp_path)
    store = Workspace()

    dataset = store.add_upload(
        original_name="sales data.csv",
        content=b"region,amount\nNorth,12.5\nSouth,8.0\n",
    )

    assert dataset.name == "sales-data"
    assert dataset.frame.shape == (2, 2)
    assert store.list_datasets()[0].is_active is True
    assert store.columns(dataset.frame) == [
        {"name": "region", "dtype": "object", "nulls": 0, "unique": 2},
        {"name": "amount", "dtype": "float64", "nulls": 0, "unique": 2},
    ]


def test_records_for_json_serializes_pandas_values():
    frame = pd.DataFrame({"when": [pd.Timestamp("2026-01-01")], "value": [float("nan")]})
    assert workspace_module.records_for_json(frame) == [{"when": "2026-01-01T00:00:00", "value": None}]
