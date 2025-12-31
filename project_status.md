# Project Status & Milestone Tracker

## Current Phase: Phase 3.7 (Client Configuration)
*   **Status**: Core Engine Verified. Integration Verified. Pending Client-Specific Configs.
*   **Last Verified**: Multi-Step Sequence (Mock) ran end-to-end locally.
*   **Next Action**: Implement `client_workflow_configs` table and Modal integration.

---

## Milestone Log

### ✅ Phase 0: Initialization
*   [x] Repo Creation
*   [x] Architecture Definition
*   [x] AI Onboarding Documentation
*   [x] Environment Configuration (.env)

### ✅ Phase 1: The Foundation (Database)
*   [x] Define SQLAlchemy Models (`batches`, `batch_items`, `workflow_states`)
*   [x] Create Database Initialization Script (`scripts/init_schema.py`)
*   [x] **Verification**: Tables created in Supabase Postgres.

### ✅ Phase 1.5: Admin Dashboard
*   [x] Initialize Next.js 14+ App (App Router)
*   [x] Configure Tailwind CSS + Shadcn/UI
*   [x] Configure Supabase Client
*   [x] Build Home Page with Card Grid
*   [x] Build Schema Viewer (`/schema`)
*   [x] **Verification**: Dashboard running at localhost:3000.

### ✅ Phase 2.1: Apollo Staging Layer
*   [x] Add `clients` table (company_name, company_domain, first_name, last_name, email)
*   [x] Add `raw_apollo_data` staging table (40+ Apollo CSV columns)
*   [x] Build Client Manager (`/clients`) - Create/List clients
*   [x] Build Apollo Uploader - Drag & drop CSV upload with PapaParse
*   [x] Bulk insert with upload_id grouping
*   [x] **Verification**: Upload Apollo CSV and verify rows in database.

### ✅ Phase 2.2: Client-Centric Refactor & Batch Launch
*   [x] Remove global "Create Batch" from Home Page (batches require client context)
*   [x] Build Client Dashboard (`/clients/[id]`) with Shadcn Tabs
*   [x] **Tab 1: Uploads** - Upload history + New Upload drag & drop
*   [x] **Tab 2: Batches** - Batch list + "Start New Batch" launcher
*   [x] Implement `startBatchFromUpload` server action:
    *   Creates `Batch` (PENDING)
    *   ETL: Transforms `raw_apollo_data` → `BatchItems`
    *   Initializes `WorkflowState` (PENDING) for first blueprint step
*   [x] **Verification**: Upload CSV → Go to Batches tab → Launch batch from upload.

### ✅ Phase 3.1: Workflow Registry & Manager
*   [x] Add `EnrichmentRegistry` table (slug PK, name, type SYNC/ASYNC, description)
*   [x] Add `EnrichmentResult` table (batch_item_id, workflow_slug, data JSONB)
*   [x] Run schema initialization to create new tables
*   [x] Add workflow CRUD server actions
*   [x] Build Workflow Manager (`/workflows`) - List/Register workflows
*   [x] Add Workflows card to Home Page Dashboard
*   [x] Update Schema Viewer with new tables
*   [x] **Verification**: Register a test workflow via the UI.

### ✅ Phase 3.2: Explicit Registry & Smarter UI
*   [x] Add `modal_sender_fn` column to EnrichmentRegistry (function to START work)
*   [x] Add `modal_receiver_fn` column to EnrichmentRegistry (callback function for ASYNC)
*   [x] Run schema migration
*   [x] Update server actions for new fields
*   [x] Refactor create form with conditional fields:
    *   SYNC: Shows "Run Function Name" input
    *   ASYNC: Shows "Sender Function Name" + "Receiver Function Name" inputs
*   [x] Update list view to display function mappings
*   [x] Add Edit functionality to workflows page
*   [x] **Verification**: Create SYNC workflow (normalization) and ASYNC workflow (clay_enrichment).

### ✅ Phase 2.3: Upload Inspector & Batch Launcher
*   [x] Build Upload Inspector page (`/clients/[id]/uploads/[upload_id]`)
*   [x] Add `getUploadDetails` server action (fetch rows with limit)
*   [x] Display data table with key columns (Full Name, Company, Domain, Title, Country)
*   [x] Make upload history items clickable (link to inspector)
*   [x] Add "Launch Enrichment Batch" modal with workflow selector
*   [x] Fetch workflows from `enrichment_registry` for multi-select blueprint
*   [x] Add row selection (single, multi, select all) with checkbox UI
*   [x] Add pagination (25 rows per page) with navigation controls
*   [x] Add `startBatchFromSelectedRows` server action for partial launches
*   [x] Add "Clear" button on CSV uploader to reset file selection
*   [x] **Verification**: Click upload → Inspect data → Select rows → Select workflows → Launch batch.

