# GTM Lead Dashboard - Frontend Build Prompt

## Assignment

Build a GTM (Go-To-Market) lead qualification dashboard that allows sales teams to filter, search, and act on enriched B2B leads. This is a production-grade internal tool with a premium, modern aesthetic.

---

## Database Context

### Connection
- **Platform**: Supabase (PostgreSQL)
- **Project**: `demdntaknhsjzylhmynq`
- You have full access to the Supabase project.

### Primary Table: `final_leads`

This table contains ~40 enriched leads (will scale to thousands). Each row is a person at a company with enrichment data from Clay.

```sql
-- Core IDs
id UUID PRIMARY KEY
batch_item_id UUID
person_id UUID
company_id UUID

-- Person Fields
person_first_name VARCHAR(255)
person_last_name VARCHAR(255)
person_full_name VARCHAR(511)
person_email VARCHAR(255)          -- NOTE: Currently NULL, future enrichment
person_linkedin_url TEXT
person_title VARCHAR(255)
person_headline TEXT
person_location TEXT
person_summary TEXT
person_current_job_start_date DATE

-- Company Fields
company_name VARCHAR(255)
company_domain VARCHAR(255)
company_linkedin_url TEXT
company_website TEXT
company_logo_url TEXT              -- NOTE: Currently NULL for most records
company_description TEXT
company_industry VARCHAR(255)      -- Primary industry (e.g., "Software Development")
company_industries JSONB           -- Array of industries ["Software and IT"]
company_subindustries JSONB        -- Array of sub-industries ["Retail and Ecommerce Software"]
company_size_bucket VARCHAR(50)    -- e.g., "51-200 employees", "201-500 employees"
company_employee_count INTEGER
company_city VARCHAR(255)
company_state VARCHAR(255)
company_country VARCHAR(255)
company_revenue_range VARCHAR(50)  -- e.g., "10M-25M"
company_funding_range VARCHAR(50)  -- e.g., "$25M - $50M"
company_founded_year INTEGER
company_type VARCHAR(255)          -- e.g., "Privately Held"
company_business_stage VARCHAR(255) -- e.g., "Growth Stage"
company_technologies JSONB         -- Array of tech/tags

-- Signal Indicators (Boolean Filters)
is_new_in_role BOOLEAN             -- Started current job within 6 months
is_recently_funded BOOLEAN         -- Company recently funded (placeholder)
is_worked_at_customer BOOLEAN      -- Person previously worked at a customer company

-- Timestamps
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### Current Data Distribution (for filter UI)

**Industries**: Software Development, IT Services, various others
**Company Sizes**: "11-50 employees", "51-200 employees", "201-500 employees", "501-1000 employees", "1001-5000 employees"
**Locations**: Primarily US (CA, NY, TX, etc.)
**Signals**: 1 lead is "New in Role", 0 "Worked at Customer" (can be mocked)

---

## Design Requirements

### Aesthetic Direction

**NOT this**: Generic Bootstrap/Material UI with purple gradients, Inter font, rounded cards everywhere. No "AI slop" aesthetic.

**YES this**: 
- **Dark mode primary** with high contrast
- **Monospace or geometric sans-serif typography** (JetBrains Mono, Space Mono, Outfit, Satoshi)
- **Dense, information-rich layouts** - this is a power-user tool, not a consumer app
- **Sharp edges**, minimal border-radius (2-4px max)
- **Color palette**: Deep charcoal background (#0a0a0a to #1a1a1a), subtle borders (#2a2a2a), bright accent for CTAs (electric blue, cyan, or lime green)
- **Data table aesthetic** inspired by: Linear, Vercel Dashboard, Raycast, Notion databases

### Visual Inspiration
- Linear's issue tracker (dense, keyboard-navigable, monospace touches)
- Vercel's dashboard (dark, sharp, clear hierarchy)
- Retool/Airplane internal tool aesthetic (functional density)

---

## Functional Requirements

### 1. Lead Table (Primary View)

A sortable, filterable data table showing all leads.

**Visible Columns** (default):
| Person | Title | Company | Industry | Size | Location | Signals |
|--------|-------|---------|----------|------|----------|---------|

**Column Details**:
- **Person**: `person_full_name` with LinkedIn icon link to `person_linkedin_url`
- **Title**: `person_title` (truncate with tooltip if long)
- **Company**: `company_name` with small domain badge (`company_domain`)
- **Industry**: `company_industry`
- **Size**: `company_size_bucket` (show as compact badge)
- **Location**: `company_city, company_state` or `company_country` if no city
- **Signals**: Badge indicators for `is_new_in_role`, `is_worked_at_customer`

**Table Behaviors**:
- Click row → expand detail panel (slide-in from right or inline expand)
- Sortable by any column
- Sticky header
- Pagination or infinite scroll (your choice)
- Bulk select checkbox column

### 2. Filter Panel (Left Sidebar)

Collapsible filter panel with these filter groups:

**COMPANY FILTERS**
- Industry (multi-select dropdown from `company_industry` distinct values)
- Employee Size (multi-select from `company_size_bucket` distinct values)
- Location: Country, State, City (cascading or independent)
- Revenue Range (dropdown from `company_revenue_range`)
- Funding Range (dropdown from `company_funding_range`)

**SIGNAL FILTERS**
- New in Role (toggle/checkbox) → `is_new_in_role = true`
- Worked at Customer (toggle/checkbox) → `is_worked_at_customer = true`
- Recently Funded (toggle/checkbox) → `is_recently_funded = true`

**PERSON FILTERS**
- Title contains (text input, case-insensitive search on `person_title`)

**Filter UX**:
- Show active filter count badge
- "Clear all filters" button
- Filters should update table in real-time (debounced)
- URL state sync (filters persist in URL params)

### 3. Search

Global search bar (top of page) that searches across:
- `person_full_name`
- `company_name`
- `company_domain`

Debounced, case-insensitive, partial match.

### 4. Lead Detail Panel

When a lead row is clicked, show expanded detail:

**Person Section**:
- Full name, headline
- Title at Company
- LinkedIn button (external link)
- Location
- Summary (if exists)
- "New in Role" badge with start date if applicable

**Company Section**:
- Company name + logo (if `company_logo_url` exists, else placeholder)
- Domain (clickable to website)
- LinkedIn button
- Description
- Industry tags (from `company_industries` array)
- Firmographics: Size, Revenue, Funding, Founded, Stage
- Technologies (from `company_technologies` array, as tags)

### 5. Export

"Export" button that downloads currently filtered results as CSV.

Include columns: person_full_name, person_email, person_title, person_linkedin_url, company_name, company_domain, company_industry, company_size_bucket, is_new_in_role, is_worked_at_customer

### 6. Stats Bar (Optional, Nice-to-Have)

Top bar showing:
- Total leads (filtered count / total count)
- Count by key signals: "X New in Role", "Y Customer Alumni"

---

## Technical Preferences

### Stack
- **Framework**: Next.js 14+ (App Router) or React + Vite
- **Styling**: Tailwind CSS (preferred) or CSS Modules
- **Data Fetching**: Supabase JS client, React Query or SWR for caching
- **State**: URL params for filters, React state for UI

### Supabase Integration
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Example query with filters
const { data, error } = await supabase
  .from('final_leads')
  .select('*')
  .eq('is_new_in_role', true)
  .ilike('person_title', '%founder%')
  .in('company_size_bucket', ['51-200 employees', '201-500 employees'])
  .order('company_name', { ascending: true })
```

