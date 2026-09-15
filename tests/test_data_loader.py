"""Tests for data_agnets.tools.data_loader — verifies each format end-to-end."""

import json
import os
import tempfile

import pandas as pd
import pytest

from data_agnets.tools.data_loader import (
    auto_load_file,
    load_csv,
    load_json,
    load_parquet,
)


# ---------------------------------------------------------------------------
# Fixtures — tiny DataFrames written to temp files
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_df():
    return pd.DataFrame({"id": [1, 2, 3], "name": ["a", "b", "c"], "value": [1.1, 2.2, 3.3]})


@pytest.fixture
def csv_file(sample_df, tmp_path):
    p = tmp_path / "test.csv"
    sample_df.to_csv(p, index=False)
    return str(p)


@pytest.fixture
def tsv_file(sample_df, tmp_path):
    p = tmp_path / "test.tsv"
    sample_df.to_csv(p, index=False, sep="\t")
    return str(p)


@pytest.fixture
def parquet_file(sample_df, tmp_path):
    p = tmp_path / "test.parquet"
    sample_df.to_parquet(p, index=False)
    return str(p)


@pytest.fixture
def json_records_file(sample_df, tmp_path):
    """JSON file — list of records."""
    p = tmp_path / "test.json"
    p.write_text(sample_df.to_json(orient="records"), encoding="utf-8")
    return str(p)


@pytest.fixture
def json_columnar_file(sample_df, tmp_path):
    """JSON file — dict of columns (pandas default orient)."""
    p = tmp_path / "test_col.json"
    p.write_text(sample_df.to_json(orient="columns"), encoding="utf-8")
    return str(p)


@pytest.fixture
def json_nested_file(sample_df, tmp_path):
    """JSON file with records nested under a 'data' key."""
    p = tmp_path / "test_nested.json"
    payload = {"data": json.loads(sample_df.to_json(orient="records"))}
    p.write_text(json.dumps(payload), encoding="utf-8")
    return str(p)


@pytest.fixture
def jsonl_file(sample_df, tmp_path):
    p = tmp_path / "test.jsonl"
    sample_df.to_json(p, orient="records", lines=True)
    return str(p)


# ---------------------------------------------------------------------------
# CSV
# ---------------------------------------------------------------------------

class TestCSV:
    def test_load_csv(self, csv_file, sample_df):
        df = load_csv(csv_file)
        pd.testing.assert_frame_equal(df, sample_df)

    def test_auto_load_csv(self, csv_file, sample_df):
        df = auto_load_file(csv_file)
        assert isinstance(df, pd.DataFrame)
        assert list(df.columns) == ["id", "name", "value"]
        assert len(df) == 3

    def test_auto_load_tsv(self, tsv_file, sample_df):
        df = auto_load_file(tsv_file)
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 3


# ---------------------------------------------------------------------------
# Parquet  (end-to-end: write → read → compare)
# ---------------------------------------------------------------------------

class TestParquet:
    def test_load_parquet_basic(self, parquet_file, sample_df):
        df = load_parquet(parquet_file)
        assert isinstance(df, pd.DataFrame)
        pd.testing.assert_frame_equal(df, sample_df)

    def test_load_parquet_max_rows(self, parquet_file):
        df = load_parquet(parquet_file, max_rows=2)
        assert len(df) == 2

    def test_auto_load_parquet(self, parquet_file, sample_df):
        df = auto_load_file(parquet_file)
        assert isinstance(df, pd.DataFrame)
        pd.testing.assert_frame_equal(df, sample_df)

    def test_parquet_round_trip_dtypes(self, tmp_path):
        """Verify dtypes survive a Parquet round-trip (the main e2e concern)."""
        orig = pd.DataFrame({
            "int_col": pd.array([1, 2, 3], dtype="int64"),
            "float_col": [1.5, 2.5, 3.5],
            "str_col": ["x", "y", "z"],
            "bool_col": [True, False, True],
        })
        p = tmp_path / "dtypes.parquet"
        orig.to_parquet(p, index=False)
        loaded = load_parquet(str(p))
        assert loaded["int_col"].dtype.name.startswith("int")
        assert loaded["float_col"].dtype == "float64"
        assert loaded["bool_col"].dtype == "bool"

    def test_parquet_missing_file(self):
        result = auto_load_file("/nonexistent/path/file.parquet")
        assert isinstance(result, str)  # error message, not a DataFrame


# ---------------------------------------------------------------------------
# JSON  (multiple shapes)
# ---------------------------------------------------------------------------

class TestJSON:
    def test_load_json_records(self, json_records_file):
        df = load_json(json_records_file)
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 3
        assert "id" in df.columns

    def test_load_json_columnar(self, json_columnar_file):
        df = load_json(json_columnar_file)
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 3

    def test_load_json_nested_data_key(self, json_nested_file):
        df = load_json(json_nested_file)
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 3

    def test_load_jsonl(self, jsonl_file):
        df = load_json(jsonl_file, lines=True)
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 3

    def test_auto_load_json(self, json_records_file):
        df = auto_load_file(json_records_file)
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 3

    def test_auto_load_jsonl(self, jsonl_file):
        # rename to .jsonl is already done by fixture
        df = auto_load_file(jsonl_file)
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 3

    def test_json_max_rows(self, json_records_file):
        df = load_json(json_records_file, nrows=1)
        assert len(df) == 1

    def test_json_missing_file(self):
        result = auto_load_file("/nonexistent/path/file.json")
        assert isinstance(result, str)  # error message


# ---------------------------------------------------------------------------
# auto_load_file — edge cases
# ---------------------------------------------------------------------------

class TestAutoLoadEdgeCases:
    def test_unsupported_extension(self, tmp_path):
        p = tmp_path / "data.xyz"
        p.write_text("hello")
        result = auto_load_file(str(p))
        assert isinstance(result, str)
        assert "Unsupported" in result

    def test_empty_path(self):
        result = auto_load_file("")
        assert isinstance(result, str)
