# Contributing

Thanks for your interest in contributing to Data Agents. This document explains how to set up a development environment, make changes, and submit them for review.

## Development setup

1. Fork the repository and clone your fork:

```bash
git clone https://github.com/<your-username>/ai-data-science-team.git
cd ai-data-science-team
```

2. Create a virtual environment and install the package in editable mode:

```bash
python -m venv .venv
.venv\Scripts\activate   # On Windows
# source .venv/bin/activate  # On macOS/Linux

pip install -e ".[all]"
```

3. Set up your API key. Copy the example environment file and add your OpenAI key:

```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

## Making changes

1. Create a branch for your work:

```bash
git checkout -b your-branch-name
```

2. Make your changes. Keep commits focused -- one logical change per commit is easier to review than a single commit that touches ten unrelated things.

3. If you are adding a new agent, follow the existing patterns in `ai_data_science_team/agents/`. Every agent subclasses `BaseAgent` from `ai_data_science_team/templates/agent_templates.py` and implements `_make_compiled_graph()`.

4. If you are adding a new tool, place it in `ai_data_science_team/tools/` and make sure it is a proper LangChain tool (decorated with `@tool` or using the `Tool` class).

5. Update the relevant `__init__.py` files so your new classes are importable from the top-level package.

## Code style

- Follow PEP 8 for Python code.
- Use type hints where practical.
- Write docstrings for public classes and functions. The existing codebase uses NumPy-style docstrings -- stick with that convention.
- Keep imports organized: standard library first, third-party second, local imports third.

## Testing your changes

Before submitting, verify that your changes work:

- Run any relevant example notebooks in `examples/` to make sure existing functionality still works.
- If you changed an agent, test it with at least one real dataset and a couple of different instruction prompts.
- If you added a new app or modified an existing one, start it with `streamlit run` and click through the main workflows.

## Submitting a pull request

1. Push your branch to your fork:

```bash
git push origin your-branch-name
```

2. Open a pull request against the `master` branch of this repository.

3. In the PR description, explain:
   - What you changed and why
   - How you tested it
   - Any breaking changes or migration steps

4. Keep the PR reasonably sized. Large PRs take longer to review and are more likely to have merge conflicts. If your change is big, consider splitting it into a series of smaller PRs.

## Reporting bugs

Open an issue on GitHub with:

- A clear title describing the problem
- Steps to reproduce it
- What you expected to happen versus what actually happened
- Your Python version, OS, and the versions of key dependencies (langchain, langgraph, openai)

## Suggesting features

Open an issue with the "feature request" label. Describe the use case you have in mind and why the current library does not cover it. Concrete examples help a lot.

## License

By contributing, you agree that your contributions will be licensed under the MIT License that covers this project.
