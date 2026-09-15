"""Data Agnets — lazily-imported public surface.

Importing this package (or the pure-pandas `data_agnets.tools.*` helpers) must
not pull in langchain/langgraph. The backend loads and previews datasets with
no LLM configured; eager imports here made that path require the entire agent
stack, and produced spurious "No module named 'langchain_ollama'" failures.
"""

from importlib import import_module

# public name -> (module, attribute)
_LAZY: dict[str, tuple[str, str]] = {
    # data_agnets.agents
    "DataCleaningAgent": ("data_agnets.agents", "DataCleaningAgent"),
    "DataLoaderToolsAgent": ("data_agnets.agents", "DataLoaderToolsAgent"),
    "DataVisualizationAgent": ("data_agnets.agents", "DataVisualizationAgent"),
    "SQLDatabaseAgent": ("data_agnets.agents", "SQLDatabaseAgent"),
    "DataWranglingAgent": ("data_agnets.agents", "DataWranglingAgent"),
    "FeatureEngineeringAgent": ("data_agnets.agents", "FeatureEngineeringAgent"),
    # data_agnets.ds_agents
    "EDAToolsAgent": ("data_agnets.ds_agents", "EDAToolsAgent"),
    # data_agnets.ml_agents
    "H2OMLAgent": ("data_agnets.ml_agents", "H2OMLAgent"),
    "MLflowToolsAgent": ("data_agnets.ml_agents", "MLflowToolsAgent"),
    # data_agnets.multiagents
    "SQLDataAnalyst": ("data_agnets.multiagents", "SQLDataAnalyst"),
    "PandasDataAnalyst": ("data_agnets.multiagents", "PandasDataAnalyst"),
}

__all__ = sorted(_LAZY)


def __getattr__(name: str):
    """Resolve a public agent on first access (PEP 562)."""
    try:
        module_name, attribute = _LAZY[name]
    except KeyError:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}") from None
    value = getattr(import_module(module_name), attribute)
    globals()[name] = value  # cache so repeat lookups skip __getattr__
    return value


def __dir__() -> list[str]:
    return __all__