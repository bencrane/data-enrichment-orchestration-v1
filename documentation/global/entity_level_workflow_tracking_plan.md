# Entity-Level Workflow Tracking Implementation Plan

**Created:** 2026-01-01  
**Status:** Planned  
**Author:** AI Assistant + Ben Crane

---

## Problem Statement

### Current Architecture
- `workflow_states` tracks progression per `batch_item` (item_id)
- Multiple batch_items can map to the same company (e.g., 10 people from 3 companies)
- `normalized_companies` deduplicates companies by domain
- `normalized_people` links batch_items to companies

### The Conflict
- Orchestrator dispatches work per `item_id`
- Company/person enrichment should happen per entity (company_id / person_id)
- If 4 batch_items share Company A, we should enrich Company A **once**, but need to mark all 4 items as COMPLETED

### Example Scenario
```
Batch: 10 people from 3 companies (A, B, C)
- Company A: 4 people (batch_items 1, 2, 3, 4)
- Company B: 3 people (batch_items 5, 6, 7)
- Company C: 3 people (batch_items 8, 9, 10)

Without entity-level tracking:
- Clay called 10 times for company enrichment (wasteful, expensive)

With entity-level tracking:
- Clay called 3 times (once per unique company)
- All 10 batch_items still progress through workflow_states
```

---

## Solution Architecture

### New Database Tables

```sql
-- Track company enrichment workflows (mirrors workflow_states pattern)
CREATE TABLE company_workflow_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES normalized_companies(id) ON DELETE CASCADE,
    workflow_slug TEXT NOT NULL,  -- e.g., 'enrich_company_via_waterfall_in_clay'
    status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING, IN_PROGRESS, COMPLETED, FAILED
    meta JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, workflow_slug)
);

-- Store company enrichment results
CREATE TABLE company_enrichment_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES normalized_companies(id) ON DELETE CASCADE,
    workflow_slug TEXT NOT NULL,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track person enrichment workflows
CREATE TABLE person_workflow_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES normalized_people(id) ON DELETE CASCADE,
    workflow_slug TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    meta JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(person_id, workflow_slug)
);

-- Store person enrichment results
CREATE TABLE person_enrichment_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES normalized_people(id) ON DELETE CASCADE,
    workflow_slug TEXT NOT NULL,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX idx_company_workflow_states_lookup ON company_workflow_states(company_id, workflow_slug);
CREATE INDEX idx_company_workflow_states_status ON company_workflow_states(status);
CREATE INDEX idx_person_workflow_states_lookup ON person_workflow_states(person_id, workflow_slug);
CREATE INDEX idx_person_workflow_states_status ON person_workflow_states(status);
```

### Data Flow Diagram

```
batch_items (raw input)
    │
    ▼
workflow_states (per item_id, per step)
    │
    ▼
[split step]
    │
    ├──────────────────────────────────────────┐
    ▼                                          ▼
normalized_companies                    normalized_people
    │                                          │
    ▼                                          ▼
company_workflow_states                 person_workflow_states
company_enrichment_results              person_enrichment_results
```

### Sender Logic (Company Enrichment Example)

```python
def start_enrich_company_via_waterfall_in_clay(item_id: str):
    # 1. Look up company_id via normalized_people
    company_id = _get_company_id_for_item(item_id)
    
    # 2. Check company's enrichment status for this workflow
    status = _get_company_workflow_status(company_id, workflow_slug)
    
    if status == "COMPLETED":
        # Company already enriched - mark batch_item as COMPLETED immediately
        _update_state(item_id, step_name, "COMPLETED", 
                      meta={"skipped": "company_already_enriched", "company_id": company_id})
        return {"success": True, "skipped": True}
    
    elif status == "IN_PROGRESS":
        # Company is being enriched by another item - mark batch_item as COMPLETED
        _update_state(item_id, step_name, "COMPLETED", 
                      meta={"skipped": "company_enrichment_in_progress", "company_id": company_id})
        return {"success": True, "skipped": True}
    
    else:  # PENDING or not exists
        # First item to process this company - send to Clay
        _set_company_workflow_status(company_id, workflow_slug, "IN_PROGRESS")
        
        # Fetch company data from normalized_companies (NOT batch_items)
        company_data = _get_company_data(company_id)
        
        # Send to Clay
        requests.post(webhook_url, json=company_data)
        
        # Mark batch_item as IN_PROGRESS
        _update_state(item_id, step_name, "IN_PROGRESS")
```

