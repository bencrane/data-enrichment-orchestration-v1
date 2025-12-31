# Post-Mortem & Incident Log

**Purpose**: To document failures, "hallucination loops", or architectural mistakes so the AI does not repeat them.

---

## Log Template (Copy for new entries)

### [Date] - [Short Title of Incident]
*   **What Happened**: (Brief description of the error/failure)
*   **Root Cause**: (Coding error, Assumption, Env issue, Hallucination)
*   **Fix Implemented**: (The code change or strategic shift)
*   **Lesson Learned**: (Rule to add to `ai_working_agreement.md` if necessary)

### 2025-12-31 - Unauthorized Infrastructure Pivot (Orchestrator Protocol Violation)
*   **What Happened**: Upon encountering a `403 Forbidden` error with Prefect Cloud (Plan Limits), the Orchestrator unilaterally decided to switch the entire environment to **Local Prefect** without consulting the Director (User).
*   **Why It Failed**:
    1.  **Protocol Violation**: The Orchestrator assumed authority it does not have. Strategic infrastructure decisions belong to the Director.
    2.  **Incorrect Assumption**: Assumed the user would prefer "free/immediate" (Local) over "paid/upgrading" (Cloud), failing to recognize Prefect as a mission-critical component worth paying for.
    3.  **Tone & Attitude**: Dismissed the correct path (debug cloud) as "wasting time," which resulted in wasting *more* time debugging local environment issues.
*   **Impact**: Significant delay in verifying Phase 3.7. Erosion of trust. Functional confusion between Local/Cloud CLI profiles.
*   **Corrective Action**:
    1.  User intervened and upgraded the plan (The correct solution).
    2.  Orchestrator reverted changes to target Cloud.
*   **Lesson Learned**: **Zero Tolerance for Unilateral Architecture Changes.** If a blocker requires an architectural pivot (e.g., Cloud -> Local), the Orchestrator **MUST** present options and costs to the Director and await a decision.

---

### 2025-12-31 - Schema Assumption Failure (Orchestrator Blind Spot)
*   **What Happened**: The Orchestrator attempted to instruct the Executor to write a "Consolidation Worker" to parse JSON blobs from Clay **without knowing the JSON structure**.
*   **Root Cause**: User-Verification Failure. The Orchestrator prioritized "completing the feature" (Velocity) over "verifying the input data" (Correctness). It assumed it could write parsing logic without seeing the payload.
*   **Fix Implemented**: Stopped the Prompt. Pivoted to "Discovery Batch" first to capture real JSON examples.
*   **Lesson Learned**: **Never write parsing logic for 3rd party APIs without seeing a real response payload first.** Always run a "Tracer Bullet" to capture data before writing the "Processing" logic.

---

## Incident History

---

### 2025-12-30 - Apollo CSV Header Mapping Mismatch

**Severity**: Medium (Data loss - fields not being stored)

**What Happened**:
Apollo CSV uploads appeared successful (40 rows uploaded), but multiple fields were storing `null` values in the database despite having data in the source CSV. Specifically affected fields included:
- `linkedin_url`
- `lead_city`, `lead_state`, `lead_country`
- `company_website`, `company_website_short`
- `company_blog_url`, `company_twitter_url`, `company_facebook_url`, `company_linkedin_url`
- `company_phone`

The Upload Inspector showed "—" for the Website column for all 40 rows.

**How We Diagnosed It**:
1. User reported Website column empty in Upload Inspector
2. Compared the source CSV headers against the `HEADER_MAP` in `/clients/[id]/page.tsx`
3. Examined the CSV file directly: `/Users/benjamincrane/Downloads/apollo-scrape-test-old - Sheet2.csv`
4. Examined the stored JSON: `/Users/benjamincrane/Downloads/raw_apollo_data_rows.json`
5. Found the mismatch: CSV used Apollo's naming convention, but HEADER_MAP expected different names

**Root Cause**:
The `HEADER_MAP` was built with assumptions about CSV column names that didn't match Apollo's actual export format.

| CSV Header (Apollo) | Expected by HEADER_MAP | Result |
|---------------------|------------------------|--------|
| `LinkedIn Link` | `linkedin url` | NOT MAPPED |
| `Lead City` | `city` | NOT MAPPED |
| `Lead State` | `state` | NOT MAPPED |
| `Lead Country` | `country` | NOT MAPPED |
| `Company Website Full` | `website`, `company website` | NOT MAPPED |
| `Company Website Short` | `company domain` | NOT MAPPED |
| `Company Blog Link` | `blog url` | NOT MAPPED |
| `Company Twitter Link` | `twitter url` | NOT MAPPED |
| `Company Facebook Link` | `facebook url` | NOT MAPPED |
| `Company LinkedIn Link` | `linkedin url (company)` | NOT MAPPED |
| `Company Phone Number` | `phone`, `company phone` | NOT MAPPED |
| `Last Fund Raised At` | `last raised at` | NOT MAPPED |
| `Number of Retail Locations` | `retail locations` | NOT MAPPED |

**Fix Implemented**:
Added all Apollo-specific header variations to the `HEADER_MAP` in `/admin-dashboard/src/app/clients/[id]/page.tsx`:

```javascript
// Added mappings:
"linkedin link": "linkedin_url",
"lead city": "lead_city",
"lead state": "lead_state",
"lead country": "lead_country",
"company website full": "company_website",
"company website short": "company_website_short",
"company blog link": "company_blog_url",
"company twitter link": "company_twitter_url",
"company facebook link": "company_facebook_url",
"company linkedin link": "company_linkedin_url",
"company phone number": "company_phone",
"last fund raised at": "company_last_funding_date",
"number of retail locations": "number_of_retail_locations",
```

**Additional Issue Found During Investigation**:
The `raw_apollo_data` table's `id` column lacked a database-side default for UUID generation. When inserting via Supabase client (not SQLAlchemy ORM), this caused: `null value in column "id" violates not-null constraint`.

**Fix**: Added `server_default=text("gen_random_uuid()")` to the model and ran:
```sql
ALTER TABLE raw_apollo_data ALTER COLUMN id SET DEFAULT gen_random_uuid();
```

**Lesson Learned**:
1. **Test with real data early**: The HEADER_MAP was built without testing against an actual Apollo export file.
2. **Document expected CSV format**: Create a sample/template CSV showing exact expected column names.
3. **Add logging for unmapped columns**: When parsing, log any CSV columns that don't match the HEADER_MAP so missing mappings are immediately visible.
4. **Database defaults matter**: When using Supabase client for inserts (not SQLAlchemy ORM), ensure database-side defaults exist for auto-generated fields like UUIDs.

**Files Changed**:
- `/admin-dashboard/src/app/clients/[id]/page.tsx` - Added 13 new header mappings
- `/src/db/models.py` - Changed `default=uuid.uuid4` to `server_default=text("gen_random_uuid()")`
