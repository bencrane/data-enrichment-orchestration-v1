"""
Modal Worker Functions for Data Enrichment Orchestration.

These functions correspond strictly to the enrichment_registry definitions.
Data Principle: Strict Decoupling.
- Senders NEVER call Receivers. They only update state to IN_PROGRESS.
- Receivers are standalone functions that accept data and update state to COMPLETED.
"""

import os
import time
import uuid
from datetime import datetime, timezone

import modal

# Modal App Definition
app = modal.App("data-enrichment-workers")

# Image with required dependencies
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "sqlalchemy[asyncio]",
    "asyncpg",
    "psycopg2-binary",
    "requests",
    "fastapi",  # Required for web endpoints
)


# =============================================================================
# Database Connection & Helpers
# =============================================================================

def get_sync_connection():
    """Get a synchronous database connection using psycopg2."""
    import psycopg2

    conn_string = os.environ.get("POSTGRES_CONNECTION_STRING")
    if not conn_string:
        raise ValueError("POSTGRES_CONNECTION_STRING not set")

    return psycopg2.connect(conn_string)


def _update_state(item_id: str, step_name: str, status: str, meta: dict | None = None):
    """
    Update workflow_states for a given item and step.

    Args:
        item_id: UUID of the batch_item
        step_name: The workflow step name (slug)
        status: New status (PENDING, QUEUED, IN_PROGRESS, COMPLETED, FAILED)
        meta: Optional metadata dict
    """
    import json

    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            # Get batch_id from the batch_item
            cur.execute(
                "SELECT batch_id FROM batch_items WHERE id = %s",
                (item_id,)
            )
            result = cur.fetchone()
            if not result:
                raise ValueError(f"BatchItem {item_id} not found")

            batch_id = result[0]

            # Upsert workflow_state
            cur.execute("""
                INSERT INTO workflow_states (id, batch_id, item_id, step_name, status, meta, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (batch_id, item_id, step_name)
                DO UPDATE SET status = EXCLUDED.status, meta = EXCLUDED.meta, updated_at = EXCLUDED.updated_at
            """, (
                str(uuid.uuid4()),
                str(batch_id),
                str(item_id),
                step_name,
                status,
                json.dumps(meta) if meta else None,
                datetime.now(timezone.utc),
            ))
            conn.commit()
            print(f"[STATE] item={item_id[:8]}... step={step_name} -> {status}")
    finally:
        conn.close()


def _record_result(item_id: str, workflow_slug: str, output_dict: dict):
    """
    Insert enrichment result into enrichment_results table.

    Args:
        item_id: UUID of the batch_item
        workflow_slug: The workflow slug from enrichment_registry
        output_dict: The enrichment output data (JSONB)
    """
    import json

    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO enrichment_results (id, batch_item_id, workflow_slug, data, created_at)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                str(uuid.uuid4()),
                str(item_id),
                workflow_slug,
                json.dumps(output_dict),
                datetime.now(timezone.utc),
            ))
            conn.commit()
            print(f"[RESULT] item={item_id[:8]}... workflow={workflow_slug} recorded")
    finally:
        conn.close()


def _get_client_config(item_id: str, workflow_slug: str, workstream_slug: str | None = None) -> dict | None:
    """
    Fetch client-specific configuration for a workflow.

    Traverses: batch_items -> batches -> client_workflow_configs
    Uses composite key (workflow_slug, workstream_slug) for precise matching.

    Args:
        item_id: UUID of the batch_item
        workflow_slug: The workflow slug to get config for
        workstream_slug: The workstream slug (required for composite key lookup).
                        If None, falls back to looking up from batch (legacy support).

    Returns:
        The config dict from client_workflow_configs, or None if not found.
    """
    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            if workstream_slug:
                # Precise lookup using composite key
                cur.execute("""
                    SELECT cwc.config
                    FROM batch_items bi
                    JOIN batches b ON bi.batch_id = b.id
                    JOIN client_workflow_configs cwc ON b.client_id = cwc.client_id
                    WHERE bi.id = %s
                    AND cwc.workflow_slug = %s
                    AND cwc.workstream_slug = %s
                """, (item_id, workflow_slug, workstream_slug))
            else:
                # Legacy fallback: lookup workstream_slug from batch
                cur.execute("""
                    SELECT cwc.config
                    FROM batch_items bi
                    JOIN batches b ON bi.batch_id = b.id
                    JOIN client_workflow_configs cwc ON b.client_id = cwc.client_id
                    WHERE bi.id = %s
                    AND cwc.workflow_slug = %s
                    AND cwc.workstream_slug = b.workstream_slug
                """, (item_id, workflow_slug))

            result = cur.fetchone()
            if result and result[0]:
                print(f"[CONFIG] item={item_id[:8]}... workflow={workflow_slug} workstream={workstream_slug} -> config found")
                return result[0]  # JSONB returns as Python dict
            else:
                print(f"[CONFIG] item={item_id[:8]}... workflow={workflow_slug} workstream={workstream_slug} -> no config found")
                return None
    finally:
        conn.close()


def _get_batch_item_data(item_id: str) -> dict | None:
    """
    Fetch batch_item data for sending to Clay webhook.

    Args:
        item_id: UUID of the batch_item

    Returns:
        Dict with batch_item fields, or None if not found.
    """
    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    id,
                    company_name,
                    company_domain,
                    company_linkedin_url,
                    company_industry,
                    company_city,
                    company_state,
                    company_country,
                    person_first_name,
                    person_last_name,
                    person_linkedin_url,
                    person_title
                FROM batch_items
                WHERE id = %s
            """, (item_id,))

            result = cur.fetchone()
            if result:
                return {
                    "item_id": str(result[0]),
                    "company_name": result[1],
                    "company_domain": result[2],
                    "company_linkedin_url": result[3],
                    "company_industry": result[4],
                    "company_city": result[5],
                    "company_state": result[6],
                    "company_country": result[7],
                    "person_first_name": result[8],
                    "person_last_name": result[9],
                    "person_linkedin_url": result[10],
                    "person_title": result[11],
                }
            return None
    finally:
        conn.close()


def _get_batch_id(item_id: str) -> str | None:
    """
    Get the batch_id for a given item_id.

    Args:
        item_id: UUID of the batch_item

    Returns:
        The batch_id as a string, or None if not found.
    """
    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT batch_id FROM batch_items WHERE id = %s", (item_id,))
            result = cur.fetchone()
            return str(result[0]) if result else None
    finally:
        conn.close()


def _get_workstream_slug(item_id: str) -> str | None:
    """
    Get the workstream_slug for a batch_item via its batch.

    Args:
        item_id: UUID of the batch_item

    Returns:
        The workstream_slug as a string, or None if not found.
    """
    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT b.workstream_slug 
                FROM batch_items bi
                JOIN batches b ON bi.batch_id = b.id
                WHERE bi.id = %s
            """, (item_id,))
            result = cur.fetchone()
            return result[0] if result else None
    finally:
        conn.close()


