# Pandas Data Analyst App
# -----------------------
#
# Upload a tabular file, ask a question in natural language, and get back a
# table, a chart, the pandas code the agent wrote, and a workflow trace.
#
# The UI is organized into four tabs so each capability the agent already
# exposes has its own place. `PandasDataAnalyst` returns wrangled data, a
# Plotly figure, the wrangling function, the visualization function, and a
# workflow summary; the original layout rendered only the first two.
#
# Agent construction, the three-branch routing logic, and the chat-history
# bookkeeping are unchanged.

from openai import OpenAI

import streamlit as st
import pandas as pd
import plotly.io as pio
import json

from langchain_community.chat_message_histories import StreamlitChatMessageHistory
from langchain_openai import ChatOpenAI

from data_agnets import (
    PandasDataAnalyst,
    DataWranglingAgent,
    DataVisualizationAgent,
)

MODEL_LIST = ["gpt-4o-mini", "gpt-4o"]
TITLE = "Pandas Data Analyst AI Copilot"

st.set_page_config(page_title=TITLE, page_icon="📊")
st.title(TITLE)
st.markdown(
    "Upload a CSV, Parquet, JSON, or Excel file and ask questions about the data. "
    "The agent returns tables, interactive charts, the pandas code it generated, "
    "and a trace of the workflow it ran."
)

# ---------------------------------------------------------------
# Sidebar: credentials and model
# ---------------------------------------------------------------

st.sidebar.header("Model Access")

st.session_state["OPENAI_API_KEY"] = st.sidebar.text_input(
    "OpenAI API Key",
    type="password",
    help="Your OpenAI API key is required for the agent to run.",
)

if not st.session_state["OPENAI_API_KEY"]:
    st.info("Enter your OpenAI API key in the sidebar to get started.")
    st.stop()

try:
    OpenAI(api_key=st.session_state["OPENAI_API_KEY"]).models.list()
    st.sidebar.success("API key valid")
except Exception as e:
    st.sidebar.error(f"Invalid API key: {e}")
    st.stop()

model_option = st.sidebar.selectbox("OpenAI model", MODEL_LIST, index=0)

# Rebuild the agent only when the model or key changes. Compiling the
# LangGraph on every rerun (every keystroke in the chat box) is wasteful.
_agent_key = f"{model_option}:{st.session_state['OPENAI_API_KEY'][:8]}"
if st.session_state.get("_agent_key") != _agent_key:
    _llm = ChatOpenAI(model=model_option, api_key=st.session_state["OPENAI_API_KEY"])
    st.session_state["_analyst"] = PandasDataAnalyst(
        model=_llm,
        data_wrangling_agent=DataWranglingAgent(
            model=_llm,
            log=False,
            bypass_recommended_steps=True,
            n_samples=100,
        ),
        data_visualization_agent=DataVisualizationAgent(
            model=_llm,
            n_samples=100,
            log=False,
        ),
    )
    st.session_state["_agent_key"] = _agent_key

pandas_data_analyst = st.session_state["_analyst"]

# ---------------------------------------------------------------
# Data upload
# ---------------------------------------------------------------

st.sidebar.header("Data")
uploaded_file = st.sidebar.file_uploader(
    "Choose a file",
    type=["csv", "parquet", "json", "jsonl", "xlsx", "xls", "tsv"],
)

if uploaded_file is None:
    st.info("Upload a CSV, Parquet, JSON, or Excel file to get started.")
    st.stop()

fn_lower = uploaded_file.name.lower()
if fn_lower.endswith((".csv", ".csv.gz")):
    df = pd.read_csv(uploaded_file)
elif fn_lower.endswith((".tsv", ".tsv.gz")):
    df = pd.read_csv(uploaded_file, sep="\t")
elif fn_lower.endswith(".parquet"):
    df = pd.read_parquet(uploaded_file)
elif fn_lower.endswith((".jsonl", ".ndjson")):
    df = pd.read_json(uploaded_file, lines=True)
elif fn_lower.endswith(".json"):
    try:
        df = pd.read_json(uploaded_file)
    except Exception:
        try:
            uploaded_file.seek(0)
            df = pd.read_json(uploaded_file, lines=True)
        except Exception:
            uploaded_file.seek(0)
            df = pd.json_normalize(json.load(uploaded_file))
