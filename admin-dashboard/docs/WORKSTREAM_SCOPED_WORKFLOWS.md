# Workstream-Scoped Workflows Schema Change

**Date**: 2026-01-01
**Status**: Implemented
**Impact**: Mission Critical - Database Schema + Application Code

## Summary

This document describes the schema migration that enables workflows to be scoped per workstream, allowing the same workflow slug (e.g., `normalize_all_core_values`) to exist in multiple workstreams (e.g., both `apollo_scrape` and `crm_data`).

## Problem

Previously, the `enrichment_registry` table used `slug` as the primary key, enforcing global uniqueness. This prevented creating workflows with the same name/slug across different workstreams, which is a valid use case (e.g., a "Normalize All Core Values" workflow might be needed for both Apollo leads and CRM data, with different configurations).

**Error encountered:**
```
duplicate key value violates unique constraint "enrichment_registry_pkey"
```

## Solution

### Database Changes

#### 1. Modified `enrichment_registry` table

```sql
-- Added UUID primary key
ALTER TABLE enrichment_registry
ADD COLUMN id UUID DEFAULT gen_random_uuid();

-- Changed primary key from slug to id
ALTER TABLE enrichment_registry
DROP CONSTRAINT enrichment_registry_pkey;

ALTER TABLE enrichment_registry
ADD PRIMARY KEY (id);

-- Added composite unique constraint
ALTER TABLE enrichment_registry
ADD CONSTRAINT enrichment_registry_slug_workstream_unique
UNIQUE (slug, workstream_slug);
```

**Before:**
| Column | Constraint |
|--------|------------|
| slug | PRIMARY KEY |

**After:**
| Column | Constraint |
|--------|------------|
| id (UUID) | PRIMARY KEY |
| (slug, workstream_slug) | UNIQUE |

#### 2. Added `workstream_slug` to referencing tables

Both `enrichment_results` and `client_workflow_configs` now include `workstream_slug` to properly identify which workflow they reference:

```sql
-- enrichment_results
ALTER TABLE enrichment_results
ADD COLUMN workstream_slug TEXT;

-- client_workflow_configs
ALTER TABLE client_workflow_configs
ADD COLUMN workstream_slug TEXT;
```

#### 3. Updated foreign key constraints

Foreign keys now reference the composite `(slug, workstream_slug)`:

```sql
ALTER TABLE enrichment_results
ADD CONSTRAINT enrichment_results_workflow_fkey
FOREIGN KEY (workflow_slug, workstream_slug)
REFERENCES enrichment_registry(slug, workstream_slug);

ALTER TABLE client_workflow_configs
ADD CONSTRAINT client_workflow_configs_workflow_fkey
FOREIGN KEY (workflow_slug, workstream_slug)
REFERENCES enrichment_registry(slug, workstream_slug);
```

#### 4. Updated unique constraint on `client_workflow_configs`

```sql
ALTER TABLE client_workflow_configs
ADD CONSTRAINT client_workflow_configs_client_workflow_workstream_unique
UNIQUE (client_id, workflow_slug, workstream_slug);
```

### Application Code Changes

#### 1. Updated `ClientWorkflowConfig` type

**File:** `src/app/actions.ts`

```typescript
// Before
export type ClientWorkflowConfig = {
  id: string;
  client_id: string;
  workflow_slug: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// After
export type ClientWorkflowConfig = {
  id: string;
  client_id: string;
  workflow_slug: string;
  workstream_slug: string;  // NEW
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
```

#### 2. Updated `saveClientWorkflowConfig` function

**File:** `src/app/actions.ts`

```typescript
// Before
export async function saveClientWorkflowConfig(
  clientId: string,
  workflowSlug: string,
  config: Record<string, unknown>
): Promise<...>

// After
export async function saveClientWorkflowConfig(
  clientId: string,
  workflowSlug: string,
  config: Record<string, unknown>,
  workstreamSlug: string  // NEW - REQUIRED PARAMETER
): Promise<...>
```

#### 3. Updated all config pages

All workstream config pages now pass `WORKSTREAM_SLUG` to `saveClientWorkflowConfig`:

| File | Workstream Slug |
|------|-----------------|
| `apollo-ingest/config/page.tsx` | `"apollo_scrape"` |
| `customer-companies/config/page.tsx` | `"customer_companies"` |
| `crm-data/config/page.tsx` | `"crm_data"` |
| `salesnav-koolkit/config/page.tsx` | `"salesnav_koolkit"` |

