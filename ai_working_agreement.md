# AI Working Agreement & Operational Protocols

## 1. Core Operating Principles
*   **Decoupling First**: Always respect the strict separation between Orchestration (Prefect), Execution (Modal), and State (Postgres). Never bleed logic across these boundaries.
*   **Tracer Bullet Methodology**: Build the full skeleton end-to-end (DB -> Orchestrator -> Worker -> DB) with empty logic *before* implementing complex business logic.
*   **State is Sacred**: Do not guess state. Read it from the DB. Do not invent next steps. Read them from the Batch Blueprint.

## 2. Tooling & MCP Usage Guidelines (MANDATORY)

You are equipped with powerful MCP servers. Use them correctly:

### Tier 1: Execution (Direct Action)
*   **`modal-mcp-server`**: **Use for all Compute.**
    *   Deploy functions, run remote jobs, manage volumes.
    *   *Rule*: If it involves running Python code that isn't the orchestrator itself, it belongs on Modal.
*   **`prefect`**: **Use for all Orchestration.**
    *   Trigger flows, monitor states.
    *   *Rule*: Prefect is the control plane. It never touches business data.

### Tier 2: Knowledge (Validation)
*   **`exa`**: **Use for External Truth.**
    *   Validating library choices, finding modern patterns, checking competitor APIs.
    *   *Rule*: Do not hallucinate external facts. If you need to know "Does Clay API support X?", ask Exa.
*   **`context7`**: **Use for Documentation.**
    *   Fetching up-to-date API docs for Pydantic, SQLAlchemy, Prefect, Modal.
    *   *Rule*: Do not rely on training data for library syntax. APIs change. Check Context7.

### Tier 3: Support
*   **`sentry`**: Use ONLY when debugging specific production errors.

## 3. Coding Standards
*   **Language**: Python 3.10+
*   **Style**: Typed Python (Pydantic models everywhere).
*   **DB Access**: SQLAlchemy (Async) with strict model definitions. No raw SQL strings unless absolutely necessary for performance.
*   **Environment**: Never hardcode credentials. Use `.env`.

## 4. Communication & Reflection
*   **Stop & Check**: After finishing a major Phase, stop and report. Do not bulldoze through 4 phases at once.
*   **Self-Correction**: If a command fails, analyze the error (using `cat` or `grep` on logs) before retrying. Do not blindly loop.
