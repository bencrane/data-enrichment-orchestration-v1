# Workstream Slug Implementation for Resilient Config Lookups

**Date:** January 1, 2026  
**Status:** Complete  
**Purpose:** Enable precise workflow config lookups using composite key `(workflow_slug, workstream_slug)`

---

## Problem Statement

The database schema uses a composite unique key `(slug, workstream_slug)` on `enrichment_registry` and `client_workflow_configs`. However, the orchestrator and Modal functions were only using `workflow_slug` for lookups, which could return incorrect configs when the same workflow exists in multiple workstreams.

---

## Solution: Explicit Workstream Context

### Principle
**Workstream context travels with the data** from batch creation through to Modal execution.

```
Batch Creation (UI) 
    → batches.workstream_slug (source of truth)
        → Orchestrator reads it
            → Passes to Modal functions
                → Modal uses (workflow_slug, workstream_slug) for all lookups
```

---

## Changes Made

### 1. Database: `batches` Table

**Migration:** `add_workstream_slug_to_batches`

```sql
ALTER TABLE public.batches ADD COLUMN workstream_slug TEXT;
CREATE INDEX idx_batches_workstream_slug ON public.batches(workstream_slug);
```

- Column is nullable for backward compatibility
- Should be set by UI when batch is created
- Existing batch backfilled to `apollo_scrape`

---

### 2. Helper Functions in `src/worker.py`

#### Updated: `_get_client_config()`

```python
def _get_client_config(item_id: str, workflow_slug: str, workstream_slug: str | None = None) -> dict | None:
    """
    Fetch client-specific configuration for a workflow.
    Uses composite key (workflow_slug, workstream_slug) for precise matching.
    """
    if workstream_slug:
        # Precise lookup using composite key
        cur.execute("""
            SELECT cwc.config
            FROM batch_items bi
            JOIN batches b ON bi.batch_id = b.id
            JOIN client_workflow_configs cwc ON b.client_id = cwc.client_id
            WHERE bi.id = %s
            AND cwc.workflow_slug = %s
            AND cwc.workstream_slug = %s
        """, (item_id, workflow_slug, workstream_slug))
    else:
        # Legacy fallback: lookup workstream_slug from batch
        cur.execute("""
            SELECT cwc.config
            FROM batch_items bi
            JOIN batches b ON bi.batch_id = b.id
            JOIN client_workflow_configs cwc ON b.client_id = cwc.client_id
            WHERE bi.id = %s
            AND cwc.workflow_slug = %s
            AND cwc.workstream_slug = b.workstream_slug
        """, (item_id, workflow_slug))
```

#### New: `_get_workstream_slug()`

```python
def _get_workstream_slug(item_id: str) -> str | None:
    """Get the workstream_slug for a batch_item via its batch."""
    cur.execute("""
        SELECT b.workstream_slug 
        FROM batch_items bi
        JOIN batches b ON bi.batch_id = b.id
        WHERE bi.id = %s
    """, (item_id,))
```

---

### 3. Modal Sender Functions

All sender functions updated to:
1. Accept optional `workstream_slug` parameter
2. Look it up from batch if not provided
3. Pass it to `_get_client_config()` for composite key lookup

**Updated Functions:**
- `start_normalize_company_name(item_id, workstream_slug=None)`
- `start_normalize_company_domain(item_id, workstream_slug=None)`
- `start_normalize_all_core_values(item_id, workstream_slug=None)`
- `start_enrich_company_via_waterfall_in_clay(item_id, workstream_slug=None)`
- `start_enrich_person_via_waterfall_in_clay(item_id, workstream_slug=None)`
- `run_split_raw_apollo_scrape_data(item_id, workstream_slug=None)` (sync step)

**Example signature:**

```python
def start_enrich_company_via_waterfall_in_clay(item_id: str, workstream_slug: str | None = None):
    step_name = "enrich_company_via_waterfall_in_clay"
    
    # Get workstream_slug if not provided
    if not workstream_slug:
        workstream_slug = _get_workstream_slug(item_id)
    
    # Use composite key for config lookup
    config = _get_client_config(item_id, step_name, workstream_slug)
```