### File Structure Suggestion
```
/app
  /dashboard
    page.tsx          # Main dashboard page
    /components
      LeadTable.tsx
      FilterPanel.tsx
      LeadDetail.tsx
      SearchBar.tsx
      ExportButton.tsx
/lib
  supabase.ts         # Supabase client
  types.ts            # TypeScript types for final_leads
/hooks
  useLeads.ts         # Data fetching hook with filters
```

---

## Deliverables

1. Fully functional lead dashboard with all features above
2. Responsive (desktop-first, but usable on tablet)
3. Dark mode by default
4. TypeScript throughout
5. Clean, maintainable code

---

## What NOT to Build

- Authentication (assume user is already authenticated)
- Lead creation/editing (read-only dashboard)
- Email sending or sequence integration (future scope)
- Mobile-optimized views (desktop tool)

---

## Example Queries for Testing

```sql
-- Get all leads
SELECT * FROM final_leads ORDER BY company_name;

-- Get distinct industries for filter dropdown
SELECT DISTINCT company_industry FROM final_leads WHERE company_industry IS NOT NULL;

-- Get distinct sizes for filter dropdown  
SELECT DISTINCT company_size_bucket FROM final_leads WHERE company_size_bucket IS NOT NULL;

-- Filter: New in Role + Software industry
SELECT * FROM final_leads 
WHERE is_new_in_role = true 
AND company_industry = 'Software Development';

-- Search by name
SELECT * FROM final_leads 
WHERE person_full_name ILIKE '%carter%';
```

---

## Final Note

This is a power-user tool for sales teams. Prioritize:
1. **Information density** over whitespace
2. **Speed** (fast filtering, instant search)
3. **Clarity** (obvious what each filter does)
4. **Polish** (transitions, hover states, loading states)

Build something that feels like a premium internal tool, not a template.