else:
    df = pd.read_excel(uploaded_file)

# ---------------------------------------------------------------
# Session state
# ---------------------------------------------------------------

msgs = StreamlitChatMessageHistory(key="langchain_messages")
if len(msgs.messages) == 0:
    msgs.add_ai_message("How can I help you?")

for _key, _default in (
    ("plots", []),
    ("dataframes", []),
    ("last_plot", None),
    ("last_df", None),
    ("last_route", None),
    ("last_wrangler_code", None),
    ("last_viz_code", None),
    ("last_workflow", None),
    ("last_error", None),
):
    if _key not in st.session_state:
        st.session_state[_key] = _default


def display_chat_history():
    """Re-render prior turns, resolving stored plot/table references."""
    for msg in msgs.messages:
        with st.chat_message(msg.type):
            if "PLOT_INDEX:" in msg.content:
                plot_index = int(msg.content.split("PLOT_INDEX:")[1])
                st.plotly_chart(
                    st.session_state.plots[plot_index], key=f"history_plot_{plot_index}"
                )
            elif "DATAFRAME_INDEX:" in msg.content:
                df_index = int(msg.content.split("DATAFRAME_INDEX:")[1])
                st.dataframe(
                    st.session_state.dataframes[df_index],
                    key=f"history_dataframe_{df_index}",
                )
            else:
                st.write(msg.content)


def _as_frame(value):
    """Normalize agent output to a DataFrame (the agent may hand back a dict)."""
    return value if isinstance(value, pd.DataFrame) else pd.DataFrame(value)


def _store_table(frame):
    index = len(st.session_state.dataframes)
    st.session_state.dataframes.append(frame)
    st.session_state.last_df = frame
    return index


def _store_chart(figure):
    index = len(st.session_state.plots)
    st.session_state.plots.append(figure)
    st.session_state.last_plot = figure
    return index


# ---------------------------------------------------------------
# Tabs
# ---------------------------------------------------------------

tab_chat, tab_result, tab_code, tab_workflow = st.tabs(
    ["💬 Chat", "📊 Last Result", "🧾 Generated Code", "🔀 Workflow"]
)

# --- Tab 1: Chat -------------------------------------------------