def _trigger_orchestrator(batch_id: str) -> bool:
    """
    Trigger the Prefect orchestrator via the Supabase Edge Function.

    This is called by receivers after marking an item COMPLETED,
    so the orchestrator can advance items to the next step.

    Args:
        batch_id: The batch_id to include in the trigger payload

    Returns:
        True if successful, False otherwise
    """
    import requests

    edge_function_url = "https://demdntaknhsjzylhmynq.supabase.co/functions/v1/trigger-prefect-orchestrator"
    
    try:
        print(f"[ORCHESTRATOR TRIGGER] Calling Edge Function for batch={batch_id[:8]}...")
        response = requests.post(
            edge_function_url,
            json={"batch_id": batch_id},
            timeout=10
        )
        
        if response.ok:
            print(f"[ORCHESTRATOR TRIGGER] Success: {response.json()}")
            return True
        else:
            print(f"[ORCHESTRATOR TRIGGER] Failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"[ORCHESTRATOR TRIGGER] Error: {e}")
        return False


# =============================================================================
# Entity-Level Helpers (Company & Person)
# These functions support entity-level workflow tracking to prevent duplicate
# API calls when multiple batch_items map to the same company/person.
# =============================================================================

def _get_company_id_for_item(item_id: str) -> str | None:
    """
    Get the company_id for a batch_item via normalized_people.

    Args:
        item_id: UUID of the batch_item

    Returns:
        The company_id as a string, or None if not found.
    """
    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT company_id FROM normalized_people 
                WHERE batch_item_id = %s
            """, (item_id,))
            result = cur.fetchone()
            return str(result[0]) if result and result[0] else None
    finally:
        conn.close()


def _get_person_id_for_item(item_id: str) -> str | None:
    """
    Get the person_id (normalized_people.id) for a batch_item.

    Args:
        item_id: UUID of the batch_item

    Returns:
        The person_id as a string, or None if not found.
    """
    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id FROM normalized_people 
                WHERE batch_item_id = %s
            """, (item_id,))
            result = cur.fetchone()
            return str(result[0]) if result else None
    finally:
        conn.close()


def _get_company_data(company_id: str) -> dict | None:
    """
    Fetch company data from normalized_companies for sending to Clay.

    Args:
        company_id: UUID of the normalized_company

    Returns:
        Dict with company fields, or None if not found.
    """
    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    id,
                    company_name,
                    domain,
                    company_linkedin_url,
                    city,
                    state,
                    country,
                    industry
                FROM normalized_companies
                WHERE id = %s
            """, (company_id,))

            result = cur.fetchone()
            if result:
                return {
                    "company_id": str(result[0]),
                    "company_name": result[1],
                    "company_domain": result[2],
                    "company_linkedin_url": result[3],
                    "company_city": result[4],
                    "company_state": result[5],
                    "company_country": result[6],
                    "company_industry": result[7],
                }
            return None
    finally:
        conn.close()


def _get_person_data(person_id: str) -> dict | None:
    """
    Fetch person data from normalized_people for sending to Clay.

    Args:
        person_id: UUID of the normalized_person

    Returns:
        Dict with person fields, or None if not found.
    """
    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    id,
                    batch_item_id,
                    company_id,
                    first_name,
                    last_name,
                    full_name,
                    company_name,
                    domain,
                    company_linkedin_url,
                    person_linkedin_url,
                    job_title
                FROM normalized_people
                WHERE id = %s
            """, (person_id,))

            result = cur.fetchone()
            if result:
                return {
                    "person_id": str(result[0]),
                    "batch_item_id": str(result[1]),
                    "company_id": str(result[2]) if result[2] else None,
                    "person_first_name": result[3],
                    "person_last_name": result[4],
                    "full_name": result[5],
                    "company_name": result[6],
                    "company_domain": result[7],
                    "company_linkedin_url": result[8],
                    "person_linkedin_url": result[9],
                    "job_title": result[10],
                }
            return None
    finally:
        conn.close()


def _get_company_workflow_status(company_id: str, workflow_slug: str) -> str | None:
    """
    Get the status of a company workflow from company_workflow_states.

    Args:
        company_id: UUID of the normalized_company
        workflow_slug: The workflow slug (e.g., 'enrich_company_via_waterfall_in_clay')

    Returns:
        The status string (PENDING, IN_PROGRESS, COMPLETED, FAILED), or None if not found.
    """
    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT status FROM company_workflow_states 
                WHERE company_id = %s AND workflow_slug = %s
            """, (company_id, workflow_slug))
            result = cur.fetchone()
            return result[0] if result else None
    finally:
        conn.close()


def _set_company_workflow_status(company_id: str, workflow_slug: str, status: str, meta: dict | None = None):
    """
    Create or update the status of a company workflow in company_workflow_states.

    Args:
        company_id: UUID of the normalized_company
        workflow_slug: The workflow slug
        status: New status (PENDING, IN_PROGRESS, COMPLETED, FAILED)
        meta: Optional metadata dict
    """
    import json

    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO company_workflow_states (id, company_id, workflow_slug, status, meta, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_id, workflow_slug)
                DO UPDATE SET status = EXCLUDED.status, meta = EXCLUDED.meta, updated_at = EXCLUDED.updated_at
            """, (
                str(uuid.uuid4()),
                company_id,
                workflow_slug,
                status,
                json.dumps(meta) if meta else None,
                datetime.now(timezone.utc),
                datetime.now(timezone.utc),
            ))
            conn.commit()
            print(f"[COMPANY STATE] company={company_id[:8]}... workflow={workflow_slug} -> {status}")
    finally:
        conn.close()


def _record_company_result(company_id: str, workflow_slug: str, data: dict):
    """
    Record enrichment result for a company in company_enrichment_results.

    Args:
        company_id: UUID of the normalized_company
        workflow_slug: The workflow slug
        data: The enrichment result data (JSONB)
    """
    import json

    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO company_enrichment_results (id, company_id, workflow_slug, data, created_at)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                str(uuid.uuid4()),
                company_id,
                workflow_slug,
                json.dumps(data),
                datetime.now(timezone.utc),
            ))
            conn.commit()
            print(f"[COMPANY RESULT] company={company_id[:8]}... workflow={workflow_slug} recorded")
    finally:
        conn.close()


