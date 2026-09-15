"""Importing the data loader must not drag in the optional agent stack.

Regression guard for the eager-import bug. `data_agnets/__init__.py` used to
import every agent at package import, so a machine missing an *optional* dep
(h2o, mlflow, langchain_ollama) could not load a CSV at all — the failure
surfaced as "No module named 'langchain_ollama'" during dataset upload.

langchain-core itself is a core requirement and is expected to be imported;
the data loader uses its @tool decorator.
"""

import subprocess
import sys

PROBE = """
import sys
import data_agnets.tools.data_loader

# The agent packages are what pull in optional deps (h2o, mlflow, langchain_ollama).
leaked = sorted(
    m for m in sys.modules
    if m == "data_agnets.agents"
    or m.startswith(("data_agnets.agents.", "data_agnets.ml_agents", "data_agnets.ds_agents", "data_agnets.multiagents"))
    or m.startswith(("h2o", "mlflow", "langchain_ollama", "langchain_openai", "langchain_community"))
)
assert not leaked, f"tools.data_loader pulled in the agent stack: {leaked}"
print("ok")
"""


def test_data_loader_does_not_import_optional_agent_stack():
    result = subprocess.run([sys.executable, "-c", PROBE], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "ok"


def test_public_agents_still_resolve():
    import data_agnets

    # Lazy lookup must still hand back the real class.
    assert data_agnets.DataCleaningAgent.__name__ == "DataCleaningAgent"
    assert data_agnets.PandasDataAnalyst.__name__ == "PandasDataAnalyst"


def test_unknown_attribute_raises():
    import pytest

    import data_agnets

    with pytest.raises(AttributeError):
        data_agnets.NotARealAgent