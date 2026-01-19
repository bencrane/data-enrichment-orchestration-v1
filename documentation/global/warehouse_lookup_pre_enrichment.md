# Warehouse Lookup Pre-Enrichment Architecture

## Overview

Before calling external enrichment APIs (Clay, Hunter, etc.), optionally query a master data warehouse to check if we already have enrichment results for a company or person. This saves API costs, improves speed, and ensures consistency.

## Current vs Proposed Flow

```
Current:
normalize → split → enrich_company → enrich_person

Proposed:
normalize → split → lookup_company → enrich_company → lookup_person → enrich_person
                    ↑ checks warehouse               ↑ checks warehouse
```

The lookup step is **synchronous** (no callback needed) — it queries the warehouse, writes results if found, and completes immediately.

## Implementation Pattern

### Lookup Step Logic

```python
def run_lookup_company_from_warehouse(item_id: str):
    company_domain = get_company_domain(item_id)
    
    # Query master warehouse (separate database)
    warehouse_result = query_warehouse(
        table="enriched_companies",
        match={"domain": company_domain}
    )
    
    if warehouse_result:
        # Write to company_enrichment_results with source indicator
        record_enrichment_result(
            company_id=company_id,
            workflow_slug="warehouse_lookup_company",
            payload=warehouse_result,
            meta={"source": "warehouse", "freshness": warehouse_result["last_updated"]}
        )
        # Mark the NEXT step as skippable
        set_company_workflow_status(
            company_id, 
            "enrich_company_via_clay", 
            "COMPLETED",
            meta={"skipped": True, "reason": "data_from_warehouse"}
        )
    
    # Always mark THIS step complete
    update_state(item_id, "lookup_company_from_warehouse", "COMPLETED")
```

### Freshness & Force Refresh

Client configuration controls behavior:

```json
// client_workflow_configs
{
  "workstream_slug": "crm_data",
  "workflow_slug": "lookup_company_from_warehouse",
  "config": {
    "warehouse_connection": "postgres://...",
    "freshness_threshold_days": 30,
    "force_refresh": false
  }
}
```

Freshness logic:

```python
if warehouse_result:
    last_updated = warehouse_result["last_updated"]
    is_stale = (now - last_updated).days > config["freshness_threshold_days"]
    
    if config["force_refresh"] or is_stale:
        # Don't skip enrichment, let it run fresh
        pass
    else:
        # Use warehouse data, skip enrichment
        ...
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Separate workflow step (not embedded in enrichment) | Explicit in pipeline, easy to add/remove per workstream, clear audit trail |
| Writes to same `company_enrichment_results` table | Downstream code doesn't care about source — projection reads from one place |
| Different `workflow_slug` | Clear distinction: `warehouse_lookup_company` vs `enrich_company_via_clay` |
| Config-driven freshness threshold | Different clients may have different tolerance for stale data |
| Synchronous step (no callback) | Warehouse query is fast, no external service involved |

## Data Flow

```
warehouse_lookup_company  →  writes to company_enrichment_results (workflow_slug='warehouse_lookup_company')
enrich_company_via_clay   →  writes to company_enrichment_results (workflow_slug='enrich_company_via_clay')
                              ↑ same table, different workflow_slug

Projection reads from company_enrichment_results regardless of source
```

## Pipeline Definition Example

```yaml
# pipeline_definitions
workstream: crm_data
steps:
  - workflow_slug: lookup_company_from_warehouse    # Optional, sync
  - workflow_slug: enrich_company_via_clay_waterfall # Skipped if lookup found data
  - workflow_slug: lookup_person_from_warehouse      # Optional, sync
  - workflow_slug: enrich_person_via_clay_waterfall  # Skipped if lookup found data
```

## Implementation Steps (When Ready)

1. Add `lookup_company_from_warehouse` and `lookup_person_from_warehouse` to `pipeline_definitions`
2. Create Modal functions (synchronous, no HTTP endpoint needed)
3. Add warehouse connection config to `client_workflow_configs`
4. Test with one client, expand from there

## Benefits

- **Cost savings**: Avoid redundant API calls for already-enriched entities
- **Speed**: Local DB query (~50ms) vs external API (~2-5s)
- **Consistency**: Same company enriched the same way across batches
- **Flexibility**: Per-client control over freshness and force-refresh behavior

