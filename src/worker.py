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


# =============================================================================
# SYNC WORKFLOW: Split Raw Apollo Scrape Data
# =============================================================================

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
)
def run_split_raw_apollo_scrape_data(item_id: str):
    """
    Sync workflow: Splits raw Apollo data for processing.

    This is a synchronous function that:
    1. Simulates work (sleep 1s)
    2. Records a dummy "Splitting" result
    3. Sets state to COMPLETED
    """
    step_name = "split_raw_apollo_scrape_data"
    print(f"[SYNC] run_split_raw_apollo_scrape_data called for item={item_id[:8]}...")

    # Simulate work
    time.sleep(1)

    # Record result
    _record_result(item_id, step_name, {
        "action": "split",
        "status": "success",
        "message": "Raw Apollo data split successfully",
        "processed_at": datetime.now(timezone.utc).isoformat(),
    })

    # Set state to COMPLETED
    _update_state(item_id, step_name, "COMPLETED")

    return {"success": True, "item_id": item_id}


# =============================================================================
# ASYNC WORKFLOW 1: Normalize Company Name
# =============================================================================

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
)
def start_normalize_company_name(item_id: str):
    """
    Async Sender: Initiates company name normalization.

    This function:
    1. Logs that we're sending to normalizer
    2. Sets state to IN_PROGRESS
    3. DOES NOT call the receiver (strict decoupling)

    In production, this would send a request to an external service
    that would later call receive_normalized_company_name via webhook.
    """
    step_name = "normalize_company_name"
    print(f"[ASYNC SENDER] start_normalize_company_name called for item={item_id[:8]}...")
    print(f"[ASYNC SENDER] Sending to Normalizer...")

    # Set state to IN_PROGRESS
    _update_state(item_id, step_name, "IN_PROGRESS", meta={
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "service": "company_normalizer",
    })

    # DO NOT CALL RECEIVER - strict decoupling
    # The receiver will be called via webhook/callback from external service

    return {"success": True, "item_id": item_id, "status": "IN_PROGRESS"}


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
)
def start_normalize_company_domain(item_id: str):
    """
    Async Sender: Initiates company domain normalization.

    This function:
    1. Logs that we're sending to domain normalizer
    2. Sets state to IN_PROGRESS
    3. DOES NOT call the receiver (strict decoupling)
    """
    step_name = "normalize_company_domain"
    print(f"[ASYNC SENDER] start_normalize_company_domain called for item={item_id[:8]}...")
    print(f"[ASYNC SENDER] Sending to Domain Normalizer...")

    # Set state to IN_PROGRESS
    _update_state(item_id, step_name, "IN_PROGRESS", meta={
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "service": "domain_normalizer",
    })

    return {"success": True, "item_id": item_id, "status": "IN_PROGRESS"}


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
)
def start_enrich_company_via_waterfall_in_clay(item_id: str):
    """
    Async Sender: Initiates company enrichment via Clay waterfall.

    This function:
    1. Logs that we're sending to Clay for company enrichment
    2. Sets state to IN_PROGRESS
    3. DOES NOT call the receiver (strict decoupling)
    """
    step_name = "enrich_company_via_waterfall_in_clay"
    print(f"[ASYNC SENDER] start_enrich_company_via_waterfall_in_clay called for item={item_id[:8]}...")
    print(f"[ASYNC SENDER] Sending to Clay Waterfall (Company)...")

    # Set state to IN_PROGRESS
    _update_state(item_id, step_name, "IN_PROGRESS", meta={
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "service": "clay_waterfall",
        "entity": "company",
    })

    return {"success": True, "item_id": item_id, "status": "IN_PROGRESS"}


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
)
def receive_enrich_company_via_waterfall_in_clay(item_id: str, payload: dict):
    """
    Async Receiver: Receives enriched company data from Clay waterfall.

    This function:
    1. Accepts the payload from Clay webhook
    2. Records the enrichment result
    3. Sets state to COMPLETED
    """
    step_name = "enrich_company_via_waterfall_in_clay"
    print(f"[ASYNC RECEIVER] receive_enrich_company_via_waterfall_in_clay called for item={item_id[:8]}...")

    # Record the result
    _record_result(item_id, step_name, {
        "action": "enrich_company",
        "source": "clay_waterfall",
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
# ASYNC WORKFLOW 5: Enrich Person via Waterfall in Clay
# =============================================================================

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
)
def start_enrich_person_via_waterfall_in_clay(item_id: str):
    """
    Async Sender: Initiates person enrichment via Clay waterfall.

    This function:
    1. Logs that we're sending to Clay for person enrichment
    2. Sets state to IN_PROGRESS
    3. DOES NOT call the receiver (strict decoupling)
    """
    step_name = "enrich_person_via_waterfall_in_clay"
    print(f"[ASYNC SENDER] start_enrich_person_via_waterfall_in_clay called for item={item_id[:8]}...")
    print(f"[ASYNC SENDER] Sending to Clay Waterfall (Person)...")

    # Set state to IN_PROGRESS
    _update_state(item_id, step_name, "IN_PROGRESS", meta={
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "service": "clay_waterfall",
        "entity": "person",
    })

    return {"success": True, "item_id": item_id, "status": "IN_PROGRESS"}


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
)
def receive_enrich_person_via_waterfall_in_clay(item_id: str, payload: dict):
    """
    Async Receiver: Receives enriched person data from Clay waterfall.

    This function:
    1. Accepts the payload from Clay webhook
    2. Records the enrichment result
    3. Sets state to COMPLETED
    """
    step_name = "enrich_person_via_waterfall_in_clay"
    print(f"[ASYNC RECEIVER] receive_enrich_person_via_waterfall_in_clay called for item={item_id[:8]}...")

    # Record the result
    _record_result(item_id, step_name, {
        "action": "enrich_person",
        "source": "clay_waterfall",
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
# Local Testing Entrypoint
# =============================================================================

@app.local_entrypoint()
def main():
    """Local testing entrypoint."""
    print("Data Enrichment Workers - Local Test")
    print("=" * 50)
    print("Available functions:")
    print("  - run_split_raw_apollo_scrape_data (SYNC)")
    print("  - start_normalize_company_name (ASYNC SENDER)")
    print("  - receive_normalized_company_name (ASYNC RECEIVER)")
    print("  - start_normalize_company_domain (ASYNC SENDER)")
    print("  - receive_normalized_company_domain (ASYNC RECEIVER)")
    print("  - start_enrich_company_via_waterfall_in_clay (ASYNC SENDER)")
    print("  - receive_enrich_company_via_waterfall_in_clay (ASYNC RECEIVER)")
    print("  - start_enrich_person_via_waterfall_in_clay (ASYNC SENDER)")
    print("  - receive_enrich_person_via_waterfall_in_clay (ASYNC RECEIVER)")
    print("  - start_person_enrichment_via_clay (ASYNC SENDER)")
    print("  - receive_person_enrichment_via_clay (ASYNC RECEIVER)")
    print("=" * 50)
    print("Deploy with: modal deploy src/worker.py")