### Receiver Logic (Company Enrichment Example)

```python
def receive_enrich_company_via_waterfall_in_clay(request: dict):
    item_id = request.get("item_id")
    company_id = _get_company_id_for_item(item_id)
    
    # Record enrichment result against the COMPANY
    _record_company_result(company_id, workflow_slug, request)
    
    # Mark company workflow as COMPLETED
    _set_company_workflow_status(company_id, workflow_slug, "COMPLETED")
    
    # Mark THIS batch_item as COMPLETED
    _update_state(item_id, step_name, "COMPLETED")
    
    # Trigger orchestrator to advance pipeline
    _trigger_orchestrator(batch_id)
```

---

## Implementation Stages

### Stage 1: Database Schema Migration

**Objective:** Create the four new tables for entity-level tracking.

**Tasks:**
1. Create Supabase migration with:
   - `company_workflow_states` table
   - `company_enrichment_results` table
   - `person_workflow_states` table
   - `person_enrichment_results` table
   - All necessary indexes and constraints

**Success Criteria:**
- [ ] Migration applies without errors
- [ ] All four tables exist with correct columns and constraints
- [ ] Foreign keys properly reference `normalized_companies` and `normalized_people`
- [ ] Unique constraints enforce (company_id, workflow_slug) and (person_id, workflow_slug)

---

### Stage 2: Helper Functions in worker.py

**Objective:** Add database helper functions for entity-level state management.

**Tasks:**
1. `_get_company_id_for_item(item_id)` → Returns company_id via normalized_people
2. `_get_person_id_for_item(item_id)` → Returns person_id via normalized_people
3. `_get_company_data(company_id)` → Returns company fields from normalized_companies
4. `_get_person_data(person_id)` → Returns person fields from normalized_people
5. `_get_company_workflow_status(company_id, workflow_slug)` → Returns status or None
6. `_set_company_workflow_status(company_id, workflow_slug, status, meta)`
7. `_record_company_result(company_id, workflow_slug, data)`
8. `_get_person_workflow_status(person_id, workflow_slug)` → Returns status or None
9. `_set_person_workflow_status(person_id, workflow_slug, status, meta)`
10. `_record_person_result(person_id, workflow_slug, data)`

**Success Criteria:**
- [ ] All 10 helper functions implemented
- [ ] Functions handle "not found" cases gracefully
- [ ] Functions use existing `get_sync_connection()` pattern
- [ ] No linter errors

---

### Stage 3: Update Company Enrichment Sender

**Objective:** Modify `start_enrich_company_via_waterfall_in_clay` to use entity-level tracking.

**Tasks:**
1. Look up `company_id` via `_get_company_id_for_item(item_id)`
2. Check `company_workflow_states` status
3. Implement skip logic for IN_PROGRESS and COMPLETED
4. For PENDING: set IN_PROGRESS, read company data from `normalized_companies`, send to Clay
5. Update batch_item `workflow_states` appropriately

**Success Criteria:**
- [ ] Function reads from `normalized_companies` (not `batch_items`)
- [ ] Duplicate companies are skipped (not sent to Clay twice)
- [ ] Batch_item workflow_states updated correctly in all cases
- [ ] Company_workflow_states created/updated correctly

---

### Stage 4: Update Company Enrichment Receiver

**Objective:** Modify `receive_enrich_company_via_waterfall_in_clay` to use entity-level tracking.

**Tasks:**
1. Extract `item_id` from request
2. Look up `company_id` via `_get_company_id_for_item(item_id)`
3. Record result in `company_enrichment_results`
4. Set `company_workflow_states` to COMPLETED
5. Mark batch_item `workflow_states` as COMPLETED
6. Trigger orchestrator

**Success Criteria:**
- [ ] Result recorded in `company_enrichment_results` (not just `enrichment_results`)
- [ ] `company_workflow_states` marked COMPLETED
- [ ] Batch_item progresses correctly
- [ ] Orchestrator triggered

---

### Stage 5: Create Person Enrichment Functions

**Objective:** Implement `start_enrich_person_via_waterfall_in_clay` and `receive_enrich_person_via_waterfall_in_clay` with entity-level tracking.

**Tasks:**
1. Update sender to:
   - Look up `person_id` via `_get_person_id_for_item(item_id)`
   - Check `person_workflow_states` status
   - Implement skip logic
   - Read person data from `normalized_people`
   - Send to Clay

