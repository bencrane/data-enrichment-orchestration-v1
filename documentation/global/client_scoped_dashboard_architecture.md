# Client-Scoped Dashboard Architecture

## Overview

A single GTM dashboard deployment serves all clients. Each client sees only their data, with UI features dynamically adjusted based on what enrichments are available for that client.

## Core Principles

1. **One dashboard, many clients** — No separate deployments per client
2. **Data isolation via `client_id`** — All queries scoped by client
3. **Dynamic UI based on data availability** — Filters appear only if data exists
4. **Graceful degradation** — Missing enrichments result in NULL fields, not errors

## How Different Clients Get Different Enrichments

### Configuration Layer

`client_workflow_configs` stores per-client, per-workstream, per-workflow settings:

```
client_id          | workstream_slug | workflow_slug                    | config
-------------------|-----------------|----------------------------------|------------------
securitypal-ai     | crm_data        | enrich_company_via_clay_waterfall| {webhook_url: ...}
securitypal-ai     | crm_data        | enrich_person_via_clay_waterfall | {webhook_url: ...}
acme-corp          | crm_data        | enrich_company_via_clay_waterfall| {webhook_url: ...}
acme-corp          | crm_data        | enrich_person_via_clay_waterfall | {webhook_url: ...}
acme-corp          | crm_data        | enrich_email_via_hunter          | {api_key: ...}
```

### Result in `final_leads`

| client_id | person_email | buyer_intent_score |
|-----------|--------------|-------------------|
| securitypal-ai | NULL | NULL |
| acme-corp | john@acme.com | 85 |

Different clients have different fields populated based on which workflows they've purchased/enabled.

## Dynamic Filter Discovery

When the dashboard loads, query what enrichments are actually available:

```sql
SELECT 
  COUNT(*) FILTER (WHERE person_email IS NOT NULL) > 0 AS has_email,
  COUNT(*) FILTER (WHERE buyer_intent_score IS NOT NULL) > 0 AS has_intent,
  COUNT(*) FILTER (WHERE technologies IS NOT NULL) > 0 AS has_technographics,
  COUNT(*) FILTER (WHERE funding_total_usd IS NOT NULL) > 0 AS has_funding,
  COUNT(*) FILTER (WHERE is_new_in_role = true) > 0 AS has_new_in_role_indicator
FROM final_leads
WHERE client_id = $1;
```

Returns:
```json
{
  "has_email": false,
  "has_intent": false,
  "has_technographics": true,
  "has_funding": true,
  "has_new_in_role_indicator": true
}
```

## UI Implementation

### Filter Panel

```typescript
interface EnrichmentAvailability {
  has_email: boolean;
  has_intent: boolean;
  has_technographics: boolean;
  has_funding: boolean;
  has_new_in_role_indicator: boolean;
}

function FilterPanel({ availability }: { availability: EnrichmentAvailability }) {
  return (
    <div className="filter-panel">
      {/* Always show core filters */}
      <CompanyFilter />
      <RoleFilter />
      
      {/* Conditional filters based on data availability */}
      {availability.has_email && <EmailFilter />}
      {availability.has_intent && <IntentScoreFilter />}
      {availability.has_technographics && <TechnologiesFilter />}
      {availability.has_funding && <FundingRangeFilter />}
      {availability.has_new_in_role_indicator && <NewInRoleToggle />}
    </div>
  );
}
```

### Dashboard Loader

```typescript
async function loadDashboard(clientId: string) {
  const [leads, availability] = await Promise.all([
    supabase
      .from('final_leads')
      .select('*')
      .eq('client_id', clientId),
    supabase
      .rpc('get_client_enrichment_availability', { p_client_id: clientId })
  ]);
  
  return { leads: leads.data, availability: availability.data };
}
```

### Postgres Function (Optional)

```sql
CREATE OR REPLACE FUNCTION get_client_enrichment_availability(p_client_id TEXT)
RETURNS JSON AS $$
  SELECT json_build_object(
    'has_email', COUNT(*) FILTER (WHERE person_email IS NOT NULL) > 0,
    'has_intent', COUNT(*) FILTER (WHERE buyer_intent_score IS NOT NULL) > 0,
    'has_technographics', COUNT(*) FILTER (WHERE technologies IS NOT NULL) > 0,
    'has_funding', COUNT(*) FILTER (WHERE funding_total_usd IS NOT NULL) > 0,
    'has_new_in_role_indicator', COUNT(*) FILTER (WHERE is_new_in_role = true) > 0
  )
  FROM final_leads
  WHERE client_id = p_client_id;
$$ LANGUAGE SQL STABLE;
```

## Comparison of Approaches

| Approach | Pros | Cons |
|----------|------|------|
| **Data-driven (recommended)** | Self-healing, no maintenance, always accurate | ~50ms extra query on load |
| **Config-driven** | Fast, explicit control | Manual sync required, can drift from reality |
| **Separate dashboards** | Full customization | Doesn't scale, maintenance nightmare |

## Handling Mixed Workstreams

If a client has data from both `apollo_scrape` and `crm_data` workstreams:

```sql
-- final_leads has source_workstream column
SELECT DISTINCT source_workstream 
FROM final_leads 
WHERE client_id = 'securitypal-ai';

-- Returns: ['apollo_scrape', 'crm_data']
```

UI can then offer:
- **Combined view** — All leads in one table
- **Tabbed view** — Separate tabs per workstream
- **Filter by source** — Dropdown to filter by workstream

## Edge Cases

### Client with no data yet

```json
{
  "has_email": false,
  "has_intent": false,
  "has_technographics": false,
  ...
}
```

UI shows empty state: "No leads yet. Upload data to get started."

### New enrichment added mid-lifecycle

Client purchases email enrichment after initial setup:
1. New workflow added to `client_workflow_configs`
2. Re-run projection for existing data (or let new batches populate)
3. Dashboard automatically shows email filter once data exists

No code changes needed — data-driven approach handles it.

### Field available but all NULL for this client

Same as "not available" — filter doesn't appear. The query checks for actual non-NULL values, not schema presence.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     GTM Dashboard                           │
│  (Single deployment, client-scoped via session/auth)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      final_leads                            │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │ client_id   │ person_name │ person_email│ intent_score│  │
│  ├─────────────┼─────────────┼─────────────┼─────────────┤  │
│  │ client_a    │ John Doe    │ NULL        │ NULL        │  │
│  │ client_a    │ Jane Smith  │ NULL        │ NULL        │  │
│  │ client_b    │ Bob Wilson  │ bob@co.com  │ 85          │  │
│  │ client_b    │ Alice Brown │ alice@co.com│ 72          │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌───────────────────┐                   ┌───────────────────┐
│ Client A Dashboard│                   │ Client B Dashboard│
│ - No email filter │                   │ - Email filter ✓  │
│ - No intent filter│                   │ - Intent filter ✓ │
└───────────────────┘                   └───────────────────┘
```

## Summary

- **One codebase, one deployment** — Scales to N clients without ops overhead
- **`client_id` everywhere** — Data isolation is fundamental, not bolted on
- **Data-driven UI** — Filters appear based on what data actually exists
- **No config drift** — If enrichment runs, filter appears; if not, it doesn't