with tab_chat:
    st.caption(
        f"Analyzing **{uploaded_file.name}** — "
        f"{df.shape[0]:,} rows × {df.shape[1]} columns"
    )

    with st.expander("Data preview", expanded=False):
        st.dataframe(df.head())

    with st.expander("Example questions", expanded=False):
        st.write(
            """
            ##### Bikes data set

            - Show the top 5 bike models by extended sales.
            - Show the top 5 bike models by extended sales in a bar chart.
            - Show the top 5 bike models by extended sales in a pie chart.
            - Make a plot of extended sales by month for each bike model. Use a color to identify the bike models.
            """
        )

    if st.session_state.last_error:
        st.warning(st.session_state.last_error)

    display_chat_history()

    if question := st.chat_input("Enter your question here:", key="query_input"):
        st.session_state.last_error = None

        with st.spinner("Thinking..."):
            st.chat_message("human").write(question)
            msgs.add_user_message(question)

            try:
                pandas_data_analyst.invoke_agent(
                    user_instructions=question,
                    data_raw=df,
                )
                result = pandas_data_analyst.get_response() or {}
            except Exception as e:
                # Keep the session usable so the user can rephrase and retry.
                message = f"An error occurred while processing your query: {e}"
                st.session_state.last_error = message
                st.chat_message("ai").write(message)
                msgs.add_ai_message(message)
                st.stop()

            routing = result.get("routing_preprocessor_decision")
            st.session_state.last_route = routing

            # Surface the artifacts the agent produced but the UI used to drop.
            st.session_state.last_wrangler_code = (
                pandas_data_analyst.get_data_wrangler_function()
            )
            st.session_state.last_viz_code = (
                pandas_data_analyst.get_data_visualization_function()
            )
            try:
                st.session_state.last_workflow = pandas_data_analyst.get_workflow_summary()
            except Exception:
                st.session_state.last_workflow = None

            if routing == "chart" and not result.get("plotly_error", False):
                # Process chart result
                plot_data = result.get("plotly_graph")
                if plot_data:
                    # Convert dictionary to JSON string if needed
                    plot_json = (
                        json.dumps(plot_data) if isinstance(plot_data, dict) else plot_data
                    )
                    plot_obj = pio.from_json(plot_json)
                    response_text = "Returning the generated chart."
                    plot_index = _store_chart(plot_obj)
                    msgs.add_ai_message(response_text)
                    msgs.add_ai_message(f"PLOT_INDEX:{plot_index}")
                    st.chat_message("ai").write(response_text)
                    st.plotly_chart(plot_obj)
                else:
                    response_text = "The agent did not return a valid chart."
                    st.chat_message("ai").write(response_text)
                    msgs.add_ai_message(response_text)

            elif routing == "table":
                # Process table result
                data_wrangled = result.get("data_wrangled")
                if data_wrangled is not None:
                    response_text = "Returning the data table."
                    frame = _as_frame(data_wrangled)
                    df_index = _store_table(frame)
                    msgs.add_ai_message(response_text)
                    msgs.add_ai_message(f"DATAFRAME_INDEX:{df_index}")
                    st.chat_message("ai").write(response_text)
                    st.dataframe(frame)
                else:
                    response_text = "No table data was returned by the agent."
                    st.chat_message("ai").write(response_text)
                    msgs.add_ai_message(response_text)

            else:
                # Fallback if routing decision is unclear or the chart failed
                data_wrangled = result.get("data_wrangled")
                if data_wrangled is not None:
                    response_text = (
                        "I apologize. There was an issue with generating the chart. "
                        "Returning the data table instead."
                    )
                    frame = _as_frame(data_wrangled)
                    df_index = _store_table(frame)
                    msgs.add_ai_message(response_text)
                    msgs.add_ai_message(f"DATAFRAME_INDEX:{df_index}")
                    st.chat_message("ai").write(response_text)
                    st.dataframe(frame)
                else:
                    response_text = (
                        "An error occurred while processing your query. Please try again."
                    )
                    msgs.add_ai_message(response_text)
                    st.chat_message("ai").write(response_text)

# --- Tab 2: Last Result ------------------------------------------

with tab_result:
    if st.session_state.last_df is None and st.session_state.last_plot is None:
        st.caption("No results yet. Ask a question in the Chat tab.")
    else:
        if st.session_state.last_route:
            st.caption(f"Routed as: **{st.session_state.last_route}**")

        if st.session_state.last_df is not None:
            frame = st.session_state.last_df
            st.subheader("Table")
            st.caption(f"{frame.shape[0]:,} rows × {frame.shape[1]} columns")
            st.dataframe(frame, use_container_width=True)
            st.download_button(
                "Download as CSV",
                frame.to_csv(index=False).encode(),
                file_name="analyst_result.csv",
                mime="text/csv",
            )

        if st.session_state.last_plot is not None:
            st.subheader("Chart")
            st.plotly_chart(st.session_state.last_plot, use_container_width=True)

# --- Tab 3: Generated Code ---------------------------------------

with tab_code:
    st.caption(
        "The pandas code the agent wrote and executed for the most recent question. "
        "Copy either function to reproduce the result outside this app."
    )

    if not st.session_state.last_wrangler_code and not st.session_state.last_viz_code:
        st.caption("No code yet. Ask a question in the Chat tab.")
    else:
        if st.session_state.last_wrangler_code:
            st.subheader("Data wrangling")
            st.code(st.session_state.last_wrangler_code, language="python")
        if st.session_state.last_viz_code:
            st.subheader("Visualization")
            st.code(st.session_state.last_viz_code, language="python")

# --- Tab 4: Workflow ---------------------------------------------

with tab_workflow:
    st.caption(
        "Which sub-agents ran for the most recent question and what each reported."
    )
    if st.session_state.last_workflow:
        st.markdown(st.session_state.last_workflow)
    else:
        st.caption("No workflow trace yet. Ask a question in the Chat tab.")