2. Update receiver to:
   - Record in `person_enrichment_results`
   - Update `person_workflow_states`
   - Mark batch_item as COMPLETED
   - Trigger orchestrator

**Success Criteria:**
- [ ] Same pattern as company enrichment
- [ ] Reads from `normalized_people` (not `batch_items`)
- [ ] Duplicate persons skipped
- [ ] HTTP endpoint works for receiver

---

### Stage 6: Deploy and Verify

**Objective:** Deploy to Modal and verify all functions are registered.

**Tasks:**
1. Run `modal deploy src/worker.py`
2. Verify all web endpoints are created
3. Note endpoint URLs for receivers

**Success Criteria:**
- [ ] Deployment succeeds without errors
- [ ] `receive_enrich_company_via_waterfall_in_clay` has HTTP endpoint
- [ ] `receive_enrich_person_via_waterfall_in_clay` has HTTP endpoint

---

### Stage 7: Integration Test

**Objective:** End-to-end test with sample data.

**Test Scenario:**
- Send 6 records through (3 companies, 2 people per company)
- Pipeline: `normalize_all_core_values` → `split` → `enrich_company` → (future: `enrich_person`)

**Verification Queries:**
```sql
-- Verify company workflow states (should have 3 rows, all COMPLETED)
SELECT * FROM company_workflow_states;

-- Verify company enrichment results (should have 3 rows)
SELECT * FROM company_enrichment_results;

-- Verify batch_item workflow states (6 items should be COMPLETED for company step)
SELECT step_name, status, COUNT(*) FROM workflow_states 
WHERE step_name = 'enrich_company_via_waterfall_in_clay'
GROUP BY step_name, status;

-- Verify skip behavior (check meta for "skipped" entries)
SELECT meta->>'skipped' as skip_reason, COUNT(*) 
FROM workflow_states 
WHERE step_name = 'enrich_company_via_waterfall_in_clay'
GROUP BY meta->>'skipped';
```

**Success Criteria:**
- [ ] 3 companies enriched (not 6)
- [ ] All 6 batch_items marked COMPLETED for company enrichment step
- [ ] 3 batch_items have meta showing "skipped" (duplicates)
- [ ] `company_workflow_states` has 3 COMPLETED entries
- [ ] `company_enrichment_results` has 3 entries

---

### Stage 8: Documentation

**Objective:** Update documentation to reflect new architecture.

**Tasks:**
1. Update `enrichment_workflow_deployment_process.md`
2. Add architecture diagram showing entity-level tracking
3. Document the skip logic for future reference

---

## Execution Summary

| Stage | Dependencies | Estimated Effort |
|-------|--------------|------------------|
| 1. Database Schema | None | Low |
| 2. Helper Functions | Stage 1 | Medium |
| 3. Company Sender | Stage 2 | Medium |
| 4. Company Receiver | Stage 2 | Low |
| 5. Person Functions | Stage 2 | Medium |
| 6. Deploy | Stages 3-5 | Low |
| 7. Integration Test | Stage 6 | Medium |
| 8. Documentation | Stage 7 | Low |

---

## Why This Architecture Is Resilient

| Concern | How It's Handled |
|---------|------------------|
| Multiple workflows per entity | Each workflow has its own row in `*_workflow_states` |
| Concurrent processing | `IN_PROGRESS` status prevents duplicate external API calls |
| Batch_item tracking preserved | Original `workflow_states` still tracks per-item progression |
| Query flexibility | Can ask "which companies need enrichment X?" easily |
| Result storage | Dedicated tables per entity type, queryable by workflow |
| Future workflows | Just add new workflow_slug values — no schema changes |
| Cost efficiency | External APIs called once per entity, not once per batch_item |

---

## Appendix: Table Relationships

```
batch_items
    │
    ├── id ←──────────────────┐
    │                         │
    ▼                         │
workflow_states               │
    └── item_id ──────────────┘

normalized_companies
    │
    ├── id ←──────────────────┐
    │                         │
    ├── company_workflow_states
    │       └── company_id ───┘
    │
    └── company_enrichment_results
            └── company_id ───┘

normalized_people
    │
    ├── id ←──────────────────┐
    │                         │
    ├── batch_item_id ────────► batch_items.id
    │
    ├── company_id ───────────► normalized_companies.id
    │
    ├── person_workflow_states
    │       └── person_id ────┘
    │
    └── person_enrichment_results
            └── person_id ────┘
```

