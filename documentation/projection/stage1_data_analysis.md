# Stage 1: Data Analysis - Complete

**Date:** 2026-01-01
**Status:** ✅ Complete

---

## Objective

Understand what Clay returns so we know what we can extract for `final_leads`.

---

## Company Enrichment Payload Fields

### Core Fields
| Clay Field | Type | Example | Notes |
|------------|------|---------|-------|
| `name` | string | "Clockwork" | Company name |
| `domain` | string | "clockwork.com" | Primary domain |
| `url` | string | "https://linkedin.com/company/..." | LinkedIn URL |
| `website` | string | "http://www.clockwork.com" | Company website |
| `industry` | string | "Technology, Information and Media" | Raw industry |
| `size` | string | "51-200 employees" | Employee size bucket |
| `employee_count` | int | 67 | Exact employee count |
| `type` | string | "Privately Held" | Company type |
| `founded` | int | 2002 | Year founded |

### Location Fields
| Clay Field | Type | Example | Notes |
|------------|------|---------|-------|
| `locality` | string | "Minneapolis, MN" | City, State |
| `country` | string | "US" | Country code |
| `locations` | array | [...] | Full address details |
| `locations[0].inferred_location.locality` | string | "Minneapolis" | Parsed city |
| `locations[0].inferred_location.admin_district` | string | "MN" | Parsed state |

### Financial Fields
| Clay Field | Type | Example | Notes |
|------------|------|---------|-------|
| `annual_revenue` | string | "10M-25M" | Revenue range |
| `total_funding_amount_range_usd` | string | "$25M - $50M" or "Funding unknown" | Funding range |

### Derived Fields (AI-generated)
| Clay Field | Type | Example | Notes |
|------------|------|---------|-------|
| `derived_datapoints.industry` | array | ["Software and IT", "Professional Services"] | Normalized industries |
| `derived_datapoints.subindustry` | array | ["IT Services", "Management Consulting"] | Sub-categories |
| `derived_datapoints.business_type` | array | ["B2B"] | Business model |
| `derived_datapoints.business_stage` | string | "Established" | Growth stage |
| `derived_datapoints.revenue_streams` | array | ["Subscriptions", "Services"] | Revenue types |
| `derived_datapoints.primary_offerings` | array | ["Custom software", "UX design"] | Products/services |

### Other Fields
| Clay Field | Type | Example | Notes |
|------------|------|---------|-------|
| `description` | string | "..." | Company description |
| `specialties` | array | ["Digital Transformation", ...] | LinkedIn specialties |
| `logo_url` | string | "https://..." | Company logo |
| `follower_count` | int | 7313 | LinkedIn followers |
| `clay_company_id` | int | 40230869 | Clay internal ID |
| `org_id` | int | 516802 | LinkedIn org ID |

---

## Person Enrichment Payload Fields

### Core Fields
| Clay Field | Type | Example | Notes |
|------------|------|---------|-------|
| `name` | string | "Vincent DAnnunzio" | Full name |
| `first_name` | string | "Vincent" | First name |
| `last_name` | string | "DAnnunzio" | Last name |
| `title` | string | "Sales Operations Manager" | Current title |
| `headline` | string | "Sales Operations Manager at ATP Gov" | LinkedIn headline |
| `url` | string | "https://linkedin.com/in/..." | LinkedIn profile URL |
| `org` | string | "ATP Gov" | Current company |

### Location Fields
| Clay Field | Type | Example | Notes |
|------------|------|---------|-------|
| `location_name` | string | "Mendham, New Jersey, United States" | Full location |
| `country` | string | "United States" | Country |

### Experience Fields
| Clay Field | Type | Example | Notes |
|------------|------|---------|-------|
| `experience` | array | [...] | Full work history |
| `experience[].title` | string | "Sales Operations Manager" | Job title |
| `experience[].company` | string | "ATP Gov" | Company name |
| `experience[].company_domain` | string | "atpgov.com" | Company domain |
| `experience[].start_date` | string | "2023-02-01" | Start date |
| `experience[].end_date` | string/null | null | End date (null = current) |
| `experience[].is_current` | bool | true | Current job flag |
| `latest_experience` | dict | {...} | Most recent job |
| `current_experience` | array | [...] | All current jobs |
| `jobs_count` | int | 6 | Total jobs |

