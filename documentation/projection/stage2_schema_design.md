# Stage 2: Schema Design - Complete

**Date:** 2026-01-01
**Status:** ✅ Complete

---

## Objective

Design the `final_leads` table schema based on available data and UI requirements.

---

## final_leads Table Schema

```sql
CREATE TABLE final_leads (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Keys (for traceability)
    batch_item_id UUID NOT NULL REFERENCES batch_items(id),
    person_id UUID REFERENCES normalized_people(id),
    company_id UUID REFERENCES normalized_companies(id),
    
    -- Person Core Fields
    person_first_name TEXT,
    person_last_name TEXT,
    person_full_name TEXT,
    person_title TEXT,
    person_linkedin_url TEXT,
    person_headline TEXT,
    person_location TEXT,
    person_summary TEXT,
    current_job_start_date DATE,
    
    -- Company Core Fields
    company_name TEXT,
    company_domain TEXT,
    company_linkedin_url TEXT,
    company_website TEXT,
    company_logo_url TEXT,
    company_description TEXT,
    
    -- Firmographic Fields (Filterable)
    company_industry TEXT,                    -- Primary industry for display
    company_industries TEXT[],                -- Array for multi-select filter
    company_subindustries TEXT[],             -- Sub-categories
    company_size_bucket TEXT,                 -- "51-200 employees"
    company_employee_count INTEGER,           -- Exact count
    company_city TEXT,
    company_state TEXT,
    company_country TEXT,
    company_revenue_range TEXT,               -- "10M-25M"
    company_revenue_bucket TEXT,              -- Normalized: "$10M-$50M"
    
    -- Funding Fields
    company_funding_range TEXT,               -- "$25M - $50M" or "Funding unknown"
    company_funding_bucket TEXT,              -- Normalized for filtering
    company_founded_year INTEGER,
    
    -- Company Metadata
    company_type TEXT,                        -- "Privately Held", "Public", etc.
    company_business_stage TEXT,              -- "Established", "Growth Stage", etc.
    company_business_type TEXT[],             -- ["B2B", "B2C"]
    company_specialties TEXT[],               -- LinkedIn specialties
    
    -- Indicator Flags (Boolean for easy filtering)
    is_new_in_role BOOLEAN DEFAULT FALSE,
    is_recently_funded BOOLEAN DEFAULT FALSE,
    is_worked_at_customer BOOLEAN DEFAULT FALSE,
    
    -- Raw Payloads (for debugging/future extraction)
    raw_company_payload JSONB,
    raw_person_payload JSONB,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicates
    CONSTRAINT unique_batch_item UNIQUE (batch_item_id)
);

-- Indexes for common filter queries
CREATE INDEX idx_final_leads_company_industry ON final_leads(company_industry);
CREATE INDEX idx_final_leads_company_size_bucket ON final_leads(company_size_bucket);
CREATE INDEX idx_final_leads_company_revenue_bucket ON final_leads(company_revenue_bucket);
CREATE INDEX idx_final_leads_company_funding_bucket ON final_leads(company_funding_bucket);
CREATE INDEX idx_final_leads_company_country ON final_leads(company_country);
CREATE INDEX idx_final_leads_company_state ON final_leads(company_state);
CREATE INDEX idx_final_leads_is_new_in_role ON final_leads(is_new_in_role) WHERE is_new_in_role = TRUE;
CREATE INDEX idx_final_leads_is_recently_funded ON final_leads(is_recently_funded) WHERE is_recently_funded = TRUE;
CREATE INDEX idx_final_leads_is_worked_at_customer ON final_leads(is_worked_at_customer) WHERE is_worked_at_customer = TRUE;

-- GIN indexes for array fields
CREATE INDEX idx_final_leads_company_industries ON final_leads USING GIN(company_industries);
CREATE INDEX idx_final_leads_company_specialties ON final_leads USING GIN(company_specialties);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_final_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_final_leads_updated_at
    BEFORE UPDATE ON final_leads
    FOR EACH ROW
    EXECUTE FUNCTION update_final_leads_updated_at();
```

---

## Bucket Normalization

### Employee Size Buckets
| Raw Value | Normalized Bucket |
|-----------|-------------------|
| "1-10 employees" | "1-50" |
| "11-50 employees" | "1-50" |
| "51-200 employees" | "51-200" |
| "201-500 employees" | "201-500" |
| "501-1000 employees" | "501-1000" |
| "1001-5000 employees" | "1001-5000" |
| "5001-10000 employees" | "5001+" |
| "10001+ employees" | "5001+" |

### Revenue Buckets
| Raw Value | Normalized Bucket |
|-----------|-------------------|
| "0-1M" | "<$5M" |
| "1M-10M" | "$5M-$10M" |
| "10M-25M" | "$10M-$50M" |
| "25M-50M" | "$10M-$50M" |
| "50M-100M" | "$50M-$100M" |
| "100M-250M" | "$100M+" |
| "250M+" | "$100M+" |

### Funding Buckets
| Raw Value | Normalized Bucket |
|-----------|-------------------|
| "Funding unknown" | NULL |
| "$0 - $1M" | "$1M-$10M" |
| "$1M - $10M" | "$1M-$10M" |
| "$10M - $25M" | "$10M-$50M" |
| "$25M - $50M" | "$10M-$50M" |
| "$50M - $100M" | "$50M-$100M" |
| "$100M+" | "$100M+" |

---

## Design Decisions

### 1. Denormalized Structure
- Single table with all data for fast queries
- No joins needed for dashboard queries
- Trade-off: Some data duplication (company data repeated per person)

### 2. Both Raw and Normalized Values
- Keep original values (e.g., `company_size_bucket`) for display
- Add normalized buckets (e.g., `company_revenue_bucket`) for filtering
- Allows flexible UI without re-processing

### 3. Array Fields for Multi-Select Filters
- `company_industries TEXT[]` allows filtering by ANY industry
- Uses PostgreSQL GIN indexes for efficient array queries
- Query: `WHERE 'Technology' = ANY(company_industries)`

### 4. Indicator Flags as Booleans
- Simple TRUE/FALSE for fast filtering
- Partial indexes for efficient "show only X" queries
- Computed at projection time, not query time

### 5. Raw Payloads Stored
- Keep full Clay payloads in JSONB columns
- Allows future extraction of additional fields
- Debugging/auditing capability

### 6. Unique on batch_item_id
- One row per person record in batch
- Idempotent: re-running projection updates existing rows
- Uses `ON CONFLICT (batch_item_id) DO UPDATE`

---

## Migration File

Location: `supabase/migrations/20260101_create_final_leads.sql`

---

## Next Steps

1. Apply migration to create table
2. Proceed to **Stage 3: Extraction Functions**