## Full Migration SQL

For reference, here is the complete migration that was run:

```sql
-- ============================================
-- STEP 1: Add workstream_slug to referencing tables
-- ============================================

ALTER TABLE enrichment_results
ADD COLUMN IF NOT EXISTS workstream_slug TEXT;

ALTER TABLE client_workflow_configs
ADD COLUMN IF NOT EXISTS workstream_slug TEXT;

-- ============================================
-- STEP 2: Backfill workstream_slug from enrichment_registry
-- ============================================

UPDATE enrichment_results er
SET workstream_slug = reg.workstream_slug
FROM enrichment_registry reg
WHERE er.workflow_slug = reg.slug
AND er.workstream_slug IS NULL;

UPDATE client_workflow_configs cwc
SET workstream_slug = reg.workstream_slug
FROM enrichment_registry reg
WHERE cwc.workflow_slug = reg.slug
AND cwc.workstream_slug IS NULL;

-- ============================================
-- STEP 3: Drop old foreign key constraints
-- ============================================

ALTER TABLE enrichment_results
DROP CONSTRAINT IF EXISTS enrichment_results_workflow_slug_fkey;

ALTER TABLE client_workflow_configs
DROP CONSTRAINT IF EXISTS client_workflow_configs_workflow_slug_fkey;

-- ============================================
-- STEP 4: Modify enrichment_registry primary key
-- ============================================

ALTER TABLE enrichment_registry
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

ALTER TABLE enrichment_registry
DROP CONSTRAINT enrichment_registry_pkey;

ALTER TABLE enrichment_registry
ADD PRIMARY KEY (id);

ALTER TABLE enrichment_registry
ADD CONSTRAINT enrichment_registry_slug_workstream_unique
UNIQUE (slug, workstream_slug);

-- ============================================
-- STEP 5: Create new composite foreign keys
-- ============================================

ALTER TABLE enrichment_results
ADD CONSTRAINT enrichment_results_workflow_fkey
FOREIGN KEY (workflow_slug, workstream_slug)
REFERENCES enrichment_registry(slug, workstream_slug);

ALTER TABLE client_workflow_configs
ADD CONSTRAINT client_workflow_configs_workflow_fkey
FOREIGN KEY (workflow_slug, workstream_slug)
REFERENCES enrichment_registry(slug, workstream_slug);

-- ============================================
-- STEP 6: Update unique constraint for upsert
-- ============================================

ALTER TABLE client_workflow_configs
DROP CONSTRAINT IF EXISTS client_workflow_configs_client_id_workflow_slug_key;

ALTER TABLE client_workflow_configs
ADD CONSTRAINT client_workflow_configs_client_workflow_workstream_unique
UNIQUE (client_id, workflow_slug, workstream_slug);
```

## Breaking Changes

### For Developers

1. **`saveClientWorkflowConfig` now requires 4 parameters** instead of 3. The `workstreamSlug` parameter is now required.

2. **Workflow lookups may need updating** - Any code that looks up workflows by slug alone may need to also filter by `workstream_slug` to get the correct workflow.

### For Database Queries

1. **Workflow references now require both columns** - When joining to `enrichment_registry`, use both `workflow_slug` AND `workstream_slug`.

2. **The `slug` column is no longer unique by itself** - Always query with `(slug, workstream_slug)` to get a unique workflow.

## Validation

After migration, verify:

1. ✅ Can create workflows with same slug in different workstreams
2. ✅ Existing workflow configs still work
3. ✅ Config pages save with correct workstream_slug
4. ✅ No orphaned records in referencing tables

```sql
-- Check for any records missing workstream_slug
SELECT COUNT(*) FROM enrichment_results WHERE workstream_slug IS NULL;
SELECT COUNT(*) FROM client_workflow_configs WHERE workstream_slug IS NULL;

-- Verify unique constraint works
SELECT slug, workstream_slug, COUNT(*)
FROM enrichment_registry
GROUP BY slug, workstream_slug
HAVING COUNT(*) > 1;
```

## Rollback Plan

**WARNING**: Rollback is complex due to data dependencies. If rollback is needed:

1. Ensure no duplicate slugs exist across workstreams
2. Drop new constraints
3. Recreate old primary key on `slug`
4. Recreate old foreign keys
5. Drop `workstream_slug` columns from referencing tables

This should only be done if critical issues are discovered and no workflows with duplicate slugs have been created.
