# Session Update: January 1, 2026

## Executive Summary

Today marked a critical milestone in the Data Enrichment Orchestration platform. We achieved **multi-workstream architecture**, enabling parallel data pipelines (Apollo Scrape and CRM Data) to operate independently while sharing core infrastructure. We also laid the foundation for the **GTM Dashboard** with a fully functional projection system.

---

## 1. CRM Data Workstream - Full Implementation

### 1.1 Database Schema Extensions

Added orchestration support to CRM normalized tables:

```sql
-- crm_data_normalized_people
ALTER TABLE ADD COLUMN batch_item_id UUID REFERENCES batch_items(id);
ALTER TABLE ADD COLUMN company_id UUID;

-- crm_data_normalized_companies  
ALTER TABLE ADD COLUMN batch_item_id UUID REFERENCES batch_items(id);
```

**Why**: Links CRM data to the batch processing system, enabling the same orchestration flow used by Apollo.

### 1.2 Modal Functions Created

Four new serverless functions deployed to `data-enrichment-workers`:

| Function | Type | Purpose |
|----------|------|---------|
| `start_enrich_company_via_clay_waterfall` | Sender | Reads from `crm_data_normalized_companies`, sends to Clay webhook |
| `receive_enrich_company_via_clay_waterfall` | HTTP Receiver | Stores results in `company_enrichment_results`, triggers orchestrator |
| `start_enrich_person_via_clay_waterfall` | Sender | Reads from `crm_data_normalized_people`, sends to Clay webhook |
| `receive_enrich_person_via_clay_waterfall` | HTTP Receiver | Stores results in `person_enrichment_results`, triggers orchestrator |

**Key Design Decision**: CRM functions read from `crm_data_normalized_*` tables directly (not `batch_items.input_data`), maintaining data integrity and leveraging pre-normalized structure.

### 1.3 Entity-Level Tracking Made Workstream-Agnostic

Removed foreign key constraints from entity tracking tables:

- `company_workflow_states` - no longer requires `company_id` in `normalized_companies`
- `company_enrichment_results` - same
- `person_workflow_states` - no longer requires `person_id` in `normalized_people`
- `person_enrichment_results` - same

**Why**: Allows these tables to track entities from both `normalized_*` (Apollo) and `crm_data_normalized_*` (CRM) tables without FK violations.

---

## 2. Workstream Slug Architecture

### 2.1 Problem Solved

The same workflow slug (e.g., `enrich_company_via_clay_waterfall`) can exist in multiple workstreams with different configurations. Without explicit workstream context, the system couldn't reliably look up the correct:
- `enrichment_registry` entry
- `client_workflow_configs` webhook URL

### 2.2 Solution Implemented

**Database**: Added `workstream_slug` column to `batches` table:
```sql
ALTER TABLE batches ADD COLUMN workstream_slug TEXT NOT NULL DEFAULT 'default';
```

**Orchestrator** (`src/orchestrator.py`):
- `fetch_pending_items` now joins with `batches` to get `workstream_slug`
- Uses composite key lookup: `ON ws.step_name = er.slug AND b.workstream_slug = er.workstream_slug`
- `dispatch_to_modal` passes `workstream_slug` to Modal functions

**Modal Workers** (`src/worker.py`):
- All sender functions accept optional `workstream_slug` parameter
- `_get_client_config` uses composite key: `(workflow_slug, workstream_slug)`
- `_get_workstream_slug` helper fetches from `batches` table as fallback

### 2.3 Data Flow

```
Batch Created (workstream_slug = 'crm_data')
    ↓
Orchestrator fetches pending items
    ↓
JOIN batches → gets workstream_slug
    ↓
dispatch_to_modal(item, workstream_slug='crm_data')
    ↓
Modal function: _get_client_config(item_id, 'enrich_company_via_clay_waterfall', 'crm_data')
    ↓
Returns CRM-specific webhook URL (not Apollo's)
```

---

## 3. CRM Upload Flow - UI/Backend

### 3.1 Pattern Alignment with Apollo

CRM upload now follows the exact same pattern as Apollo:

| Step | Apollo | CRM |
|------|--------|-----|
| Upload Page | `/clients/[id]/apollo-ingest/upload` | `/clients/[id]/crm-data/upload` |
| Past Uploads | `/clients/[id]/apollo-ingest/uploads` | `/clients/[id]/crm-data/uploads` |
| Upload Inspector | `/clients/[id]/uploads/[upload_id]` | `/clients/[id]/crm-data/uploads/[upload_id]` |
| Launch Action | `startBatchFromUpload` | `startCrmBatchFromUpload` |

