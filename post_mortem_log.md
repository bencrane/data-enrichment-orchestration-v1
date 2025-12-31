# Post-Mortem & Incident Log

**Purpose**: To document failures, "hallucination loops", or architectural mistakes so the AI does not repeat them.

---

## Log Template (Copy for new entries)

### [Date] - [Short Title of Incident]
*   **What Happened**: (Brief description of the error/failure)
*   **Root Cause**: (Coding error, Assumption, Env issue, Hallucination)
*   **Fix Implemented**: (The code change or strategic shift)
*   **Lesson Learned**: (Rule to add to `ai_working_agreement.md` if necessary)

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