def _get_person_workflow_status(person_id: str, workflow_slug: str) -> str | None:
    """
    Get the status of a person workflow from person_workflow_states.

    Args:
        person_id: UUID of the normalized_person
        workflow_slug: The workflow slug (e.g., 'enrich_person_via_waterfall_in_clay')

    Returns:
        The status string (PENDING, IN_PROGRESS, COMPLETED, FAILED), or None if not found.
    """
    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT status FROM person_workflow_states 
                WHERE person_id = %s AND workflow_slug = %s
            """, (person_id, workflow_slug))
            result = cur.fetchone()
            return result[0] if result else None
    finally:
        conn.close()


def _set_person_workflow_status(person_id: str, workflow_slug: str, status: str, meta: dict | None = None):
    """
    Create or update the status of a person workflow in person_workflow_states.

    Args:
        person_id: UUID of the normalized_person
        workflow_slug: The workflow slug
        status: New status (PENDING, IN_PROGRESS, COMPLETED, FAILED)
        meta: Optional metadata dict
    """
    import json

    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO person_workflow_states (id, person_id, workflow_slug, status, meta, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (person_id, workflow_slug)
                DO UPDATE SET status = EXCLUDED.status, meta = EXCLUDED.meta, updated_at = EXCLUDED.updated_at
            """, (
                str(uuid.uuid4()),
                person_id,
                workflow_slug,
                status,
                json.dumps(meta) if meta else None,
                datetime.now(timezone.utc),
                datetime.now(timezone.utc),
            ))
            conn.commit()
            print(f"[PERSON STATE] person={person_id[:8]}... workflow={workflow_slug} -> {status}")
    finally:
        conn.close()


def _record_person_result(person_id: str, workflow_slug: str, data: dict):
    """
    Record enrichment result for a person in person_enrichment_results.

    Args:
        person_id: UUID of the normalized_person
        workflow_slug: The workflow slug
        data: The enrichment result data (JSONB)
    """
    import json

    conn = get_sync_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO person_enrichment_results (id, person_id, workflow_slug, data, created_at)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                str(uuid.uuid4()),
                person_id,
                workflow_slug,
                json.dumps(data),
                datetime.now(timezone.utc),
            ))
            conn.commit()
            print(f"[PERSON RESULT] person={person_id[:8]}... workflow={workflow_slug} recorded")
    finally:
        conn.close()