### 3.2 Server Actions Created/Updated

**`uploadCrmNormalizedPeople`** (updated):
- Single CSV upload handles both companies and people
- Deduplicates companies by domain
- Upserts to `crm_data_normalized_companies`
- Inserts to `crm_data_normalized_people` with `company_id` FK
- Returns `{ success, rowCount, companyCount }`

**`startCrmBatchFromUpload`** (created):
- Fetches people records for the upload
- Creates batch with `workstream_slug = 'crm_data'`
- Creates `batch_items` for each person
- Creates `workflow_states` for first pipeline step
- Links `crm_data_normalized_people.batch_item_id`
- Sets batch status to `PENDING` → triggers orchestrator via Postgres trigger

**`getCrmUploadDetails`** (created):
- Returns upload metadata + paginated rows for Upload Inspector page

### 3.3 UI Components

**Upload Page** (`/clients/[id]/crm-data/upload/page.tsx`):
- Single drag-and-drop CSV upload
- Auto-maps common header variations (e.g., "Company Name", "company_name", "Account Name")
- Preview table before upload
- Clean success message without redirect instructions

**Upload Inspector** (`/clients/[id]/crm-data/uploads/[upload_id]/page.tsx`):
- Summary cards: Upload ID, Contacts, Companies, Date
- Paginated data preview table
- "Launch Enrichment Batch" button
- Modal showing active pipeline with step visualization
- Calls `startCrmBatchFromUpload` on confirm

---

## 4. GTM Dashboard Foundation - Projection System

### 4.1 Final Leads Table

Created `final_leads` table as the single source of truth for the GTM dashboard:

**Person Fields**: `person_first_name`, `person_last_name`, `person_full_name`, `person_email`, `person_linkedin_url`, `person_title`, `person_headline`, `person_location`, `person_summary`, `person_current_job_start_date`

**Company Fields**: `company_name`, `company_domain`, `company_linkedin_url`, `company_website`, `company_logo_url`, `company_description`, `company_industry`, `company_industries`, `company_subindustries`, `company_size_bucket`, `company_employee_count`, `company_city`, `company_state`, `company_country`, `company_revenue_range`, `company_founded_year`, `company_type`, `company_business_stage`, `company_funding_range`, `company_technologies`

**Indicators**: `is_new_in_role`, `is_recently_funded`, `is_worked_at_customer`

### 4.2 Extraction Functions

**`src/projection/extractors.py`**:
- `extract_company_fields(payload)` - Parses Clay company enrichment JSON
- `extract_person_fields(payload)` - Parses Clay person enrichment JSON
- `compute_indicators(person_data, company_data, raw_person_payload, customer_domains)` - Calculates boolean indicators
- `extract_all(company_payload, person_payload, customer_domains)` - Combines all extraction

### 4.3 Projection Runner

**`src/projection/run_projection.py`**:
- Fetches completed enrichment data from `person_enrichment_results` + `company_enrichment_results`
- Joins with `normalized_people` + `normalized_companies`
- Extracts fields using extractors
- Computes indicators (including `is_worked_at_customer` from `client_customer_companies`)
- Upserts into `final_leads`

**Usage**:
```bash
python -m src.projection.run_projection --batch-id <UUID> --client-id <UUID>
```

### 4.4 Results

Successfully projected 40 Apollo records:
- 40 records in `final_leads`
- 1 person identified as "New in Role"
- Company data populated with industry, size, location
- `is_worked_at_customer` indicator wired to customer list

---

## 5. HTTP Endpoints for Clay Callbacks

All receiver functions now have HTTP endpoints for Clay to POST enrichment results:

| Workstream | Workflow | Endpoint |
|------------|----------|----------|
| Apollo | Company Enrichment | `receive_enrich_company_via_waterfall_in_clay` |
| Apollo | Person Enrichment | `receive_enrich_person_via_waterfall_in_clay` |
| CRM | Company Enrichment | `receive_enrich_company_via_clay_waterfall` |
| CRM | Person Enrichment | `receive_enrich_person_via_clay_waterfall` |

All endpoints:
1. Accept `{ item_id, company_id/person_id, ...enriched_data }`
2. Store results in entity-level tables
3. Update workflow states to `COMPLETED`
4. Trigger orchestrator to advance to next step

---

## 6. Files Changed/Created

