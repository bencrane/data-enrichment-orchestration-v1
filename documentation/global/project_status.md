# Project Status & Milestone Tracker

## Current Phase: Phase 6 (Multi-Workstream Admin Dashboard)
*   **Status**: Admin Dashboard expanded with multiple client-specific workstreams.
*   **Last Verified**: January 2026 - CRM Data Upload workstream complete.
*   **Next Action**: Implement Global Ingest functionality or continue with Phase 5 extraction.

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
*   [x] Migrate to Prefect Managed infrastructure (no self-hosted workers)
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

### ✅ Phase 3.7: Client Workflow Configuration
*   [x] **Database**: Create `client_workflow_configs` table
    *   Columns: `client_id`, `workflow_slug`, `config` (JSONB), `id`, `created_at`.
    *   Constraint: Unique on (client_id, workflow_slug).
*   [x] **Server Actions**: `saveClientWorkflowConfig`, `getClientWorkflowConfig`.
*   [x] **UI (Client Settings)**:
    *   Create `/clients/[id]/configurations` panel (Collapsible Card).
    *   List all available ASYNC workflows.
    *   Add "Edit Config" button -> JSON Editor Modal.
*   [x] **Backend (Modal)**:
    *   Update `src/worker.py` to add `_get_client_config(client_id, workflow_slug)` helper.
    *   Update `start_enrich_company_via_waterfall_in_clay` to use the fetched Webhook URL.
*   [x] **Verification**: Verified UI allows saving configs and workers act on them.

---

### ✅ Phase 6: Multi-Workstream Admin Dashboard

This phase introduces a modular, workstream-based architecture for the admin dashboard, allowing multiple data source types to be managed independently per client.

#### 6.1 Client Dashboard Refactor
*   [x] Refactor Client Dashboard (`/clients/[id]`) from tabs to card-based navigation
*   [x] Each workstream gets its own card linking to dedicated sub-pages
*   [x] Consistent card structure: Upload, Past Uploads, Pipelines, Config

#### 6.2 Apollo Scrape Ingest Workstream
*   [x] Create `/clients/[id]/apollo-ingest/` page structure
*   [x] Implement Upload page with CSV parsing
*   [x] Implement Past Uploads page
*   [x] Implement Pipelines page with workstream isolation (`apollo_scrape`)
*   [x] Implement Config page with workstream isolation

#### 6.3 Customer Companies Workstream
*   [x] **Database**: Create `client_customer_companies` table
    *   Columns: `id`, `client_id`, `upload_id`, `company_name`, `domain`, `company_linkedin_url`, `created_at`
*   [x] **Server Actions**: `getCustomerCompanyUploads`, `uploadCustomerCompanies`
*   [x] Create `/clients/[id]/customer-companies/` page structure
*   [x] Implement Upload page with flexible CSV header mapping
*   [x] Implement Past Uploads page
*   [x] Implement Pipelines page with workstream isolation (`customer_companies`)
*   [x] Implement Config page with workstream isolation
*   [x] Add Customer Companies card to Client Dashboard (emerald color)

#### 6.4 SalesNav KoolKit Workstream
*   [x] **Database**: Create `client_salesnav_koolkit` table
    *   Columns: 21 fields including `matching_filters`, `linkedin_user_profile_urn`, `first_name`, `last_name`, `email`, `phone_number`, `profile_headline`, `profile_summary`, `job_title`, `job_description`, `job_started_on`, `linkedin_url_user_profile`, `location`, `company`, `linkedin_company_profile_urn`, `linkedin_url_company`, `company_website`, `company_description`, `company_headcount`, `company_industries`, `company_registered_address`
*   [x] **Server Actions**: `getSalesNavKoolKitUploads`, `uploadSalesNavKoolKit`
*   [x] Create `/clients/[id]/salesnav-koolkit/` page structure
*   [x] Implement Upload page with extensive CSV header mapping (handles parentheses in headers)
*   [x] Implement Past Uploads page
*   [x] Implement Pipelines page with workstream isolation (`salesnav_koolkit`)
*   [x] Implement Config page with workstream isolation
*   [x] Add SalesNav KoolKit card to Client Dashboard (blue/LinkedIn color)

#### 6.5 CRM Data Upload Workstream
*   [x] **Database**: Create `client_crm_data` table
    *   Columns: `id`, `client_id`, `upload_id`, `company_name`, `domain`, `company_linkedin_url`, `first_name`, `last_name`, `person_linkedin_url`, `work_email`, `mobile_phone`, `notes`, `created_at`
    *   All fields nullable TEXT