### ✅ Phase 3.3: The Execution Layer (Modal Workers)
*   [x] Create Modal App (`src/worker.py`)
*   [x] Setup Modal Image with dependencies (sqlalchemy, asyncpg, psycopg2-binary)
*   [x] Create Modal Secret (`supabase-secrets`) for DB connection
*   [x] Implement helper functions (`_update_state`, `_record_result`)
*   [x] Fix: Added `json.dumps()` for meta dict in `_update_state` (psycopg2 JSONB compatibility)
*   [x] Implement SYNC workflow: `run_split_raw_apollo_scrape_data`
*   [x] Implement ASYNC workflow 1: `start_normalize_company_name` / `receive_normalized_company_name`
*   [x] Implement ASYNC workflow 2: `start_person_enrichment_via_clay` / `receive_person_enrichment_via_clay`
*   [x] Implement ASYNC workflow 3: `start_normalize_company_domain` / `receive_normalized_company_domain`
*   [x] Implement ASYNC workflow 4: `start_enrich_company_via_waterfall_in_clay` / `receive_enrich_company_via_waterfall_in_clay`
*   [x] Implement ASYNC workflow 5: `start_enrich_person_via_waterfall_in_clay` / `receive_enrich_person_via_waterfall_in_clay`
*   [x] **Verification**: Deployed to Modal.

### ✅ Phase 4.0: The Orchestrator (Prefect)
*   [x] Create Prefect Flow (`src/orchestrator.py`)
*   [x] Implement `fetch_pending_items` task - queries PENDING workflow_states with enrichment_registry join
*   [x] Implement `update_state_to_queued` task - prevents re-pickup by concurrent runs
*   [x] Implement `dispatch_to_modal` task - uses `modal.Function.from_name().spawn()` for async dispatch
*   [x] Create deployment script (`src/deploy_flow.py`) - 60s interval schedule
*   [x] **Verification**: Ran locally, connected to Prefect Cloud, flow completed successfully.

### ✅ Phase 3.4: Blueprint Builder UI
*   [x] Refactor Launch Modal with two-column Sequential Blueprint Builder
*   [x] Left column: Available Workflows (click to add to pipeline)
*   [x] Right column: Execution Pipeline (ordered steps with reorder controls)
*   [x] Add up/down arrows for step reordering
*   [x] Add remove button (X) for each step
*   [x] Add step numbers (1, 2, 3...) for visual clarity
*   [x] Enforce unique steps (no duplicates in pipeline)
*   [x] Show JSON preview of ordered blueprint array
*   [x] **Verification**: Build pipeline [step1, step2], verify order preserved in DB.

### ✅ Phase 3.5: Client-Specific Enrichment Pipelines
*   [x] Add `enrichment_pipelines` table (id, client_id, name, description, steps JSONB)
*   [x] Run schema migration to create table
*   [x] Add CRUD server actions (getClientPipelines, createPipeline, updatePipeline, deletePipeline)
*   [x] Refactor Client Dashboard Pipeline card to show saved pipelines list
*   [x] Add pipeline name/description inputs for saving configurations
*   [x] Add edit/delete functionality for saved pipelines
*   [x] Refactor Upload Inspector Launch Modal to select from saved pipelines
*   [x] **Verification**: Create pipeline, select it when launching batch.

### ✅ Phase 3.6: The Sequencer (Orchestrator Logic)
*   [x] Add `advanced_at` column to `workflow_states` table (idempotency flag)
*   [x] Create migration script `scripts/add_advanced_at_column.py`
*   [x] Implement `fetch_completed_for_advancement()` task
*   [x] Implement `get_batch_blueprint()` task
*   [x] Implement `spawn_next_step()` task
*   [x] Implement `mark_state_as_advanced()` task
*   [x] Implement `advance_completed_items()` flow (The Sequencer)
*   [x] Refactor main flow into `orchestrator_main()` with two phases:
    *   Phase 1: `advance_completed_items()` - spawn next steps for completed work
    *   Phase 2: `dispatch_pending_items()` - dispatch pending work to Modal
*   [x] Create `scripts/trigger_callbacks.py` - test script to simulate async callback returns
*   [x] **Verification**: Ran trigger_callbacks.py - 25/25 items successfully moved QUEUED → COMPLETED

### ✅ Phase 4.1: Integration (Manual Verification)
*   [x] End-to-End "Tracer Bullet" Run
*   [x] Launch batch from UI → Orchestrator picks up → Modal executes → Results recorded
*   [x] Verified Sequencer automatically advances items from Step 1 → Step 2
*   [x] Verified Step 2 dispatching works.

### ⬜ Phase 3.7: Client Workflow Configuration (Next Session)
*   [ ] **Database**: Create `client_workflow_configs` table
    *   Columns: `client_id`, `workflow_slug`, `config` (JSONB), `id`, `created_at`.
    *   Constraint: Unique on (client_id, workflow_slug).
*   [ ] **Server Actions**: `saveClientWorkflowConfig`, `getClientWorkflowConfig`.
*   [ ] **UI (Client Settings)**:
    *   Create `/clients/[id]/configurations` page.
    *   List all available ASYNC workflows.
    *   Add "Edit Config" button -> JSON Editor Modal.
*   [ ] **Backend (Modal)**:
    *   Update `src/worker.py` to add `_get_client_config(client_id, workflow_slug)` helper.
    *   Update `start_enrich_company_via_waterfall_in_clay` to use the fetched Webhook URL.
*   [ ] **Verification**: Launch a batch with a Configured Client and verify it hits the correct Clay Table.

### ⬜ Phase 5: Result Extraction & GTM Dashboard (Immediate Sequel)
*   [ ] **Extraction Workflow**: Targeted functions (`extract_work_history`, `extract_contact_info`) to project JSONB data into specific Relational Tables for analysis.
*   [ ] **GTM View Schema**: Define `final_leads` and `work_history` tables optimized for filtering.
*   [ ] **Work History Analysis**: Feature to trace lead movement across companies.
