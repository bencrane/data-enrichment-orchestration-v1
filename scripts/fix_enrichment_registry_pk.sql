-- Fix enrichment_registry to allow same workflow slug across different workstreams
-- The primary key should be a composite of (slug, workstream_slug) or use a UUID

-- Step 1: Add a UUID id column
ALTER TABLE enrichment_registry
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Step 2: Drop the existing primary key constraint on slug
ALTER TABLE enrichment_registry
DROP CONSTRAINT IF EXISTS enrichment_registry_pkey;

-- Step 3: Set the new primary key to be the id column
ALTER TABLE enrichment_registry
ADD PRIMARY KEY (id);

-- Step 4: Add unique constraint on (slug, workstream_slug) to allow same slug in different workstreams
ALTER TABLE enrichment_registry
ADD CONSTRAINT enrichment_registry_slug_workstream_unique
UNIQUE (slug, workstream_slug);

-- Verify the change
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'enrichment_registry';