*   [x] **Server Actions**: `getCrmDataUploads`, `uploadCrmData`
*   [x] Create `/clients/[id]/crm-data/` page structure
*   [x] Implement Upload page with flexible CSV header mapping
*   [x] Implement Past Uploads page
*   [x] Implement Pipelines page with workstream isolation (`crm_data`)
*   [x] Implement Config page with workstream isolation
*   [x] Add CRM Data Upload card to Client Dashboard (rose color)

#### 6.6 Documentation
*   [x] Create `documentation/guides/adding_new_workstream.md`
    *   Step-by-step guide for adding new workstreams
    *   Database table template with indexes
    *   Server actions template (types, get uploads, upload function)
    *   Page structure template (5 pages)
    *   CSV header mapping pattern
    *   Client dashboard card integration

#### 6.7 Main Dashboard Updates
*   [x] Add Global Ingest placeholder card (Coming Soon)
*   [x] Existing cards: Client Manager, Workflow Registry, Table Schema Viewer
*   [x] Placeholder cards: Batch Monitor, Workflow States, Global Ingest

---

### ⬜ Phase 5: Result Extraction & GTM Dashboard (Pending)
*   [ ] **Extraction Workflow**: Targeted functions (`extract_work_history`, `extract_contact_info`) to project JSONB data into specific Relational Tables for analysis.
*   [ ] **GTM View Schema**: Define `final_leads` and `work_history` tables optimized for filtering.
*   [ ] **Work History Analysis**: Feature to trace lead movement across companies.

### ⬜ Phase 7: Global Ingest (Planned)
*   [ ] Implement cross-client data ingestion functionality
*   [ ] Build Global Ingest UI (`/global-ingest`)
*   [ ] Enable data sharing/deduplication across clients

---

## Current Architecture

### Admin Dashboard Structure
```
/                           → Home (6 cards: Client Manager, Workflow Registry, Schema Viewer, + 3 Coming Soon)
/clients                    → Client list + create
/clients/[id]               → Client dashboard with workstream cards
/clients/[id]/apollo-ingest → Apollo Scrape data (upload, history, pipelines, config)
/clients/[id]/customer-companies → Customer Companies (upload, history, pipelines, config)
/clients/[id]/salesnav-koolkit   → SalesNav KoolKit (upload, history, pipelines, config)
/clients/[id]/crm-data           → CRM Data (upload, history, pipelines, config)
/workflows                  → Workflow Registry (CRUD)
/schema                     → Database Schema Viewer
```

### Database Tables
| Table | Purpose |
|-------|---------|
| `clients` | Client companies |
| `batches` | Batch job records |
| `batch_items` | Individual items in batches |
| `workflow_states` | State machine for workflow execution |
| `enrichment_registry` | Registered workflows (SYNC/ASYNC) |
| `enrichment_results` | JSONB results from workflows |
| `enrichment_pipelines` | Client-specific saved pipelines |
| `client_workflow_configs` | Per-client workflow configurations |
| `raw_apollo_data` | Apollo CSV staging data |
| `client_customer_companies` | Customer companies workstream data |
| `client_salesnav_koolkit` | SalesNav KoolKit workstream data |
| `client_crm_data` | CRM data workstream data |

### Workstream Pattern
Each workstream follows this consistent pattern:
1. **Database Table**: `client_{workstream_name}` with `client_id`, `upload_id`, and workstream-specific columns
2. **Server Actions**: Types + `get{Workstream}Uploads` + `upload{Workstream}` in `actions.ts`
3. **Pages**: 5 pages per workstream (main, upload, uploads, pipelines, config)
4. **Dashboard Card**: Colored card on client dashboard linking to workstream main page
5. **Workstream Isolation**: Pipelines and configs use workstream parameter for filtering

---

## File Reference

| Directory | Purpose |
|-----------|---------|
| `admin-dashboard/src/app/` | Next.js App Router pages |
| `admin-dashboard/src/app/actions.ts` | Server actions (all data operations) |
| `admin-dashboard/src/components/ui/` | Shadcn/UI components |
| `src/worker.py` | Modal worker functions |
| `src/orchestrator.py` | Prefect orchestration flow |
| `documentation/` | Project documentation |
| `documentation/guides/` | How-to guides |
| `scripts/` | Database and utility scripts |