# =============================================================================
# SYNC WORKFLOW: Split Raw Apollo Scrape Data into Two Tables
# =============================================================================

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
)
def run_split_raw_apollo_scrape_data(item_id: str, workstream_slug: str | None = None):
    """
    Sync workflow: Splits enriched data into normalized_companies and normalized_people tables.

    Args:
        item_id: UUID of the batch_item
        workstream_slug: The workstream slug (not used in this function but accepted for API consistency)

    This function:
    1. Reads the enrichment result from normalize_all_core_values
    2. Upserts company data into normalized_companies (dedup by domain)
    3. Inserts person data into normalized_people with FK to company
    4. Sets state to COMPLETED
    """
    # Must match the registry slug exactly
    step_name = "split_raw_apollo_scrape_data_into_two_tables"
    print(f"[SYNC] run_split_raw_apollo_scrape_data called for item={item_id[:8]}...")

    conn = get_sync_connection()
    company_id = None
    person_id = None
    domain = None
    
    try:
        with conn.cursor() as cur:
            # 1. Fetch the enrichment result from normalize_all_core_values
            cur.execute("""
                SELECT data
                FROM enrichment_results
                WHERE batch_item_id = %s
                AND workflow_slug = 'normalize_all_core_values'
                ORDER BY created_at DESC
                LIMIT 1
            """, (item_id,))
            
            result = cur.fetchone()
            if not result:
                print(f"[SYNC] ERROR: No enrichment result found for item {item_id[:8]}...")
                _update_state(item_id, step_name, "FAILED", meta={
                    "error": "No enrichment result from normalize_all_core_values",
                    "failed_at": datetime.now(timezone.utc).isoformat(),
                })
                return {"success": False, "item_id": item_id, "error": "No enrichment result found"}
            
            data = result[0]
            print(f"[SYNC] Found enrichment data for item {item_id[:8]}...")

            # 2. Upsert company into normalized_companies (dedup by domain)
            domain = data.get("company_domain")
            if not domain:
                print(f"[SYNC] WARNING: No domain found, skipping company insert")
            else:
                # Clean domain (remove protocol if present)
                domain = domain.replace("http://", "").replace("https://", "").rstrip("/")
                
                cur.execute("""
                    INSERT INTO normalized_companies (company_name, domain, company_linkedin_url, city, state, country, industry)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (domain) DO NOTHING
                    RETURNING id
                """, (
                    data.get("company_name"),
                    domain,
                    data.get("company_linkedin_url"),
                    data.get("company_city"),
                    data.get("company_state"),
                    data.get("company_country"),
                    data.get("company_industry"),
                ))
                
                insert_result = cur.fetchone()
                if insert_result:
                    company_id = insert_result[0]
                    print(f"[SYNC] Inserted new company: {domain} -> {company_id}")
                else:
                    # Company already exists, fetch the existing ID
                    cur.execute("SELECT id FROM normalized_companies WHERE domain = %s", (domain,))
                    existing = cur.fetchone()
                    company_id = existing[0] if existing else None
                    print(f"[SYNC] Company already exists: {domain} -> {company_id}")

            # 3. Insert person into normalized_people
            cur.execute("""
                INSERT INTO normalized_people (
                    batch_item_id, company_id, first_name, last_name, full_name,
                    company_name, domain, company_linkedin_url, person_linkedin_url, job_title
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                item_id,
                company_id,
                data.get("person_first_name"),
                data.get("person_last_name"),
                data.get("full_name"),  # From Clay
                data.get("company_name"),
                domain,
                data.get("company_linkedin_url"),
                data.get("person_linkedin_url"),
                data.get("normalized_person_title") or data.get("job_title"),
            ))
            
            person_result = cur.fetchone()
            person_id = person_result[0] if person_result else None
            print(f"[SYNC] Inserted person: {data.get('person_first_name')} {data.get('person_last_name')} -> {person_id}")

            conn.commit()

    finally:
        conn.close()

    # Record result
    _record_result(item_id, step_name, {
        "action": "split_to_normalized_tables",
        "status": "success",
        "company_id": str(company_id) if company_id else None,
        "person_id": str(person_id) if person_id else None,
        "domain": domain,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    })

    # Set state to COMPLETED
    _update_state(item_id, step_name, "COMPLETED", meta={
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "company_id": str(company_id) if company_id else None,
        "person_id": str(person_id) if person_id else None,
    })

    # Trigger orchestrator to advance to next step
    batch_id = _get_batch_id(item_id)
    if batch_id:
        _trigger_orchestrator(batch_id)
    else:
        print(f"[SYNC] WARNING: Could not find batch_id for item {item_id[:8]}...")

    return {"success": True, "item_id": item_id, "company_id": str(company_id) if company_id else None, "person_id": str(person_id) if person_id else None}


# =============================================================================
# ASYNC WORKFLOW 1: Normalize Company Name
# =============================================================================

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
    concurrency_limit=5,
)
def start_normalize_company_name(item_id: str, workstream_slug: str | None = None):
    """
    Async Sender: Initiates company name normalization via Clay.

    Args:
        item_id: UUID of the batch_item
        workstream_slug: The workstream slug for config lookup. If None, looked up from batch.

    This function:
    1. Fetches client-specific config (webhook_url) using composite key
    2. Fetches batch_item data for the payload
    3. POSTs to Clay webhook with company data
    4. Sets state to IN_PROGRESS
    """
    import requests

    step_name = "normalize_company_name"
    
    # Get workstream_slug if not provided
    if not workstream_slug:
        workstream_slug = _get_workstream_slug(item_id)
    
    print(f"[ASYNC SENDER] start_normalize_company_name called for item={item_id[:8]}... workstream={workstream_slug}")

    # Fetch client-specific configuration using composite key
    config = _get_client_config(item_id, step_name, workstream_slug)
    webhook_url = config.get("webhook_url") if config else None

    if not webhook_url:
        print(f"[ASYNC SENDER] ERROR: No webhook_url configured for this client/workflow/workstream")
        _update_state(item_id, step_name, "FAILED", meta={
            "error": "No webhook_url configured",
            "workstream_slug": workstream_slug,
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": "No webhook_url configured"}

    print(f"[ASYNC SENDER] Using webhook_url: {webhook_url}")

    # Fetch batch_item data for the payload
    item_data = _get_batch_item_data(item_id)
    if not item_data:
        print(f"[ASYNC SENDER] ERROR: BatchItem {item_id} not found")
        _update_state(item_id, step_name, "FAILED", meta={
            "error": "BatchItem not found",
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": "BatchItem not found"}

    # Send all batch_item fields to Clay
    payload = item_data

    print(f"[ASYNC SENDER] Sending to Clay (normalize_company_name): {payload}")

    # POST to Clay webhook
    try:
        response = requests.post(webhook_url, json=payload, timeout=30)
        response.raise_for_status()
        print(f"[ASYNC SENDER] Clay webhook response: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"[ASYNC SENDER] ERROR: Clay webhook failed: {e}")
        _update_state(item_id, step_name, "FAILED", meta={
            "error": str(e),
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": str(e)}

    # Set state to IN_PROGRESS
    _update_state(item_id, step_name, "IN_PROGRESS", meta={
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "service": "clay",
        "webhook_url": webhook_url,
        "payload": payload,
    })

    return {"success": True, "item_id": item_id, "status": "IN_PROGRESS", "webhook_url": webhook_url}


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
)
def receive_normalized_company_name(item_id: str, payload: dict):
    """
    Async Receiver: Receives normalized company name data.

    This function:
    1. Accepts the payload from external service
    2. Records the enrichment result
    3. Sets state to COMPLETED
    """
    step_name = "normalize_company_name"
    print(f"[ASYNC RECEIVER] receive_normalized_company_name called for item={item_id[:8]}...")

    # Record the result
    _record_result(item_id, step_name, {
        "action": "normalize_company_name",
        "status": "success",
        "received_at": datetime.now(timezone.utc).isoformat(),
        **payload,
    })

    # Set state to COMPLETED
    _update_state(item_id, step_name, "COMPLETED", meta={
        "completed_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"success": True, "item_id": item_id, "status": "COMPLETED"}


# =============================================================================
# ASYNC WORKFLOW 2: Person Enrichment via Clay
# =============================================================================

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
)
def start_person_enrichment_via_clay(item_id: str):
    """
    Async Sender: Initiates person enrichment via Clay.

    This function:
    1. Logs that we're sending to Clay
    2. Sets state to IN_PROGRESS
    3. DOES NOT call the receiver (strict decoupling)

    In production, this would send data to Clay's API
    which would later call receive_person_enrichment_via_clay via webhook.
    """
    step_name = "person_enrichment_via_clay"
    print(f"[ASYNC SENDER] start_person_enrichment_via_clay called for item={item_id[:8]}...")
    print(f"[ASYNC SENDER] Sending to Clay...")

    # Set state to IN_PROGRESS
    _update_state(item_id, step_name, "IN_PROGRESS", meta={
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "service": "clay",
    })

    # DO NOT CALL RECEIVER - strict decoupling
    # Clay will call the receiver via webhook when enrichment is complete

    return {"success": True, "item_id": item_id, "status": "IN_PROGRESS"}


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
)
def receive_person_enrichment_via_clay(item_id: str, payload: dict):
    """
    Async Receiver: Receives enriched person data from Clay.

    This function:
    1. Accepts the payload from Clay webhook
    2. Records the enrichment result
    3. Sets state to COMPLETED
    """
    step_name = "person_enrichment_via_clay"
    print(f"[ASYNC RECEIVER] receive_person_enrichment_via_clay called for item={item_id[:8]}...")

    # Record the result
    _record_result(item_id, step_name, {
        "action": "person_enrichment",
        "source": "clay",
        "status": "success",
        "received_at": datetime.now(timezone.utc).isoformat(),
        **payload,
    })

    # Set state to COMPLETED
    _update_state(item_id, step_name, "COMPLETED", meta={
        "completed_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"success": True, "item_id": item_id, "status": "COMPLETED"}


# =============================================================================
# ASYNC WORKFLOW 3: Normalize Company Domain
# =============================================================================

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
    concurrency_limit=5,
)
def start_normalize_company_domain(item_id: str, workstream_slug: str | None = None):
    """
    Async Sender: Initiates company domain normalization via Clay.

    Args:
        item_id: UUID of the batch_item
        workstream_slug: The workstream slug for config lookup. If None, looked up from batch.

    This function:
    1. Fetches client-specific config (webhook_url) using composite key
    2. Fetches batch_item data for the payload
    3. POSTs to Clay webhook with domain data
    4. Sets state to IN_PROGRESS
    """
    import requests

    step_name = "normalize_company_domain"
    
    # Get workstream_slug if not provided
    if not workstream_slug:
        workstream_slug = _get_workstream_slug(item_id)
    
    print(f"[ASYNC SENDER] start_normalize_company_domain called for item={item_id[:8]}... workstream={workstream_slug}")

    # Fetch client-specific configuration using composite key
    config = _get_client_config(item_id, step_name, workstream_slug)
    webhook_url = config.get("webhook_url") if config else None

    if not webhook_url:
        print(f"[ASYNC SENDER] ERROR: No webhook_url configured for this client/workflow/workstream")
        _update_state(item_id, step_name, "FAILED", meta={
            "error": "No webhook_url configured",
            "workstream_slug": workstream_slug,
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": "No webhook_url configured"}

    print(f"[ASYNC SENDER] Using webhook_url: {webhook_url}")

    # Fetch batch_item data for the payload
    item_data = _get_batch_item_data(item_id)
    if not item_data:
        print(f"[ASYNC SENDER] ERROR: BatchItem {item_id} not found")
        _update_state(item_id, step_name, "FAILED", meta={
            "error": "BatchItem not found",
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": "BatchItem not found"}

    # Send all batch_item fields to Clay
    payload = item_data

    print(f"[ASYNC SENDER] Sending to Clay (normalize_company_domain): {payload}")

    # POST to Clay webhook
    try:
        response = requests.post(webhook_url, json=payload, timeout=30)
        response.raise_for_status()
        print(f"[ASYNC SENDER] Clay webhook response: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"[ASYNC SENDER] ERROR: Clay webhook failed: {e}")
        _update_state(item_id, step_name, "FAILED", meta={
            "error": str(e),
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": str(e)}

    # Set state to IN_PROGRESS
    _update_state(item_id, step_name, "IN_PROGRESS", meta={
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "service": "clay",
        "webhook_url": webhook_url,
        "payload": payload,
    })

    return {"success": True, "item_id": item_id, "status": "IN_PROGRESS", "webhook_url": webhook_url}


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
)
def receive_normalized_company_domain(item_id: str, payload: dict):
    """
    Async Receiver: Receives normalized company domain data.

    This function:
    1. Accepts the payload from external service
    2. Records the enrichment result
    3. Sets state to COMPLETED
    """
    step_name = "normalize_company_domain"
    print(f"[ASYNC RECEIVER] receive_normalized_company_domain called for item={item_id[:8]}...")

    # Record the result
    _record_result(item_id, step_name, {
        "action": "normalize_company_domain",
        "status": "success",
        "received_at": datetime.now(timezone.utc).isoformat(),
        **payload,
    })

    # Set state to COMPLETED
    _update_state(item_id, step_name, "COMPLETED", meta={
        "completed_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"success": True, "item_id": item_id, "status": "COMPLETED"}


# =============================================================================
# ASYNC WORKFLOW 4: Enrich Company via Waterfall in Clay
# =============================================================================

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
    concurrency_limit=5,
)
def start_enrich_company_via_waterfall_in_clay(item_id: str, workstream_slug: str | None = None):
    """
    Async Sender: Initiates company enrichment via Clay waterfall.

    Uses ENTITY-LEVEL TRACKING to prevent duplicate Clay calls:
    - Checks company_workflow_states before sending
    - If company already enriched/in-progress, marks batch_item as COMPLETED (skipped)
    - Only sends to Clay if this is the first item for this company

    Args:
        item_id: UUID of the batch_item
        workstream_slug: The workstream slug for config lookup. If None, looked up from batch.

    This function:
    1. Looks up company_id via normalized_people
    2. Checks company_workflow_states for existing status
    3. If COMPLETED/IN_PROGRESS: skip (mark batch_item COMPLETED)
    4. If PENDING: set company to IN_PROGRESS, send to Clay
    5. Updates batch_item workflow_states appropriately
    """
    import requests

    step_name = "enrich_company_via_waterfall_in_clay"
    
    # Get workstream_slug if not provided
    if not workstream_slug:
        workstream_slug = _get_workstream_slug(item_id)
    
    print(f"[ASYNC SENDER] start_enrich_company_via_waterfall_in_clay called for item={item_id[:8]}... workstream={workstream_slug}")

    # Step 1: Look up company_id via normalized_people
    company_id = _get_company_id_for_item(item_id)
    if not company_id:
        print(f"[ASYNC SENDER] ERROR: No company_id found for item {item_id[:8]}... (has split step run?)")
        _update_state(item_id, step_name, "FAILED", meta={
            "error": "No company_id found - split step may not have run",
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": "No company_id found"}

    print(f"[ASYNC SENDER] Found company_id={company_id[:8]}... for item={item_id[:8]}...")

    # Step 2: Check company_workflow_states for existing status
    company_status = _get_company_workflow_status(company_id, step_name)
    print(f"[ASYNC SENDER] Company workflow status: {company_status}")

    # Step 3: Handle COMPLETED - company already enriched
    if company_status == "COMPLETED":
        print(f"[ASYNC SENDER] Company already enriched - marking batch_item as COMPLETED (skipped)")
        _update_state(item_id, step_name, "COMPLETED", meta={
            "skipped": "company_already_enriched",
            "company_id": company_id,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": True, "item_id": item_id, "skipped": True, "reason": "company_already_enriched"}

    # Step 3b: Handle IN_PROGRESS - another item is enriching this company
    if company_status == "IN_PROGRESS":
        print(f"[ASYNC SENDER] Company enrichment in progress - marking batch_item as COMPLETED (skipped)")
        _update_state(item_id, step_name, "COMPLETED", meta={
            "skipped": "company_enrichment_in_progress",
            "company_id": company_id,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": True, "item_id": item_id, "skipped": True, "reason": "company_enrichment_in_progress"}

    # Step 4: PENDING or not exists - this is the first item for this company
    # Set company workflow to IN_PROGRESS
    _set_company_workflow_status(company_id, step_name, "IN_PROGRESS", meta={
        "triggered_by_item_id": item_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
    })

    # Fetch client-specific configuration using composite key
    config = _get_client_config(item_id, step_name, workstream_slug)
    webhook_url = config.get("webhook_url") if config else None

    if not webhook_url:
        print(f"[ASYNC SENDER] ERROR: No webhook_url configured for this client/workflow/workstream")
        _set_company_workflow_status(company_id, step_name, "FAILED", meta={
            "error": "No webhook_url configured",
            "workstream_slug": workstream_slug,
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        _update_state(item_id, step_name, "FAILED", meta={
            "error": "No webhook_url configured",
            "company_id": company_id,
            "workstream_slug": workstream_slug,
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": "No webhook_url configured"}

    print(f"[ASYNC SENDER] Using webhook_url: {webhook_url}")

    # Fetch company data from normalized_companies (NOT batch_items)
    company_data = _get_company_data(company_id)
    if not company_data:
        print(f"[ASYNC SENDER] ERROR: Company {company_id[:8]}... not found in normalized_companies")
        _set_company_workflow_status(company_id, step_name, "FAILED", meta={
            "error": "Company not found in normalized_companies",
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        _update_state(item_id, step_name, "FAILED", meta={
            "error": "Company not found",
            "company_id": company_id,
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": "Company not found"}

    # Build payload with company data + item_id for callback routing
    payload = {
        "item_id": item_id,  # For callback routing
        "company_id": company_id,
        "company_name": company_data["company_name"],
        "company_domain": company_data["company_domain"],
        "company_linkedin_url": company_data["company_linkedin_url"],
        "company_industry": company_data["company_industry"],
        "company_city": company_data["company_city"],
        "company_state": company_data["company_state"],
        "company_country": company_data["company_country"],
    }

    print(f"[ASYNC SENDER] Sending to Clay Waterfall (Company): {payload}")

    # POST to Clay webhook
    try:
        response = requests.post(webhook_url, json=payload, timeout=30)
        response.raise_for_status()
        print(f"[ASYNC SENDER] Clay webhook response: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"[ASYNC SENDER] ERROR: Clay webhook failed: {e}")
        _set_company_workflow_status(company_id, step_name, "FAILED", meta={
            "error": str(e),
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        _update_state(item_id, step_name, "FAILED", meta={
            "error": str(e),
            "company_id": company_id,
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": str(e)}

    # Set batch_item state to IN_PROGRESS
    _update_state(item_id, step_name, "IN_PROGRESS", meta={
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "service": "clay_waterfall",
        "entity": "company",
        "company_id": company_id,
        "webhook_url": webhook_url,
    })

    return {"success": True, "item_id": item_id, "company_id": company_id, "status": "IN_PROGRESS", "webhook_url": webhook_url}


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
)
@modal.fastapi_endpoint(method="POST")
def receive_enrich_company_via_waterfall_in_clay(request: dict):
    """
    Async Receiver: Receives enriched company data from Clay waterfall via HTTP POST.

    Uses ENTITY-LEVEL TRACKING:
    - Records result in company_enrichment_results (not just enrichment_results)
    - Updates company_workflow_states to COMPLETED
    - Updates batch_item workflow_states to COMPLETED

    This is an HTTP endpoint that Clay calls when enrichment is complete.
    
    Expected request body:
    {
        "item_id": "uuid-string",
        "company_id": "uuid-string",  (optional, will be looked up if missing)
        ... other enriched company fields from Clay ...
    }

    This function:
    1. Extracts item_id and company_id from the request
    2. Records the enrichment result in company_enrichment_results
    3. Sets company_workflow_states to COMPLETED
    4. Sets batch_item workflow_states to COMPLETED
    5. Triggers orchestrator to advance to next step
    """
    step_name = "enrich_company_via_waterfall_in_clay"
    
    # Extract item_id from request
    item_id = request.get("item_id")
    if not item_id:
        print(f"[ASYNC RECEIVER] ERROR: No item_id in request")
        return {"success": False, "error": "Missing item_id in request"}
    
    print(f"[ASYNC RECEIVER] receive_enrich_company_via_waterfall_in_clay called for item={item_id[:8]}...")

    # Get company_id (from request or lookup)
    company_id = request.get("company_id")
    if not company_id:
        company_id = _get_company_id_for_item(item_id)
    
    if not company_id:
        print(f"[ASYNC RECEIVER] ERROR: Could not find company_id for item {item_id[:8]}...")
        return {"success": False, "error": "Could not find company_id"}

    print(f"[ASYNC RECEIVER] company_id={company_id[:8]}...")

    # The rest of the request is the payload (excluding item_id and company_id)
    payload = {k: v for k, v in request.items() if k not in ("item_id", "company_id")}

    # Record the result in company_enrichment_results (entity-level)
    _record_company_result(company_id, step_name, {
        "action": "enrich_company",
        "source": "clay_waterfall",
        "status": "success",
        "received_at": datetime.now(timezone.utc).isoformat(),
        "triggered_by_item_id": item_id,
        **payload,
    })

    # Also record in enrichment_results for backward compatibility
    _record_result(item_id, step_name, {
        "action": "enrich_company",
        "source": "clay_waterfall",
        "status": "success",
        "company_id": company_id,
        "received_at": datetime.now(timezone.utc).isoformat(),
        **payload,
    })

    # Set company_workflow_states to COMPLETED (entity-level)
    _set_company_workflow_status(company_id, step_name, "COMPLETED", meta={
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "triggered_by_item_id": item_id,
    })

    # Set batch_item workflow_states to COMPLETED
    _update_state(item_id, step_name, "COMPLETED", meta={
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "company_id": company_id,
    })

    # Trigger orchestrator to advance to next step
    batch_id = _get_batch_id(item_id)
    if batch_id:
        _trigger_orchestrator(batch_id)
    else:
        print(f"[ASYNC RECEIVER] WARNING: Could not find batch_id for item {item_id[:8]}...")

    return {"success": True, "item_id": item_id, "company_id": company_id, "status": "COMPLETED"}


# =============================================================================
# ASYNC WORKFLOW 5: Enrich Person via Waterfall in Clay
# =============================================================================

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
    concurrency_limit=5,
)
def start_enrich_person_via_waterfall_in_clay(item_id: str, workstream_slug: str | None = None):
    """
    Async Sender: Initiates person enrichment via Clay waterfall.

    Uses ENTITY-LEVEL TRACKING to prevent duplicate Clay calls:
    - Checks person_workflow_states before sending
    - If person already enriched/in-progress, marks batch_item as COMPLETED (skipped)
    - Only sends to Clay if this is the first request for this person

    Args:
        item_id: UUID of the batch_item
        workstream_slug: The workstream slug for config lookup. If None, looked up from batch.

    This function:
    1. Looks up person_id via normalized_people
    2. Checks person_workflow_states for existing status
    3. If COMPLETED/IN_PROGRESS: skip (mark batch_item COMPLETED)
    4. If PENDING: set person to IN_PROGRESS, send to Clay
    5. Updates batch_item workflow_states appropriately
    """
    import requests

    step_name = "enrich_person_via_waterfall_in_clay"
    
    # Get workstream_slug if not provided
    if not workstream_slug:
        workstream_slug = _get_workstream_slug(item_id)
    
    print(f"[ASYNC SENDER] start_enrich_person_via_waterfall_in_clay called for item={item_id[:8]}... workstream={workstream_slug}")

    # Step 1: Look up person_id via normalized_people
    person_id = _get_person_id_for_item(item_id)
    if not person_id:
        print(f"[ASYNC SENDER] ERROR: No person_id found for item {item_id[:8]}... (has split step run?)")
        _update_state(item_id, step_name, "FAILED", meta={
            "error": "No person_id found - split step may not have run",
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": "No person_id found"}

    print(f"[ASYNC SENDER] Found person_id={person_id[:8]}... for item={item_id[:8]}...")

    # Step 2: Check person_workflow_states for existing status
    person_status = _get_person_workflow_status(person_id, step_name)
    print(f"[ASYNC SENDER] Person workflow status: {person_status}")

    # Step 3: Handle COMPLETED - person already enriched
    if person_status == "COMPLETED":
        print(f"[ASYNC SENDER] Person already enriched - marking batch_item as COMPLETED (skipped)")
        _update_state(item_id, step_name, "COMPLETED", meta={
            "skipped": "person_already_enriched",
            "person_id": person_id,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": True, "item_id": item_id, "skipped": True, "reason": "person_already_enriched"}

    # Step 3b: Handle IN_PROGRESS - another request is enriching this person
    if person_status == "IN_PROGRESS":
        print(f"[ASYNC SENDER] Person enrichment in progress - marking batch_item as COMPLETED (skipped)")
        _update_state(item_id, step_name, "COMPLETED", meta={
            "skipped": "person_enrichment_in_progress",
            "person_id": person_id,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": True, "item_id": item_id, "skipped": True, "reason": "person_enrichment_in_progress"}

    # Step 4: PENDING or not exists - this is the first request for this person
    # Set person workflow to IN_PROGRESS
    _set_person_workflow_status(person_id, step_name, "IN_PROGRESS", meta={
        "triggered_by_item_id": item_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
    })

    # Fetch client-specific configuration using composite key
    config = _get_client_config(item_id, step_name, workstream_slug)
    webhook_url = config.get("webhook_url") if config else None

    if not webhook_url:
        print(f"[ASYNC SENDER] ERROR: No webhook_url configured for this client/workflow/workstream")
        _set_person_workflow_status(person_id, step_name, "FAILED", meta={
            "error": "No webhook_url configured",
            "workstream_slug": workstream_slug,
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        _update_state(item_id, step_name, "FAILED", meta={
            "error": "No webhook_url configured",
            "person_id": person_id,
            "workstream_slug": workstream_slug,
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": "No webhook_url configured"}

    print(f"[ASYNC SENDER] Using webhook_url: {webhook_url}")

    # Fetch person data from normalized_people (NOT batch_items)
    person_data = _get_person_data(person_id)
    if not person_data:
        print(f"[ASYNC SENDER] ERROR: Person {person_id[:8]}... not found in normalized_people")
        _set_person_workflow_status(person_id, step_name, "FAILED", meta={
            "error": "Person not found in normalized_people",
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        _update_state(item_id, step_name, "FAILED", meta={
            "error": "Person not found",
            "person_id": person_id,
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": "Person not found"}

    # Build payload with person data + item_id for callback routing
    payload = {
        "item_id": item_id,  # For callback routing
        "person_id": person_id,
        "company_id": person_data["company_id"],  # For callback context
        "person_first_name": person_data["person_first_name"],
        "person_last_name": person_data["person_last_name"],
        "full_name": person_data["full_name"],
        "person_linkedin_url": person_data["person_linkedin_url"],
        "job_title": person_data["job_title"],
        "company_name": person_data["company_name"],
        "company_domain": person_data["company_domain"],
        "company_linkedin_url": person_data["company_linkedin_url"],
    }

    print(f"[ASYNC SENDER] Sending to Clay Waterfall (Person): {payload}")

    # POST to Clay webhook
    try:
        response = requests.post(webhook_url, json=payload, timeout=30)
        response.raise_for_status()
        print(f"[ASYNC SENDER] Clay webhook response: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"[ASYNC SENDER] ERROR: Clay webhook failed: {e}")
        _set_person_workflow_status(person_id, step_name, "FAILED", meta={
            "error": str(e),
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        _update_state(item_id, step_name, "FAILED", meta={
            "error": str(e),
            "person_id": person_id,
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": str(e)}

    # Set batch_item state to IN_PROGRESS
    _update_state(item_id, step_name, "IN_PROGRESS", meta={
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "service": "clay_waterfall",
        "entity": "person",
        "person_id": person_id,
        "webhook_url": webhook_url,
    })

    return {"success": True, "item_id": item_id, "person_id": person_id, "status": "IN_PROGRESS", "webhook_url": webhook_url}


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
)
@modal.fastapi_endpoint(method="POST")
def receive_enrich_person_via_waterfall_in_clay(request: dict):
    """
    Async Receiver: Receives enriched person data from Clay waterfall via HTTP POST.

    Uses ENTITY-LEVEL TRACKING:
    - Records result in person_enrichment_results (not just enrichment_results)
    - Updates person_workflow_states to COMPLETED
    - Updates batch_item workflow_states to COMPLETED

    This is an HTTP endpoint that Clay calls when enrichment is complete.
    
    Expected request body:
    {
        "item_id": "uuid-string",
        "person_id": "uuid-string",  (optional, will be looked up if missing)
        ... other enriched person fields from Clay ...
    }

    This function:
    1. Extracts item_id and person_id from the request
    2. Records the enrichment result in person_enrichment_results
    3. Sets person_workflow_states to COMPLETED
    4. Sets batch_item workflow_states to COMPLETED
    5. Triggers orchestrator to advance to next step
    """
    step_name = "enrich_person_via_waterfall_in_clay"
    
    # Extract item_id from request
    item_id = request.get("item_id")
    if not item_id:
        print(f"[ASYNC RECEIVER] ERROR: No item_id in request")
        return {"success": False, "error": "Missing item_id in request"}
    
    print(f"[ASYNC RECEIVER] receive_enrich_person_via_waterfall_in_clay called for item={item_id[:8]}...")

    # Get person_id (from request or lookup)
    person_id = request.get("person_id")
    if not person_id:
        person_id = _get_person_id_for_item(item_id)
    
    if not person_id:
        print(f"[ASYNC RECEIVER] ERROR: Could not find person_id for item {item_id[:8]}...")
        return {"success": False, "error": "Could not find person_id"}

    print(f"[ASYNC RECEIVER] person_id={person_id[:8]}...")

    # The rest of the request is the payload (excluding item_id and person_id)
    payload = {k: v for k, v in request.items() if k not in ("item_id", "person_id")}

    # Record the result in person_enrichment_results (entity-level)
    _record_person_result(person_id, step_name, {
        "action": "enrich_person",
        "source": "clay_waterfall",
        "status": "success",
        "received_at": datetime.now(timezone.utc).isoformat(),
        "triggered_by_item_id": item_id,
        **payload,
    })

    # Also record in enrichment_results for backward compatibility
    _record_result(item_id, step_name, {
        "action": "enrich_person",
        "source": "clay_waterfall",
        "status": "success",
        "person_id": person_id,
        "received_at": datetime.now(timezone.utc).isoformat(),
        **payload,
    })

    # Set person_workflow_states to COMPLETED (entity-level)
    _set_person_workflow_status(person_id, step_name, "COMPLETED", meta={
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "triggered_by_item_id": item_id,
    })

    # Set batch_item workflow_states to COMPLETED
    _update_state(item_id, step_name, "COMPLETED", meta={
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "person_id": person_id,
    })

    # Trigger orchestrator to advance to next step
    batch_id = _get_batch_id(item_id)
    if batch_id:
        _trigger_orchestrator(batch_id)
    else:
        print(f"[ASYNC RECEIVER] WARNING: Could not find batch_id for item {item_id[:8]}...")

    return {"success": True, "item_id": item_id, "person_id": person_id, "status": "COMPLETED"}


# =============================================================================
# ASYNC WORKFLOW 6: Normalize All Core Values
# =============================================================================

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
    concurrency_limit=5,
)
def start_normalize_all_core_values(item_id: str, workstream_slug: str | None = None):
    """
    Async Sender: Initiates normalization of all core values via Clay.

    Args:
        item_id: UUID of the batch_item
        workstream_slug: The workstream slug for config lookup. If None, looked up from batch.

    This function:
    1. Fetches client-specific config (webhook_url) using composite key
    2. Fetches batch_item data for the payload
    3. POSTs to Clay webhook with all data
    4. Sets state to IN_PROGRESS
    """
    import requests

    step_name = "normalize_all_core_values"
    
    # Get workstream_slug if not provided
    if not workstream_slug:
        workstream_slug = _get_workstream_slug(item_id)
    
    print(f"[ASYNC SENDER] start_normalize_all_core_values called for item={item_id[:8]}... workstream={workstream_slug}")

    # Fetch client-specific configuration using composite key
    config = _get_client_config(item_id, step_name, workstream_slug)
    webhook_url = config.get("webhook_url") if config else None

    if not webhook_url:
        print(f"[ASYNC SENDER] ERROR: No webhook_url configured for this client/workflow/workstream")
        _update_state(item_id, step_name, "FAILED", meta={
            "error": "No webhook_url configured",
            "workstream_slug": workstream_slug,
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": "No webhook_url configured"}

    print(f"[ASYNC SENDER] Using webhook_url: {webhook_url}")

    # Fetch batch_item data for the payload
    item_data = _get_batch_item_data(item_id)
    if not item_data:
        print(f"[ASYNC SENDER] ERROR: BatchItem {item_id} not found")
        _update_state(item_id, step_name, "FAILED", meta={
            "error": "BatchItem not found",
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": "BatchItem not found"}

    # Send all batch_item fields to Clay
    payload = item_data

    print(f"[ASYNC SENDER] Sending to Clay (normalize_all_core_values): {payload}")

    # POST to Clay webhook
    try:
        response = requests.post(webhook_url, json=payload, timeout=30)
        response.raise_for_status()
        print(f"[ASYNC SENDER] Clay webhook response: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"[ASYNC SENDER] ERROR: Clay webhook failed: {e}")
        _update_state(item_id, step_name, "FAILED", meta={
            "error": str(e),
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": str(e)}

    # Set state to IN_PROGRESS
    _update_state(item_id, step_name, "IN_PROGRESS", meta={
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "service": "clay",
        "webhook_url": webhook_url,
        "payload": payload,
    })

    return {"success": True, "item_id": item_id, "status": "IN_PROGRESS", "webhook_url": webhook_url}


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
)
@modal.fastapi_endpoint(method="POST")
def receive_normalize_all_core_values(request: dict):
    """
    Async Receiver: Receives normalized core values data via HTTP POST.

    This is an HTTP endpoint that Clay calls when enrichment is complete.
    
    Expected request body:
    {
        "item_id": "uuid-string",
        ... other enriched fields from Clay ...
    }

    This function:
    1. Extracts item_id from the request
    2. Records the enrichment result
    3. Sets state to COMPLETED
    4. Triggers orchestrator to advance to next step
    """
    step_name = "normalize_all_core_values"
    
    # Extract item_id from request
    item_id = request.get("item_id")
    if not item_id:
        print(f"[ASYNC RECEIVER] ERROR: No item_id in request")
        return {"success": False, "error": "Missing item_id in request"}
    
    print(f"[ASYNC RECEIVER] receive_normalize_all_core_values called for item={item_id[:8]}...")

    # The rest of the request is the payload (excluding item_id)
    payload = {k: v for k, v in request.items() if k != "item_id"}

    # Record the result
    _record_result(item_id, step_name, {
        "action": "normalize_all_core_values",
        "status": "success",
        "received_at": datetime.now(timezone.utc).isoformat(),
        **payload,
    })

    # Set state to COMPLETED
    _update_state(item_id, step_name, "COMPLETED", meta={
        "completed_at": datetime.now(timezone.utc).isoformat(),
    })

    # Trigger orchestrator to advance to next step
    batch_id = _get_batch_id(item_id)
    if batch_id:
        _trigger_orchestrator(batch_id)
    else:
        print(f"[ASYNC RECEIVER] WARNING: Could not find batch_id for item {item_id[:8]}...")

    return {"success": True, "item_id": item_id, "status": "COMPLETED"}


# =============================================================================
# Local Testing Entrypoint
# =============================================================================

@app.local_entrypoint()
def main():
    """Local testing entrypoint."""
    print("Data Enrichment Workers - Local Test")
    print("=" * 50)
    print("Available functions:")
    print("  - run_split_raw_apollo_scrape_data (SYNC - splits to normalized tables)")
    print("  - start_normalize_company_name (ASYNC SENDER)")
    print("  - receive_normalized_company_name (ASYNC RECEIVER)")
    print("  - start_normalize_company_domain (ASYNC SENDER)")
    print("  - receive_normalized_company_domain (ASYNC RECEIVER)")
    print("  - start_normalize_all_core_values (ASYNC SENDER)")
    print("  - receive_normalize_all_core_values (ASYNC RECEIVER/HTTP)")
    print("  - start_enrich_company_via_waterfall_in_clay (ASYNC SENDER)")
    print("  - receive_enrich_company_via_waterfall_in_clay (ASYNC RECEIVER)")
    print("  - start_enrich_person_via_waterfall_in_clay (ASYNC SENDER)")
    print("  - receive_enrich_person_via_waterfall_in_clay (ASYNC RECEIVER)")
    print("  - start_person_enrichment_via_clay (ASYNC SENDER)")
    print("  - receive_person_enrichment_via_clay (ASYNC RECEIVER)")
    print("=" * 50)
    print("Deploy with: modal deploy src/worker.py")
