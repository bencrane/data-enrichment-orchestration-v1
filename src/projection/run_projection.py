"""
Projection function to consolidate enrichment data into final_leads.

This module provides the main projection logic that:
1. Reads from normalized_people, company_enrichment_results, person_enrichment_results
2. Extracts and transforms fields
3. Computes indicators
4. Upserts into final_leads table
"""

import os
import psycopg2
from psycopg2.extras import Json
from datetime import datetime, timezone
from typing import Optional

from .extractors import extract_all


def get_connection():
    """Get database connection."""
    # Try multiple env var names
    db_url = (
        os.environ.get("DATABASE_URL") or
        os.environ.get("SUPABASE_DB_URL") or
        os.environ.get("POSTGRES_CONNECTION_STRING")
    )
    
    if not db_url:
        raise ValueError("No database URL found in environment variables")
    
    return psycopg2.connect(db_url)


def get_customer_domains(conn, client_id: str) -> list:
    """
    Fetch customer domains from client_customer_companies table.
    
    Args:
        conn: Database connection
        client_id: The client UUID to fetch customers for
        
    Returns:
        List of domain strings
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT DISTINCT domain 
            FROM client_customer_companies 
            WHERE client_id = %s AND domain IS NOT NULL
        """, (client_id,))
        return [row[0] for row in cur.fetchall()]


