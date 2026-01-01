# Projection Implementation - Stages 3-7 Complete

**Date:** 2026-01-01
**Status:** ✅ Complete

---

## Stage 3: Extraction Functions ✅

**Created:** `src/projection/extractors.py`

### Functions Implemented

1. **`extract_company_fields(payload)`**
   - Extracts company data from `raw_clay_company_enriched_payload`
   - Handles nested `locations[].inferred_location` for city/state
   - Extracts `derived_datapoints` for normalized industries
   - Handles None payloads gracefully

2. **`extract_person_fields(payload)`**
   - Extracts person data from `raw_clay_person_enriched_payload`
   - Parses `latest_experience.start_date` for job start date
   - Handles None payloads gracefully

3. **`parse_date(date_str)`**
   - Parses Clay date formats: "2023-02-01", "2023-02", "2023"
   - Returns Python `date` object

4. **`compute_is_new_in_role(start_date, months=6)`**
   - Returns `True` if job started within last 6 months
   - Configurable month threshold

5. **`compute_is_worked_at_customer(experience, customer_domains)`**
   - Checks work history against customer domain list
   - Returns `True` if any past job matches

6. **`extract_all(company_payload, person_payload, customer_domains)`**
   - Convenience function combining all extraction
   - Returns complete dict for final_leads upsert

### Key Learnings

- Clay's `inferred_location` can be None even when `locations` array exists
- Must handle None at every level of nested JSON
- Date parsing needs to handle multiple formats

---

## Stage 4: Indicator Logic ✅

Implemented within `extractors.py`:

| Indicator | Logic | Status |
|-----------|-------|--------|
| `is_new_in_role` | `start_date` within 6 months | ✅ Working |
| `is_recently_funded` | N/A - no funding date available | ⚠️ Skipped |
| `is_worked_at_customer` | Work history domain matching | ✅ Implemented (needs customer list) |

---

## Stage 5: Projection Function ✅

**Created:** `src/projection/run_projection.py`

### Key Features

1. **Batch or Full Processing**
   - `run_projection(batch_id=None)` - process all records
   - `run_projection(batch_id="uuid")` - process specific batch

2. **Idempotent Upserts**
   - Uses `ON CONFLICT (batch_item_id) DO UPDATE`
   - Safe to re-run without duplicates

3. **Error Handling**
   - Continues processing on individual errors
   - Returns stats: `{processed, inserted, updated, skipped, errors}`

4. **Joins All Required Data**
   - `normalized_people` → person base data
   - `company_enrichment_results` → Clay company payload
   - `person_enrichment_results` → Clay person payload

### Usage

```bash
# Process all records
POSTGRES_CONNECTION_STRING='...' python3 -m src.projection.run_projection

# Process specific batch
POSTGRES_CONNECTION_STRING='...' python3 -m src.projection.run_projection --batch-id <uuid>
```

---

## Stage 6: Pipeline Integration

**Decision:** Run as separate batch job (Option B)

### Current Approach
- Manual execution via command line
- Can be scheduled (cron) or triggered from UI

### Future Options
- Add as 5th pipeline step (auto-run after person enrichment)
- Add "Refresh Leads" button to dashboard

---

## Stage 7: Verification ✅

### Results

| Metric | Value |
|--------|-------|
| Records Processed | 40 |
| Records Inserted | 40 |
| Errors | 0 |

### Data Quality

| Check | Result |
|-------|--------|
| Total records | 40 ✅ |
| Industry populated | 38/40 (2 missing = failed enrichments) |
| Size bucket populated | 38/40 |
| New in Role indicator | 1/40 TRUE |
| Person names | 38/40 populated |

### Industry Distribution
- Professional, Business and Legal Services: 12
- Software and IT: 12
- Finance and Insurance: 4
- Software Development: 3
- Retail and Consumer Channels: 3

### Size Distribution
- 11-50 employees: 18
- 51-200 employees: 15
- 2-10 employees: 4
- 201-500 employees: 1
- (Missing): 2

---

## Files Created

```
src/projection/
├── __init__.py
├── extractors.py      # Field extraction functions
└── run_projection.py  # Main projection runner
```

---

## Schema Created

**Table:** `final_leads`

Key columns:
- Person: name, title, linkedin_url, headline, location
- Company: name, domain, industry, size, location, funding
- Indicators: is_new_in_role, is_worked_at_customer
- Raw: raw_company_payload, raw_person_payload (JSONB)

Indexes on: industry, size_bucket, country, state, indicators

---

## Known Limitations

1. **No Email:** Clay person enrichment doesn't include email. Need separate enrichment step.

2. **No Funding Date:** Can't compute "Recently Funded" - only have funding range, not date.

3. **Customer List Not Configured:** `is_worked_at_customer` requires passing customer domains.

4. **2 Records Missing Data:** Two batch items failed company enrichment, so their company fields are NULL.

---

## Next Steps

1. **Email Enrichment:** Add separate workflow step for email lookup (Apollo, Hunter, etc.)

2. **Customer List:** Configure customer domain list for indicator

3. **UI Integration:** Build dashboard to query `final_leads` table

4. **Scheduled Projection:** Add automation to run projection after batch completion

