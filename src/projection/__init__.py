"""
Projection module for consolidating enrichment data into final_leads.
"""

from .extractors import (
    extract_company_fields,
    extract_person_fields,
    extract_all,
    compute_is_new_in_role,
    compute_is_worked_at_customer,
)

__all__ = [
    "extract_company_fields",
    "extract_person_fields",
    "extract_all",
    "compute_is_new_in_role",
    "compute_is_worked_at_customer",
]

