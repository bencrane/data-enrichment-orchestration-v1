# Data Enrichment Orchestration System - Architecture Definition

## 1. System Overview

This system is a **database-backed, event-driven state machine** designed to orchestrate multi-step data enrichment workflows across batches of companies. It strictly decouples **orchestration** (Prefect) from **execution** (Modal) and **state** (Postgres).

### Core Principles
1.  **State is King**: The database is the only source of truth. If it's not in the DB, it didn't happen.
2.  **Explicit Orchestration**: The orchestrator (Prefect) acts only on DB state. It never holds business logic.
3.  **Ephemeral Workers**: Execution units (Modal functions) are stateless. They receive a task, do it, write the result, update the state, and die.
4.  **Per-Company Granularity**: Progress is tracked for every `(batch_id, company_id)` pair, allowing partial failure and resumption.

---

## 2. High-Level Architecture

### The "Brain" (Postgres Database)
The authoritative state store.
*   **Responsibility**: Tracks what has run, what is running, and what is next.
*   **Key Behavior**: It does *not* decide logic. It records facts (e.g., "Step A completed at 10:00 AM").

### The "Conductor" (Prefect)
The traffic controller.
*   **Responsibility**: Reads the Batch Blueprint and current State. Dispatches the next task to Modal.
*   **Constraints**:
    *   **Stateless**: Does not remember anything between runs.
    *   **Data-Agnostic**: Does NOT read or write business data (e.g., email addresses). Only handles IDs and Statuses.
    *   **Trigger**: Wakes up on Events (Webhooks from DB triggers).

### The "Workers" (Modal)
The execution layer.
*   **Responsibility**: Performs the actual enrichment (e.g., calls Clearbit, Clay, Exa).
*   **Data Responsibility**: **Absolute**.
    *   Receives `company_id`.
    *   Fetches input data.
    *   Calls external APIs.
    *   **Writes result data** to domain-specific tables (e.g., `clay_results`).
    *   **Updates State** to `COMPLETED` via the State API.

---

## 3. Data Model (Schema Definition)

### 3.1. Core Entities
*   **`batches`**:
    *   `id`: UUID
    *   `status`: (PENDING, IN_PROGRESS, COMPLETED, FAILED)
    *   `blueprint`: JSON array of `step_names` (e.g., `["exa_verify", "clay_enrich"]`)
    *   `client_id`: UUID
    *   `created_at`: Typescript

*   **`batch_items`**: (*Simplified Model*)
    *   `id`: UUID
    *   `batch_id`: UUID (FK)
    *   `raw_data`: JSONB (The input data: domain, name, linkedin_url, etc.)
    *   *Note*: This entity belongs exclusively to this batch. No global company linking.

### 3.2. The State Machine
*   **`workflow_states`**:
    *   `batch_id`: UUID (FK)
    *   `item_id`: UUID (FK to `batch_items`)
    *   `step_name`: String (Matches Registry)
    *   `status`: Enum (PENDING, QUEUED, IN_PROGRESS, COMPLETED, FAILED)
    *   `updated_at`: Timestamp
    *   `meta`: JSONB (Optional logs/error details)

    *Unique Constraint*: `(batch_id, item_id, step_name)` must be unique.

### 3.3. The Registry
*   **`enrichment_registry`**:
    *   `step_name`: String (PK, e.g., "clay_waterfall")
    *   `type`: Enum (SYNC, ASYNC)
    *   `modal_function_name`: String (The exact reference name in the Modal app)
    *   `config`: JSONB (Default timeout, retries, etc.)

---

## 4. Execution Flow

### Scenario: Processing a Batch

1.  **Creation**: User creates a Batch with companies [C1, C2] and Blueprint `["step_A", "step_B"]`.
    *   DB inserts rows into `workflow_states` for `step_A` as `PENDING`.
    *   *Trigger*: DB event fires -> Wakes Prefect.

2.  **Dispatch (Prefect)**:
    *   Prefect reads DB: "C1 and C2 are PENDING at step_A".
    *   Prefect looks up `step_A` in Registry -> Finds `modal_func_A`.
    *   Prefect calls `modal_func_A.spawn(company_id=C1)` (and C2).
    *   Prefect updates DB state to `QUEUED` or `IN_PROGRESS`.
    *   Prefect exits.

3.  **Execution (Modal)**:
    *   `modal_func_A` starts.
    *   It performs the API work.
    *   It saves the *data* to table `step_a_results`.
    *   It updates `workflow_states` for `(Batch 1, C1, step_A)` to `COMPLETED`.

4.  **Progression**:
    *   *Trigger*: The update to `COMPLETED` fires an event -> Wakes Prefect.
    *   Prefect reads DB: "C1 has completed step_A. Blueprint says step_B is next."
    *   Prefect checks if `step_B` row exists. If not, it creates it as `PENDING` (or this happens via DB logic).
    *   Prefect dispatches `step_B`.

---

## 5. Technology Stack & Tools

*   **Backend**: Python 3.10+
*   **Database**: Postgres (Supabase) via SQLAlchemy (Async)
*   **Orchestration**: Prefect (Cloud or Server)
*   **Compute**: Modal
*   **Knowledge/Search**: Exa (for external validation)
*   **Dev Tooling**: Context7 (docs), Sentry (errors - strict usage)

## 6. Implementation Strategy: "Tracer Bullet"

We will build the system in phases:

1.  **Phase 1: The Foundation**:
    *   Define SQLAlchemy Models.
    *   Create the DB schema.
    *   Seed a test batch with shell steps.

2.  **Phase 2: The Shells**:
    *   Create the Modal app with "Empty" functions (`step_A`, `step_B`) that sleep & update state.
    *   Populate the Registry.

3.  **Phase 3: The Conductor**:
    *   Implement the Prefect flow to read state & dispatch methods.

4.  **Phase 4: The Loop**:
    *   Run the full cycle to verify state transitions without real API calls.