### Social/Engagement Fields
| Clay Field | Type | Example | Notes |
|------------|------|---------|-------|
| `connections` | int | 396 | LinkedIn connections |
| `num_followers` | int | 396 | LinkedIn followers |
| `profile_id` | int | 835207145 | LinkedIn profile ID |

### Education Fields
| Clay Field | Type | Example | Notes |
|------------|------|---------|-------|
| `education` | array | [...] | Education history |
| `education[].school_name` | string | "County College of Morris" | School |
| `education[].degree` | string | "Associate's degree" | Degree type |
| `education[].field_of_study` | string | "Business/Corporate Communications" | Major |

### Other Fields (mostly NULL in samples)
| Clay Field | Type | Notes |
|------------|------|-------|
| `summary` | string | LinkedIn bio/summary |
| `picture_url_orig` | string | Profile photo |
| `certifications` | array | Professional certifications |
| `awards` | array | Awards received |
| `publications` | array | Publications |
| `patents` | array | Patents |
| `languages` | array | Languages spoken |
| `volunteering` | array | Volunteer work |

---

## Key Findings

### ⚠️ Email NOT Available
- **Critical:** Person enrichment does NOT include email addresses
- Clay's LinkedIn scrape doesn't provide emails
- Need separate email enrichment step (e.g., Apollo, Hunter) if email is required

### ✅ What IS Available
1. **Company firmographics:** Industry, size, revenue, location, funding
2. **Person career data:** Title, company, work history, education
3. **Indicator potential:** Can compute "New in Role" from `experience[].start_date`
4. **AI-derived insights:** Normalized industry categories, business stage

### 📊 Data Quality
- Company data is rich (funding, revenue, derived datapoints)
- Person data is employment-focused (no email, limited personal info)
- Most records have location data
- Funding data often "unknown"

---

## Field Mapping: Clay → final_leads

### Person Fields
| final_leads Column | Source |
|-------------------|--------|
| `person_first_name` | `person.first_name` |
| `person_last_name` | `person.last_name` |
| `person_full_name` | `person.name` |
| `person_title` | `person.title` |
| `person_linkedin_url` | `person.url` |
| `person_headline` | `person.headline` |
| `person_location` | `person.location_name` |
| `person_summary` | `person.summary` |
| `current_job_start_date` | `person.latest_experience.start_date` |

### Company Fields
| final_leads Column | Source |
|-------------------|--------|
| `company_name` | `company.name` |
| `company_domain` | `company.domain` |
| `company_linkedin_url` | `company.url` |
| `company_website` | `company.website` |
| `company_industry` | `company.industry` OR `company.derived_datapoints.industry[0]` |
| `company_size_bucket` | `company.size` |
| `company_employee_count` | `company.employee_count` |
| `company_city` | `company.locations[0].inferred_location.locality` |
| `company_state` | `company.locations[0].inferred_location.admin_district` |
| `company_country` | `company.country` |
| `company_revenue_range` | `company.annual_revenue` |
| `company_funding_range` | `company.total_funding_amount_range_usd` |
| `company_founded_year` | `company.founded` |
| `company_type` | `company.type` |
| `company_business_stage` | `company.derived_datapoints.business_stage` |
| `company_description` | `company.derived_datapoints.description` |

### Computed Indicators
| final_leads Column | Logic |
|-------------------|-------|
| `is_new_in_role` | `current_job_start_date` within last 6 months |
| `is_recently_funded` | Parse funding data + date (NOT AVAILABLE - no funding date) |
| `is_worked_at_customer` | Check `experience[].company_domain` against customer list |

---

## Decisions Made

1. **No email in v1:** Accept that email is not available from this Clay enrichment. Can add separate email enrichment step later.

2. **Use derived_datapoints for industry:** Clay's AI-derived industry is cleaner than raw LinkedIn industry string.

3. **Funding date unavailable:** Cannot compute "Recently Funded" indicator reliably - only have funding range, not date.

4. **Location parsing:** Use `inferred_location` fields for structured city/state extraction.

---

## Next Steps

Proceed to **Stage 2: Schema Design** with this field inventory.