def run_projection(
    batch_id: Optional[str] = None,
    client_id: Optional[str] = None,
    customer_domains: Optional[list] = None,
    verbose: bool = True
) -> dict:
    """
    Run projection to populate final_leads table.
    
    Args:
        batch_id: Optional batch ID to process only that batch.
                  If None, processes all records.
        client_id: Optional client ID to auto-fetch customer domains from client_customer_companies.
        customer_domains: Optional list of customer domains for "worked at customer" indicator.
                          If client_id is provided, these are fetched automatically.
        verbose: Print progress messages.
        
    Returns:
        Dict with stats: {processed, inserted, updated, skipped, errors}
    """
    conn = get_connection()
    stats = {"processed": 0, "inserted": 0, "updated": 0, "skipped": 0, "errors": 0}
    
    # Fetch customer domains if client_id provided
    if client_id and not customer_domains:
        customer_domains = get_customer_domains(conn, client_id)
        if verbose:
            print(f"[PROJECTION] Loaded {len(customer_domains)} customer domains for client {client_id[:8]}...")
    
    try:
        with conn.cursor() as cur:
            # Build query to get all data needed for projection
            # Join normalized_people -> batch_items -> company/person enrichment results
            query = """
                SELECT 
                    np.id as person_id,
                    np.batch_item_id,
                    np.company_id,
                    cer.data as company_enrichment_data,
                    per.data as person_enrichment_data
                FROM normalized_people np
                JOIN batch_items bi ON np.batch_item_id = bi.id
                LEFT JOIN company_enrichment_results cer ON np.company_id = cer.company_id
                LEFT JOIN person_enrichment_results per ON np.id = per.person_id
            """
            
            params = []
            if batch_id:
                query += " WHERE bi.batch_id = %s"
                params.append(batch_id)
            
            cur.execute(query, params)
            rows = cur.fetchall()
            
            if verbose:
                print(f"[PROJECTION] Found {len(rows)} records to process")
            
            for row in rows:
                person_id, batch_item_id, company_id, company_data, person_data = row
                stats["processed"] += 1
                
                try:
                    # Extract all fields
                    fields = extract_all(
                        company_payload=company_data,
                        person_payload=person_data,
                        customer_domains=customer_domains or []
                    )
                    
                    # Upsert into final_leads
                    upsert_sql = """
                        INSERT INTO final_leads (
                            batch_item_id,
                            person_id,
                            company_id,
                            person_first_name,
                            person_last_name,
                            person_full_name,
                            person_title,
                            person_linkedin_url,
                            person_headline,
                            person_location,
                            person_summary,
                            current_job_start_date,
                            company_name,
                            company_domain,
                            company_linkedin_url,
                            company_website,
                            company_logo_url,
                            company_description,
                            company_industry,
                            company_industries,
                            company_subindustries,
                            company_size_bucket,
                            company_employee_count,
                            company_city,
                            company_state,
                            company_country,
                            company_revenue_range,
                            company_funding_range,
                            company_founded_year,
                            company_type,
                            company_business_stage,
                            is_new_in_role,
                            is_worked_at_customer,
                            raw_company_payload,
                            raw_person_payload,
                            created_at,
                            updated_at
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s
                        )
                        ON CONFLICT (batch_item_id) DO UPDATE SET
                            person_id = EXCLUDED.person_id,
                            company_id = EXCLUDED.company_id,
                            person_first_name = EXCLUDED.person_first_name,
                            person_last_name = EXCLUDED.person_last_name,
                            person_full_name = EXCLUDED.person_full_name,
                            person_title = EXCLUDED.person_title,
                            person_linkedin_url = EXCLUDED.person_linkedin_url,
                            person_headline = EXCLUDED.person_headline,
                            person_location = EXCLUDED.person_location,
                            person_summary = EXCLUDED.person_summary,
                            current_job_start_date = EXCLUDED.current_job_start_date,
                            company_name = EXCLUDED.company_name,
                            company_domain = EXCLUDED.company_domain,
                            company_linkedin_url = EXCLUDED.company_linkedin_url,
                            company_website = EXCLUDED.company_website,
                            company_logo_url = EXCLUDED.company_logo_url,
                            company_description = EXCLUDED.company_description,
                            company_industry = EXCLUDED.company_industry,
                            company_industries = EXCLUDED.company_industries,
                            company_subindustries = EXCLUDED.company_subindustries,
                            company_size_bucket = EXCLUDED.company_size_bucket,
                            company_employee_count = EXCLUDED.company_employee_count,
                            company_city = EXCLUDED.company_city,
                            company_state = EXCLUDED.company_state,
                            company_country = EXCLUDED.company_country,
                            company_revenue_range = EXCLUDED.company_revenue_range,
                            company_funding_range = EXCLUDED.company_funding_range,
                            company_founded_year = EXCLUDED.company_founded_year,
                            company_type = EXCLUDED.company_type,
                            company_business_stage = EXCLUDED.company_business_stage,
                            is_new_in_role = EXCLUDED.is_new_in_role,
                            is_worked_at_customer = EXCLUDED.is_worked_at_customer,
                            raw_company_payload = EXCLUDED.raw_company_payload,
                            raw_person_payload = EXCLUDED.raw_person_payload,
                            updated_at = NOW()
                    """
                    
                    now = datetime.now(timezone.utc)
                    
                    cur.execute(upsert_sql, (
                        batch_item_id,
                        person_id,
                        company_id,
                        fields.get("person_first_name"),
                        fields.get("person_last_name"),
                        fields.get("person_full_name"),
                        fields.get("person_title"),
                        fields.get("person_linkedin_url"),
                        fields.get("person_headline"),
                        fields.get("person_location"),
                        fields.get("person_summary"),
                        fields.get("current_job_start_date"),
                        fields.get("company_name"),
                        fields.get("company_domain"),
                        fields.get("company_linkedin_url"),
                        fields.get("company_website"),
                        fields.get("company_logo_url"),
                        fields.get("company_description"),
                        fields.get("company_industry"),
                        fields.get("company_industries"),
                        fields.get("company_subindustries"),
                        fields.get("company_size_bucket"),
                        fields.get("company_employee_count"),
                        fields.get("company_city"),
                        fields.get("company_state"),
                        fields.get("company_country"),
                        fields.get("company_revenue_range"),
                        fields.get("company_funding_range"),
                        fields.get("company_founded_year"),
                        fields.get("company_type"),
                        fields.get("company_business_stage"),
                        fields.get("is_new_in_role", False),
                        fields.get("is_worked_at_customer", False),
                        Json(fields.get("raw_company_payload")),
                        Json(fields.get("raw_person_payload")),
                        now,
                        now,
                    ))
                    
                    # Check if it was insert or update
                    if cur.rowcount > 0:
                        stats["inserted"] += 1
                    
                except Exception as e:
                    stats["errors"] += 1
                    if verbose:
                        print(f"[PROJECTION] Error processing batch_item {batch_item_id}: {e}")
            
            conn.commit()
            
            if verbose:
                print(f"[PROJECTION] Complete: {stats}")
    
    finally:
        conn.close()
    
    return stats


if __name__ == "__main__":
    # Run projection when executed directly
    import argparse
    
    parser = argparse.ArgumentParser(description="Run projection to populate final_leads")
    parser.add_argument("--batch-id", help="Process only this batch ID")
    parser.add_argument("--client-id", help="Client ID to load customer domains from client_customer_companies")
    parser.add_argument("--quiet", action="store_true", help="Suppress output")
    
    args = parser.parse_args()
    
    stats = run_projection(
        batch_id=args.batch_id,
        client_id=args.client_id,
        verbose=not args.quiet
    )
    
    print(f"Projection complete: {stats}")

