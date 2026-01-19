# Projection System Overview

## What Is Projection?

**Projection** is the process of transforming raw enrichment data into a denormalized, dashboard-ready table (`final_leads`). It extracts specific fields from JSON payloads, computes business indicators, and consolidates person + company data into a single queryable row.

```
Raw Data                    →    Projection    →    Dashboard-Ready
─────────────────────────────────────────────────────────────────────
company_enrichment_results       extractors.py       final_leads
  └─ raw_payload (JSONB)              │                 └─ company_name
                                      │                 └─ company_industry
person_enrichment_results            │                 └─ person_title
  └─ raw_payload (JSONB)              │                 └─ is_new_in_role
                                      ▼                 └─ raw_company_payload
                               run_projection.py        └─ raw_person_payload
```

## The Raw JSON Storage Pattern

### Why Store Entire Payloads?

External enrichment services (Clay, Apollo, Hunter) return extensive JSON responses. We store the **entire raw payload** rather than extracting fields at ingestion time.

| Approach | Pros | Cons |
|----------|------|------|
| **Extract at ingestion** | Cleaner tables, less storage | If you need a new field later, must re-run enrichment ($$$) |
| **Store raw + extract later** | Future-proof, re-extract any field anytime | Larger storage, extraction logic needed |

We chose **store raw + extract later** because:

1. **API costs are real** — Re-enriching 10K records because you forgot a field is expensive
2. **Requirements evolve** — Dashboard v2 might need fields v1 didn't
3. **Storage is cheap** — JSONB compresses well, query performance is fine
4. **Debugging** — Raw payloads let you see exactly what the API returned

### Where Raw Payloads Live

```
company_enrichment_results
├── id
├── company_id
├── workflow_slug          → "enrich_company_via_waterfall_in_clay"
├── raw_payload (JSONB)    → Full Clay response, 50+ fields
└── created_at

person_enrichment_results
├── id
├── person_id
├── workflow_slug          → "enrich_person_via_waterfall_in_clay"
├── raw_payload (JSONB)    → Full Clay response, 40+ fields
└── created_at
```

### Raw Payloads in final_leads

We also copy raw payloads to `final_leads`:

```sql
raw_company_payload JSONB,  -- Full Clay company response
raw_person_payload JSONB,   -- Full Clay person response
```

This allows:
- Re-extracting fields without joining back to enrichment tables
- Debugging data quality issues directly in the dashboard
- Future ad-hoc queries against raw data

## How Projection Works

### 1. Fetch Enrichment Results

```python
# For each person in normalized_people
person_enrichment = supabase.from('person_enrichment_results')
    .select('raw_payload')
    .eq('person_id', person_id)
    .single()

company_enrichment = supabase.from('company_enrichment_results')
    .select('raw_payload')
    .eq('company_id', company_id)
    .single()
```

### 2. Extract Fields

```python
# extractors.py
company_fields = extract_company_fields(company_enrichment['raw_payload'])
# Returns: {company_name, company_domain, company_industry, ...}

person_fields = extract_person_fields(person_enrichment['raw_payload'])
# Returns: {person_title, person_linkedin_url, current_job_start_date, ...}
```

### 3. Compute Indicators

```python
is_new_in_role = compute_is_new_in_role(person_fields['current_job_start_date'])
is_worked_at_customer = compute_is_worked_at_customer(
    person_enrichment['raw_payload'].get('experience', []),
    customer_domains
)
```

### 4. Upsert to final_leads

```python
supabase.from('final_leads').upsert({
    'batch_item_id': batch_item_id,
    'person_id': person_id,
    'company_id': company_id,
    **company_fields,
    **person_fields,
    'is_new_in_role': is_new_in_role,
    'is_worked_at_customer': is_worked_at_customer,
    'raw_company_payload': company_enrichment['raw_payload'],
    'raw_person_payload': person_enrichment['raw_payload'],
}, on_conflict='batch_item_id')
```

## Extraction Functions

Located in `src/projection/extractors.py`:

| Function | Purpose |
|----------|---------|
| `extract_company_fields(payload)` | Parse Clay company payload → flat dict |
| `extract_person_fields(payload)` | Parse Clay person payload → flat dict |
| `parse_date(date_str)` | Handle "2023-02-01", "2023-02", "2023" formats |
| `compute_is_new_in_role(start_date)` | True if job started within 6 months |
| `compute_is_worked_at_customer(experience, domains)` | True if work history includes customer |

