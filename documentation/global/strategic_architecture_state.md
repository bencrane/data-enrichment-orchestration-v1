# Strategic Architecture State & Handover

**Version**: 1.1
**Date**: 2025-12-30
**Status**: Mid-Phase 3 (Core Engine Complete)

---

## 1. The High-Level Vision
This is an **Event-Driven, State-Machine Based Orchestration System** for B2B Data Enrichment.
It allows the User ("The Agency") to ingest raw data (csv), define custom enrichment workflows (blueprints), and execute them reliably at scale across dispersed workers (Modal), all controlled via a central Admin Dashboard.

## 2. Core Architectural Decisions

### A. The Data Model: "Batch-Isolated & Granular"
*   **Unit of Work**: `BatchItem` (Not "Company"). Every row in an upload becomes a unique item to be processed. We do *not* maintain a global "Company Registry" that batches update. This prevents data corruption across clients.
*   **Staging Layer**: Raw uploads land in `raw_apollo_uploads`. We keep every column. This is the "Source of Truth" for the Batch.
*   **Pipeline Definitions**: `enrichment_pipelines` (Client-Specific). Stores named, ordered sequences of workflow slugs.
*   **Result Storage**: 
    *   **Intermediate**: `enrichment_results` (One row per item/step). Stores distinct JSONB payloads.
    *   **Final**: A "Consolidation" step (future) projects these JSON blobs into Relational Tables (`final_leads`, `person_work_history`) for the Dashboard.

### B. The Execution Engine: "State-Driven Sequencer"
*   **The Driver**: The `workflow_states` table.
    *   Columns: `batch_item_id`, `step_name`, `status` (PENDING, IN_PROGRESS, COMPLETED, FAILED), `advanced_at` (Timestamp).
*   **The Sequencer**: `advance_completed_items`.
    *   Logic: Monitors COMPLETED items. Checks `Batch.blueprint` (Ordered Slugs). Creates PENDING state for Step N+1.
*   **The Bridge**: `src/orchestrator.py` (Prefect Flow) loops: Sequencer -> Dispatcher (to Modal).

### C. Async Pattern: "Strict Decoupling"
*   **Sender Function**: `start_...`. Logic: Call API -> Set `IN_PROGRESS`. **Stops.**
*   **Receiver Function**: `receive_...`. Logic: Recieving Payload -> Set `COMPLETED`.
*   **The Gap**: The gap is bridged by the Orchestrator (polling) or Webhooks (future). The Sender never assumes the Receiver exists.

## 3. Current Implementation Status

### Database (Supabase)
*   `clients`, `raw_apollo_uploads`: Foundation.
*   `enrichment_registry`: Global Workflow Definitions.
*   `enrichment_pipelines`: Client-specific ordered sequences (Saved Blueprints).
*   `batches`: Execution Runs. Contains `blueprint` snapshots.
*   `batch_items`: Entities. Recently updated to include Identity Columns (`company_domain`, `linkedin`, `industry`) + `original_data` (JSONB).
*   `workflow_states`: Includes `advanced_at` for Sequencer idempotency.

### Admin UI (Next.js / Shadcn)
*   **Client-Centric**: `/clients/[id]`.
*   **Pipeline Manager**: `/clients/[id]/pipelines`. Drag-and-drop builder for defining sequences.
*   **Upload Inspector**: Launch Modal selects from Saved Pipelines.
*   **Workflow Registry**: `/workflows`.

### Backend (Modal & Prefect)
*   `src/worker.py`: Full Implementation.
    *   Includes: `split_raw`, `normalize_name`, `normalize_domain`, `enrich_company_clay`, `enrich_person_clay`.
*   `src/orchestrator.py`: Full Engine.
    *   `advance_completed_items` (Sequencer).
    *   `dispatch_pending_items` (Dispatcher).
    *   Includes logic to reset/retry and handle missing functions.

## 4. Immediate Next Steps (The "Configuration" Gap)

**Problem**: The "Clay" workflows are generic code, but each Client has a unique Clay Table URL.
**Solution**: **Phase 3.7: Client Workflow Configuration (COMPLETED)**.

1.  **Database**: `client_workflow_configs` table. (FK Client, FK Workflow Slug, JSON Config).
2.  **UI**: Interface to set specific URLs/Keys for a Client's use of a Workflow.
3.  **Backend**: Update Modal Workers to lookup this config at runtime.

## 5. Phase 5: Result Extraction (Upcoming)

**The Challenge**: We have JSONB blobs in `enrichment_results`. We need to query them efficiently (e.g. "Find all people who worked at Customer X").
**The Solution**: Targeted Extraction Workflow.
1.  Read `enrichment_results`.
2.  Parse specific fields (Work History).
3.  Write to Relational Tables (`person_work_history`).

## 5. Technical Context for Handover
*   **Environment**: Python 3.10+, Node 18+.
*   **Secrets**: `.env` (PROJECT_ID, DB Connection).
*   **Modal**: `modal deploy src/worker.py`.
*   **Prefect**: `python src/orchestrator.py` (Local run) or `deploy_flow.py` (Cloud).

**To Resume Work**:
1.  Read this file.
2.  Check `ai_working_agreement.md`.
3.  Proceed to **Phase 3.7 (Client Config)**.