### New Files
- `admin-dashboard/src/app/clients/[id]/crm-data/uploads/[upload_id]/page.tsx` - CRM Upload Inspector
- `src/projection/__init__.py` - Projection package init
- `src/projection/extractors.py` - Field extraction and indicator logic
- `src/projection/run_projection.py` - Projection runner
- `documentation/projection/stage1_data_analysis.md` - Clay payload analysis
- `documentation/projection/stage2_schema_design.md` - Final leads schema
- `documentation/projection/stage3_to_7_completion.md` - Projection implementation summary
- `documentation/prompts/gtm_dashboard_frontend_prompt.md` - Prompt for UI generation
- `documentation/global/workstream_slug_implementation.md` - Architecture doc

### Modified Files
- `src/orchestrator.py` - Workstream-aware fetching and dispatching
- `src/worker.py` - 4 new CRM functions, workstream_slug support, all senders updated
- `admin-dashboard/src/app/actions.ts` - `startCrmBatchFromUpload`, `getCrmUploadDetails`, `uploadCrmNormalizedPeople` updated
- `admin-dashboard/src/app/clients/[id]/crm-data/upload/page.tsx` - Single upload flow, clean messages
- `admin-dashboard/src/app/clients/[id]/crm-data/uploads/page.tsx` - Clickable upload rows

### Database Migrations Applied
- Add `workstream_slug` to `batches`
- Add `batch_item_id`, `company_id` to `crm_data_normalized_people`
- Add `batch_item_id` to `crm_data_normalized_companies`
- Create `final_leads` table
- Add `is_worked_at_customer` column to `final_leads`
- Remove FK constraints from entity tracking tables

---

## 7. Architecture Diagram (Current State)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ADMIN DASHBOARD                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ Apollo Upload│  │  CRM Upload  │  │ GTM Dashboard│                   │
│  │    Flow      │  │    Flow      │  │  (Planned)   │                   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                   │
└─────────┼─────────────────┼─────────────────┼───────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            SUPABASE                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐             │
│  │ raw_apollo_data│  │crm_data_norm_* │  │  final_leads   │             │
│  │                │  │                │  │                │             │
│  └───────┬────────┘  └───────┬────────┘  └────────────────┘             │
│          │                   │                    ▲                      │
│          ▼                   ▼                    │                      │
│  ┌────────────────────────────────────┐          │                      │
│  │           batches                   │          │                      │
│  │  (workstream_slug: apollo_scrape    │          │                      │
│  │   or crm_data)                      │          │                      │
│  └───────────────┬────────────────────┘          │                      │
│                  │                                │                      │
│                  ▼                                │                      │
│  ┌────────────────────────────────────┐          │                      │
│  │   Postgres Trigger → Edge Function  │──────────┼──────────────────┐  │
│  └────────────────────────────────────┘          │                  │  │
└──────────────────────────────────────────────────┼──────────────────┼──┘
                                                   │                  │
                                                   │                  ▼
┌──────────────────────────────────────────────────┼────────────────────┐
│                        PREFECT CLOUD             │                    │
│  ┌──────────────────────────────────────────┐    │                    │
│  │     data-enrichment-orchestrator         │◄───┘                    │
│  │  - fetch_pending_items (w/ workstream)   │                         │
│  │  - dispatch_to_modal                     │                         │
│  │  - advance_completed_items               │                         │
│  └─────────────────┬────────────────────────┘                         │
└────────────────────┼──────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           MODAL LABS                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                  data-enrichment-workers                         │    │
│  │                                                                  │    │
│  │  Apollo Workstream:              CRM Workstream:                 │    │
│  │  - normalize_company_name        - enrich_company_via_clay_wf   │    │
│  │  - split_raw_apollo_scrape       - enrich_person_via_clay_wf    │    │
│  │  - enrich_company_via_clay_wf                                    │    │
│  │  - enrich_person_via_clay_wf                                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLAY                                        │
│  - Receives webhook POSTs with entity data                              │
│  - Runs enrichment waterfalls                                           │
│  - POSTs results back to Modal HTTP endpoints                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Next Steps

1. **CRM End-to-End Test**: Upload real CRM data, launch batch, verify enrichment completes
2. **GTM Dashboard UI**: Use generated prompt to build frontend with Gemini
3. **Projection Automation**: Integrate projection into pipeline (either as final step or scheduled job)
4. **Email Enrichment**: Add workflow to populate `person_email` (currently null from Clay)
5. **Batch Status Dashboard**: Add visibility into in-flight batches and their progress

---

## 9. Technical Debt Acknowledged

- `concurrency_limit` deprecation warning in Modal (minor, non-blocking)
- Entity tracking tables have no FK constraints (trade-off for multi-workstream support)
- Projection is currently manual (`python -m src.projection.run_projection`)

---

*This session represents a significant architectural evolution of the platform, enabling scalable multi-workstream data processing while maintaining a unified orchestration layer.*