### Handling Nested JSON

Clay payloads have deeply nested structures:

```json
{
  "locations": [
    {
      "inferred_location": {
        "locality": "Minneapolis",
        "admin_district": "MN"
      }
    }
  ]
}
```

Extraction code handles this defensively:

```python
def extract_company_fields(payload):
    if not payload:
        return {}
    
    locations = payload.get('locations') or []
    inferred = {}
    if locations and locations[0]:
        inferred = locations[0].get('inferred_location') or {}
    
    return {
        'company_city': inferred.get('locality'),
        'company_state': inferred.get('admin_district'),
        ...
    }
```

## When Projection Runs

### Current: Manual / Batch Job

```bash
python3 -m src.projection.run_projection --client-id <uuid>
```

### Future Options

1. **Pipeline step** — Add as final step after person enrichment
2. **Scheduled job** — Cron every N minutes
3. **UI trigger** — "Refresh Dashboard" button
4. **Event-driven** — Trigger on batch completion webhook

## Schema: final_leads

```sql
CREATE TABLE final_leads (
    -- Keys
    id UUID PRIMARY KEY,
    batch_item_id UUID UNIQUE NOT NULL,
    person_id UUID,
    company_id UUID,
    client_id UUID NOT NULL,
    source_workstream TEXT,  -- 'apollo_scrape', 'crm_data'
    
    -- Person fields (extracted)
    person_first_name TEXT,
    person_last_name TEXT,
    person_full_name TEXT,
    person_title TEXT,
    person_linkedin_url TEXT,
    person_headline TEXT,
    person_location TEXT,
    current_job_start_date DATE,
    
    -- Company fields (extracted)
    company_name TEXT,
    company_domain TEXT,
    company_linkedin_url TEXT,
    company_industry TEXT,
    company_size_bucket TEXT,
    company_employee_count INTEGER,
    company_city TEXT,
    company_state TEXT,
    company_country TEXT,
    company_revenue_range TEXT,
    company_funding_range TEXT,
    company_founded_year INTEGER,
    
    -- Indicators (computed)
    is_new_in_role BOOLEAN DEFAULT FALSE,
    is_recently_funded BOOLEAN DEFAULT FALSE,
    is_worked_at_customer BOOLEAN DEFAULT FALSE,
    
    -- Raw payloads (for future extraction)
    raw_company_payload JSONB,
    raw_person_payload JSONB,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## The Power of This Pattern

### Scenario: "We need person's LinkedIn connections count"

**Without raw payloads:** 
- Re-run person enrichment for all records
- Wait for API responses
- Pay for API calls again

**With raw payloads:**
```python
# Update extractors.py
'person_linkedin_connections': payload.get('connections'),

# Re-run projection
python3 -m src.projection.run_projection
```

Done in minutes, zero API cost.

### Scenario: "What exactly did Clay return for this person?"

```sql
SELECT raw_person_payload 
FROM final_leads 
WHERE person_linkedin_url = 'https://linkedin.com/in/john-doe';
```

Full debugging visibility.

## Multi-Workstream Support

The projection system handles data from different ingestion pipelines:

| Workstream | Enrichment Tables | Projected To |
|------------|-------------------|--------------|
| `apollo_scrape` | company_enrichment_results, person_enrichment_results | final_leads |
| `crm_data` | company_enrichment_results, person_enrichment_results | final_leads |

The `source_workstream` column in `final_leads` indicates origin. UI can filter or display by source.

## Related Documentation

- `documentation/projection/stage1_data_analysis.md` — Clay payload field inventory
- `documentation/projection/stage2_schema_design.md` — final_leads schema details
- `documentation/projection/stage3_to_7_completion.md` — Implementation specifics
- `documentation/global/client_scoped_dashboard_architecture.md` — Dashboard filtering

## Summary

1. **Store entire raw payloads** — Future-proof, re-extractable, debuggable
2. **Extract at projection time** — Business logic separated from ingestion
3. **Compute indicators from raw data** — Flexible, updatable logic
4. **Upsert to denormalized table** — Fast dashboard queries, no joins
5. **Keep raw in final_leads too** — Full audit trail at query layer


