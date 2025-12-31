# Architecture Strategy: data-enrichment-orchestration-v1

**Version**: 1.0
**Date**: 2025-12-30
**Status**: Proposal / Alignment

---

## 1. Executive Summary: The "Audit-First" Architecture

We are building a **Batch-Isolated, Traceable Enrichment Engine**.
The core design philosophy is that **Execution** (running APIs) is separate from **Reporting** (clean dashboards).

We achieve this by using a **Two-Stage Data Model**:
1.  **Stage 1 (Audit Log)**: Store every API result as an immutable JSON blob. (Resiliency)
2.  **Stage 2 (Projection)**: Transform those blobs into strict Relational Tables for the dashboard. (Performance)

This document outlines why this is the only robust way to handle complex, multi-step enrichment (like "Past Employment" searches) without creating a fragile database schema.

---

## 2. Core Decisions & Tradeoffs

### Decision 1: Batch-Isolated Items vs. Global Companies
*   **Decision**: We treat every row in an upload as a "Batch Item" specific to that run. We do NOT try to deduplicate "Stripe" across all clients globally.
*   **Why**:
    *   **Reality**: Client A's view of "Stripe" (as a target) is different from Client B's view (as a partner).
    *   **Resiliency**: If we corrupt data for one batch, it doesn't poison the global database.
    *   **Tradeoff**: Storage redundancy. (Mitigated because storage is cheap; complexity is expensive).

### Decision 2: JSONB "Audit" Storage for Intermediate Steps
*   **Decision**: Run Step A -> Write JSON. Run Step B -> Write JSON. Do not flatten until the end.
*   **Why**: API Schemas change. If Clay changes their response format tomorrow, a rigid SQL table breaks. A JSON column safely stores the new format without crashing.
*   **Risk**: Querying deep JSON execution logs is slow and painful.
*   **Mitigation**: We **never** build the Dashboard directly on top of these JSON tables. see *The Consolidation Step*.

---

## 3. The "GTM Dashboard" Challenge (Past Employment)

**The Requirement**:
> "Filter people who used to work at our Customer Companies."

**The Problem**:
If we only store the Enrichment Result as a JSON blob:
```json
{ "work_history": [ { "company": "Stripe", "title": "PM" }, { "company": "Google", "title": "Eng" } ] }
```
...querying *"Find people who worked at Customer X"* requires scanning and parsing millions of JSON blobs. This is non-performant and unscalable.

**The Solution: The Consolidation (ETL) Step**
We introduce a strict **Consolidation Phase** at the end of the batch.

1.  **Extract**: The System reads the `enrichment_results` JSON.
2.  **Transform**: It parses out the `work_history` array.
3.  **Load**: It writes to a specialized Relational Table: **`person_work_history`**.

**Schema for Dashboarding**:
*   `table: person_work_history`
    *   `batch_item_id` (FK)
    *   `company_name` (String, Indexed)
    *   `title`
    *   `start_date`, `end_date`

**The Query**:
Now, the Dashboard query becomes trivial and instant:
```sql
SELECT * FROM batch_items
JOIN person_work_history ON ...
WHERE person_work_history.company_name IN (SELECT name FROM client_customers)
```

---

## 4. The Complete Data Flow

### Step 1: Ingestion (Staging)
*   **Action**: User uploads Apollo CSV.
*   **Storage**: `raw_apollo_uploads` (Full fidelity preservation).
*   **State**: Inert.

### Step 2: Execution (The Audit Log)
*   **Action**: User launches Batch. System runs Modals.
*   **Storage**: `enrichment_results` (Rows: `batch_item_id`, `step`, `json_payload`).
*   **State**: `workflow_states` tracks "Did it run?". `enrichment_results` tracks "What did it say?".

### Step 3: Consolidation (The Projector)
*   **Action**: Final "Normalization" Step runs.
*   **Storage**: Writes to:
    *   `final_leads` (The Clean Table: Name, Email, LI).
    *   `person_work_history` (The Relational Table for Filtering).
*   **State**: Ready for Dashboard.

---

## 5. Resilience & Risk Management

| Risk | Mitigation |
| :--- | :--- |
| **API Change**: External API changes response format. | We store raw JSON. The *Execution* step never fails due to schema mismatch. Only the *Consolidation* step might need an update, but the data is safely saved. |
| **Data Loss**: We overwrite a clean email with a bad one. | Impossible. Every step writes a *new* row to `enrichment_results`. We have the full history. We can replay the Consolidation logic to choose the "good" email. |
| **Performance**: Dashboard is slow. | Dashboard reads ONLY from `final_leads` and `work_history` (Indexed Relational Tables), never from the JSON blobs. |

---

## 6. Recommendation

Proceed with the **Enrichment Registry + JSONB Results** architecture for Phase 3.
Crucially, acknowledge that **Phase 4** will involve building the **Consolidation Logic** that populates the specific relational tables needed for your GTM Dashboard filters.
