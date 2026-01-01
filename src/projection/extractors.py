"""
Extraction functions for Clay enrichment payloads.

These functions parse raw Clay JSON payloads and extract structured fields
for the final_leads table.
"""

from datetime import datetime, date
from typing import Optional


def extract_company_fields(payload: dict) -> dict:
    """
    Extract company fields from raw_clay_company_enriched_payload.
    
    Args:
        payload: The raw Clay company enrichment payload
        
    Returns:
        Dict with extracted company fields (empty dict if no payload)
    """
    if not payload or not isinstance(payload, dict):
        return {
            "company_name": None,
            "company_domain": None,
            "company_linkedin_url": None,
            "company_website": None,
            "company_logo_url": None,
            "company_description": None,
            "company_industry": None,
            "company_industries": None,
            "company_subindustries": None,
            "company_size_bucket": None,
            "company_employee_count": None,
            "company_city": None,
            "company_state": None,
            "company_country": None,
            "company_revenue_range": None,
            "company_funding_range": None,
            "company_founded_year": None,
            "company_type": None,
            "company_business_stage": None,
        }
    
    # Get the nested payload if wrapped
    data = payload.get("raw_clay_company_enriched_payload", payload)
    
    # Extract location from locations array
    city = None
    state = None
    locations = data.get("locations", [])
    if locations and len(locations) > 0:
        inferred = locations[0].get("inferred_location") or {}
        city = inferred.get("locality") if inferred else None
        state = inferred.get("admin_district") if inferred else None
    
    # Fall back to locality string if no structured location
    if not city and data.get("locality"):
        locality = data.get("locality", "")
        parts = locality.split(", ")
        if len(parts) >= 1:
            city = parts[0]
        if len(parts) >= 2:
            state = parts[1]
    
    # Extract derived datapoints
    derived = data.get("derived_datapoints", {})
    
    # Get industries (prefer derived, fall back to raw)
    industries = derived.get("industry", [])
    if not industries and data.get("industry"):
        industries = [data.get("industry")]
    
    subindustries = derived.get("subindustry", [])
    
    # Primary industry for display
    primary_industry = industries[0] if industries else data.get("industry")
    
    return {
        "company_name": data.get("name"),
        "company_domain": data.get("domain"),
        "company_linkedin_url": data.get("url"),
        "company_website": data.get("website"),
        "company_logo_url": data.get("logo_url"),
        "company_description": derived.get("description") or data.get("description"),
        "company_industry": primary_industry,
        "company_industries": industries if industries else None,
        "company_subindustries": subindustries if subindustries else None,
        "company_size_bucket": data.get("size"),
        "company_employee_count": data.get("employee_count"),
        "company_city": city,
        "company_state": state,
        "company_country": data.get("country"),
        "company_revenue_range": data.get("annual_revenue"),
        "company_funding_range": data.get("total_funding_amount_range_usd"),
        "company_founded_year": data.get("founded"),
        "company_type": data.get("type"),
        "company_business_stage": derived.get("business_stage"),
    }


def extract_person_fields(payload: dict) -> dict:
    """
    Extract person fields from raw_clay_person_enriched_payload.
    
    Args:
        payload: The raw Clay person enrichment payload
        
    Returns:
        Dict with extracted person fields (empty values if no payload)
    """
    if not payload or not isinstance(payload, dict):
        return {
            "person_first_name": None,
            "person_last_name": None,
            "person_full_name": None,
            "person_title": None,
            "person_linkedin_url": None,
            "person_headline": None,
            "person_location": None,
            "person_summary": None,
            "current_job_start_date": None,
        }
    
    # Get the nested payload if wrapped
    data = payload.get("raw_clay_person_enriched_payload", payload)
    
    # Extract current job start date
    current_job_start_date = None
    latest_exp = data.get("latest_experience", {})
    if latest_exp:
        start_date_str = latest_exp.get("start_date")
        if start_date_str:
            current_job_start_date = parse_date(start_date_str)
    
    return {
        "person_first_name": data.get("first_name"),
        "person_last_name": data.get("last_name"),
        "person_full_name": data.get("name"),
        "person_title": data.get("title"),
        "person_linkedin_url": data.get("url"),
        "person_headline": data.get("headline"),
        "person_location": data.get("location_name"),
        "person_summary": data.get("summary"),
        "current_job_start_date": current_job_start_date,
    }


def parse_date(date_str: str) -> Optional[date]:
    """
    Parse a date string from Clay payload.
    
    Handles formats:
    - "2023-02-01" (ISO date)
    - "2023-02" (year-month)
    - "2023" (year only)
    
    Returns:
        date object or None if parsing fails
    """
    if not date_str:
        return None
    
    try:
        # Try full ISO date
        if len(date_str) >= 10:
            return datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        # Try year-month
        elif len(date_str) >= 7:
            return datetime.strptime(date_str[:7], "%Y-%m").date()
        # Try year only
        elif len(date_str) >= 4:
            return datetime.strptime(date_str[:4], "%Y").date()
    except ValueError:
        pass
    
    return None


def compute_is_new_in_role(current_job_start_date: Optional[date], months: int = 6) -> bool:
    """
    Determine if person is "new in role" based on job start date.
    
    Args:
        current_job_start_date: Date when person started current job
        months: Number of months to consider "new" (default 6)
        
    Returns:
        True if started within the specified number of months
    """
    if not current_job_start_date:
        return False
    
    today = date.today()
    
    # Calculate months difference
    months_diff = (today.year - current_job_start_date.year) * 12 + (today.month - current_job_start_date.month)
    
    return months_diff <= months


def compute_is_worked_at_customer(
    experience: list,
    customer_domains: list
) -> bool:
    """
    Determine if person has worked at a customer company.
    
    Args:
        experience: List of experience dicts from Clay payload
        customer_domains: List of customer company domains
        
    Returns:
        True if any past company domain matches customer list
    """
    if not experience or not customer_domains:
        return False
    
    # Normalize customer domains
    normalized_customers = {d.lower().strip() for d in customer_domains if d}
    
    for job in experience:
        company_domain = job.get("company_domain")
        if company_domain and company_domain.lower().strip() in normalized_customers:
            return True
    
    return False


# Convenience function to extract all fields at once
def extract_all(
    company_payload: dict,
    person_payload: dict,
    customer_domains: list = None
) -> dict:
    """
    Extract all fields from both company and person payloads.
    
    Args:
        company_payload: Raw company enrichment result data (can be None)
        person_payload: Raw person enrichment result data (can be None)
        customer_domains: Optional list of customer domains for indicator
        
    Returns:
        Combined dict with all extracted fields
    """
    company_fields = extract_company_fields(company_payload)
    person_fields = extract_person_fields(person_payload)
    
    # Compute indicators
    is_new_in_role = compute_is_new_in_role(person_fields.get("current_job_start_date"))
    
    # Get experience for customer check (handle None payloads)
    person_data = {}
    if person_payload and isinstance(person_payload, dict):
        person_data = person_payload.get("raw_clay_person_enriched_payload", person_payload) or {}
    experience = person_data.get("experience", []) if person_data else []
    is_worked_at_customer = compute_is_worked_at_customer(experience, customer_domains or [])
    
    return {
        **company_fields,
        **person_fields,
        "is_new_in_role": is_new_in_role,
        "is_worked_at_customer": is_worked_at_customer,
        "raw_company_payload": company_payload,
        "raw_person_payload": person_payload,
    }

