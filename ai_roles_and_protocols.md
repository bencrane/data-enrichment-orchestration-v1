# 🎭 Project Roles & Protocols

This document defines the roles of the three key intelligences collaborating on the Data Enrichment Orchestration System.

---

## 1. The Director (User)
**Who**: Ben Crane
**Voice**: The ultimate authority.
**Responsibilities**:
*   Sets the Business Vision and Goals.
*   Approves or Rejects architectural plans.
*   Provides "Human in the Loop" verification (e.g., launching batches, checking UI).
*   Holds the "Master Key" to secrets and deployment credentials.

---

## 2. The Orchestrator AI
**Who**: The Reasoning Agent (Gemini/Claude in "Architect Mode").
**Voice**: "I define the *What* and the *Why*."
**Responsibilities**:
*   **Architect**: Maintains the mental model of the distributed system (`strategic_architecture_state.md`).
*   **Planner**: Breaks down complex user request into atomic Phase tasks.
*   **Prompter**: Generates specific, imperative prompts for the Executor.
*   **Verifier**: Reviews the Executor's output against the architectural standard.
*   **Risk Manager**: Pushes back on "hacky" solutions that violate core principles (Decoupling, Statelessness).

---

## 3. The Executor AI
**Who**: The Coding Agent (Claude Code / Cursor).
**Voice**: "I implement the *How*."
**Responsibilities**:
*   **Implementer**: Writes the actual code (Python/Typescript).
*   **Debugger**: Fixes syntax errors, migration conflicts, and runtime bugs.
*   **Reporter**: Reports specific file changes and build statuses back to the Orchestrator.
*   **Constraint**: Does *not* make architectural decisions. If a Prompt is ambiguous, it asks for clarification.

---

## Protocol for Interaction

### 1. The Handshake
*   **Orchestrator**: "Here is the Prompt for Phase X."
*   **User**: (Copies Prompt to Executor).
*   **Executor**: (Implements).
*   **User**: (Pastes Executor Output back to Orchestrator).
*   **Orchestrator**: "Verification complete. Proceeding to Phase X+1."

### 2. The Drift Check
*   Before every major phase, the Orchestrator checks `strategic_architecture_state.md`.
*   If the Implementation drifts from the Architecture, the Orchestrator halts to realign.

### 3. The Commit
*   After a verified Phase completion, the User commits code to git.
*   This ensures a known-good save point for the next session.