---

### 4. Orchestrator (`src/orchestrator.py`)

#### Updated: `fetch_pending_items()`

Now joins with `batches` to get `workstream_slug` and uses composite key for `enrichment_registry` lookup:

```python
cur.execute("""
    SELECT
        ws.id as workflow_state_id,
        ws.item_id,
        ws.step_name,
        ws.batch_id,
        b.workstream_slug,
        er.type as workflow_type,
        er.modal_sender_fn,
        er.modal_receiver_fn
    FROM workflow_states ws
    JOIN batches b ON ws.batch_id = b.id
    LEFT JOIN enrichment_registry er 
        ON ws.step_name = er.slug 
        AND b.workstream_slug = er.workstream_slug
    WHERE ws.status = 'PENDING'
    ORDER BY ws.updated_at ASC
    LIMIT %s
""", (batch_size,))
```

#### Updated: `dispatch_to_modal()`

Now passes `workstream_slug` to Modal functions:

```python
workstream_slug = item.get("workstream_slug")

# Spawn async execution with workstream_slug for precise config lookup
call = fn.spawn(item_id, workstream_slug)

logger.info(f"Dispatched item {item_id[:8]}... to {modal_fn_name} (type={workflow_type}, workstream={workstream_slug})")
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ UI creates batch                                                     │
│   INSERT INTO batches (..., workstream_slug) VALUES (..., 'apollo_scrape') │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Orchestrator: fetch_pending_items()                                  │
│   - JOIN batches ON ws.batch_id = b.id                              │
│   - JOIN enrichment_registry ON slug = step_name                    │
│                            AND workstream_slug = b.workstream_slug  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Orchestrator: dispatch_to_modal()                                    │
│   fn.spawn(item_id, workstream_slug)                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Modal: start_enrich_company_via_waterfall_in_clay(item_id, workstream_slug) │
│   config = _get_client_config(item_id, step_name, workstream_slug)  │
│   ↓                                                                  │
│   SELECT config FROM client_workflow_configs                         │
│   WHERE workflow_slug = 'enrich_company_via_waterfall_in_clay'      │
│     AND workstream_slug = 'apollo_scrape'  ← COMPOSITE KEY          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## UI Requirement

**The admin dashboard MUST set `workstream_slug` when creating batches:**

```typescript
// When creating a batch from a workstream page
const { data, error } = await supabase
  .from('batches')
  .insert({
    client_id: clientId,
    blueprint: ['normalize_all_core_values', 'split_raw_apollo_scrape_data_into_two_tables', ...],
    status: 'PENDING',
    workstream_slug: 'apollo_scrape'  // REQUIRED
  });
```

---

## Backward Compatibility

The implementation is backward compatible:

1. **`workstream_slug` parameter is optional** - defaults to `None`
2. **Helper lookups from batch** - if not provided, functions look up `workstream_slug` from the batch
3. **Existing data** - backfilled existing batch to `apollo_scrape`

However, for **production resilience**, always pass `workstream_slug` explicitly.

---

## Files Changed

| File | Changes |
|------|---------|
| `src/worker.py` | Updated `_get_client_config()`, added `_get_workstream_slug()`, updated all 6 sender functions |
| `src/orchestrator.py` | Updated `fetch_pending_items()` query, updated `dispatch_to_modal()` to pass workstream_slug |
| Database | Added `workstream_slug` column to `batches` table |

---

## Verification

To verify the implementation is working:

1. Check batch has `workstream_slug`:
   ```sql
   SELECT id, workstream_slug FROM batches ORDER BY created_at DESC LIMIT 1;
   ```

2. Check Prefect logs show workstream in dispatch:
   ```
   Dispatched item abc123... to start_enrich_company_via_waterfall_in_clay (type=async, workstream=apollo_scrape)
   ```

3. Check Modal logs show workstream in sender:
   ```
   [ASYNC SENDER] start_enrich_company_via_waterfall_in_clay called for item=abc123... workstream=apollo_scrape
   [CONFIG] item=abc123... workflow=enrich_company_via_waterfall_in_clay workstream=apollo_scrape -> config found
   ```

