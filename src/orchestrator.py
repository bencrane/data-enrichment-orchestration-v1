"""
Prefect Orchestrator for Data Enrichment.

This flow polls for PENDING workflow_states and dispatches work to Modal workers.
It bridges the Database State and the Modal Execution Layer.
"""

import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from prefect import flow, task, get_run_logger
from prefect.tasks import task_input_hash
import modal

# Load environment variables
load_dotenv()

# =============================================================================
# Database Connection (Sync)
# =============================================================================

def get_db_connection():
    """Create a new sync database connection."""
    import psycopg2

    conn_string = os.getenv("POSTGRES_CONNECTION_STRING")
    if not conn_string:
        raise ValueError("POSTGRES_CONNECTION_STRING not set")

    return psycopg2.connect(conn_string)


# =============================================================================
# Tasks
# =============================================================================

@task(name="fetch_pending_items", retries=2, retry_delay_seconds=5)
def fetch_pending_items(batch_size: int = 50) -> list[dict]:
    """
    Fetch workflow_states with status='PENDING', enriched with batch_item data
    and enrichment_registry function mappings.

    Returns list of dicts with: item_id, step_name, workflow_state_id,
    modal_sender_fn, workflow_type
    """
    logger = get_run_logger()
    conn = get_db_connection()

    try:
        with conn.cursor() as cur:
            # Join workflow_states with enrichment_registry to get function names
            cur.execute("""
                SELECT
                    ws.id as workflow_state_id,
                    ws.item_id,
                    ws.step_name,
                    ws.batch_id,
                    er.type as workflow_type,
                    er.modal_sender_fn,
                    er.modal_receiver_fn
                FROM workflow_states ws
                LEFT JOIN enrichment_registry er ON ws.step_name = er.slug
                WHERE ws.status = 'PENDING'
                ORDER BY ws.updated_at ASC
                LIMIT %s
            """, (batch_size,))

            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()

            items = [dict(zip(columns, row)) for row in rows]
            logger.info(f"Fetched {len(items)} pending items")
            return items

    finally:
        conn.close()


@task(name="update_state_to_queued")
def update_state_to_queued(workflow_state_id: str) -> bool:
    """
    Update a workflow_state to QUEUED status to prevent re-pickup.
    """
    logger = get_run_logger()
    conn = get_db_connection()

    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE workflow_states
                SET status = 'QUEUED', updated_at = %s
                WHERE id = %s AND status = 'PENDING'
            """, (datetime.now(timezone.utc), str(workflow_state_id)))

            updated = cur.rowcount > 0
            conn.commit()

            if updated:
                logger.debug(f"State {str(workflow_state_id)[:8]}... -> QUEUED")
            return updated

    finally:
        conn.close()


@task(name="fetch_completed_for_advancement", retries=2, retry_delay_seconds=5)
def fetch_completed_for_advancement(batch_size: int = 50) -> list[dict]:
    """
    Fetch workflow_states with status='COMPLETED' and advanced_at=NULL.
    These are completed steps that haven't yet spawned their next step.

    Returns list of dicts with: workflow_state_id, item_id, batch_id, step_name
    """
    logger = get_run_logger()
    conn = get_db_connection()

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    ws.id as workflow_state_id,
                    ws.item_id,
                    ws.batch_id,
                    ws.step_name
                FROM workflow_states ws
                WHERE ws.status = 'COMPLETED'
                AND ws.advanced_at IS NULL
                ORDER BY ws.updated_at ASC
                LIMIT %s
            """, (batch_size,))

            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()

            items = [dict(zip(columns, row)) for row in rows]
            logger.info(f"Fetched {len(items)} completed items ready for advancement")
            return items

    finally:
        conn.close()


@task(name="get_batch_blueprint")
def get_batch_blueprint(batch_id: str) -> list[str]:
    """
    Get the ordered blueprint (workflow slugs) for a batch.
    """
    conn = get_db_connection()

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT blueprint
                FROM batches
                WHERE id = %s
            """, (str(batch_id),))

            row = cur.fetchone()
            if row and row[0]:
                return row[0]  # JSONB returns as Python list
            return []

    finally:
        conn.close()


@task(name="spawn_next_step")
def spawn_next_step(item_id: str, batch_id: str, next_step: str) -> bool:
    """
    Create a new WorkflowState for the next step in the pipeline.
    Returns True if created, False if already exists.
    """
    logger = get_run_logger()
    conn = get_db_connection()

    try:
        with conn.cursor() as cur:
            # Insert with ON CONFLICT DO NOTHING to handle duplicates
            cur.execute("""
                INSERT INTO workflow_states (id, batch_id, item_id, step_name, status, updated_at)
                VALUES (gen_random_uuid(), %s, %s, %s, 'PENDING', NOW())
                ON CONFLICT (batch_id, item_id, step_name) DO NOTHING
            """, (str(batch_id), str(item_id), next_step))

            created = cur.rowcount > 0
            conn.commit()

            if created:
                logger.info(f"Spawned next step '{next_step}' for item {str(item_id)[:8]}...")
            else:
                logger.debug(f"Step '{next_step}' already exists for item {str(item_id)[:8]}...")

            return created

    finally:
        conn.close()


@task(name="mark_state_as_advanced")
def mark_state_as_advanced(workflow_state_id: str) -> bool:
    """
    Mark a workflow_state as advanced (set advanced_at timestamp).
    This prevents re-processing by the sequencer.
    """
    conn = get_db_connection()

    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE workflow_states
                SET advanced_at = %s
                WHERE id = %s AND advanced_at IS NULL
            """, (datetime.now(timezone.utc), str(workflow_state_id)))

            updated = cur.rowcount > 0
            conn.commit()
            return updated

    finally:
        conn.close()


@task(name="dispatch_to_modal")
def dispatch_to_modal(item: dict) -> dict:
    """
    Dispatch a single item to the appropriate Modal function.
    Uses .spawn() for async fire-and-forget execution.

    Returns dispatch result with status.
    """
    logger = get_run_logger()

    item_id = str(item["item_id"])
    step_name = item["step_name"]
    modal_fn_name = item.get("modal_sender_fn")
    workflow_type = item.get("workflow_type")

    if not modal_fn_name:
        logger.warning(f"No modal_sender_fn for step '{step_name}', skipping item {item_id[:8]}...")
        return {
            "item_id": item_id,
            "status": "skipped",
            "reason": "no_function_mapping"
        }

    try:
        # Lookup the Modal function
        fn = modal.Function.from_name("data-enrichment-workers", modal_fn_name)

        # Spawn async execution (fire-and-forget)
        call = fn.spawn(item_id)

        logger.info(f"Dispatched item {item_id[:8]}... to {modal_fn_name} (type={workflow_type})")

        return {
            "item_id": item_id,
            "status": "dispatched",
            "function": modal_fn_name,
            "call_id": str(call.object_id) if hasattr(call, 'object_id') else None
        }

    except Exception as e:
        logger.error(f"Failed to dispatch item {item_id[:8]}... to {modal_fn_name}: {e}")
        return {
            "item_id": item_id,
            "status": "failed",
            "error": str(e)
        }


# =============================================================================
# Flows
# =============================================================================

@flow(name="advance_completed_items", log_prints=True)
def advance_completed_items(batch_size: int = 50) -> dict:
    """
    The Sequencer: Advances completed workflow steps to their next step.

    For each COMPLETED workflow_state that hasn't been advanced:
    1. Look up the batch's blueprint (ordered workflow slugs)
    2. Find the current step's position in the blueprint
    3. If there's a next step, spawn a new PENDING WorkflowState for it
    4. Mark the current state as advanced (set advanced_at)

    This enables multi-step pipelines to flow automatically.
    """
    logger = get_run_logger()
    logger.info(f"Starting sequencer run (batch_size={batch_size})")

    # Fetch completed items that need advancement
    completed_items = fetch_completed_for_advancement(batch_size=batch_size)

    if not completed_items:
        logger.info("No completed items to advance.")
        return {"processed": 0, "advanced": 0, "finished": 0}

    results = {
        "processed": 0,
        "advanced": 0,  # Spawned next step
        "finished": 0,  # No next step (pipeline complete)
        "errors": 0
    }

    # Cache blueprints to avoid repeated lookups
    blueprint_cache: dict[str, list[str]] = {}

    for item in completed_items:
        workflow_state_id = str(item["workflow_state_id"])
        item_id = str(item["item_id"])
        batch_id = str(item["batch_id"])
        current_step = item["step_name"]

        results["processed"] += 1

        try:
            # Get blueprint (use cache if available)
            if batch_id not in blueprint_cache:
                blueprint_cache[batch_id] = get_batch_blueprint(batch_id)

            blueprint = blueprint_cache[batch_id]

            if not blueprint:
                logger.warning(f"No blueprint found for batch {batch_id[:8]}...")
                mark_state_as_advanced(workflow_state_id)
                results["finished"] += 1
                continue

            # Find current step position
            try:
                current_index = blueprint.index(current_step)
            except ValueError:
                logger.warning(f"Step '{current_step}' not found in blueprint for batch {batch_id[:8]}...")
                mark_state_as_advanced(workflow_state_id)
                results["finished"] += 1
                continue

            # Check if there's a next step
            if current_index + 1 < len(blueprint):
                next_step = blueprint[current_index + 1]

                # Spawn the next step
                spawned = spawn_next_step(item_id, batch_id, next_step)

                if spawned:
                    logger.info(f"Item {item_id[:8]}...: {current_step} -> {next_step}")
                    results["advanced"] += 1
                else:
                    logger.debug(f"Item {item_id[:8]}...: {next_step} already exists")
                    results["advanced"] += 1  # Still counts as advanced

            else:
                # No more steps - pipeline complete for this item
                logger.info(f"Item {item_id[:8]}...: Pipeline complete (finished at {current_step})")
                results["finished"] += 1

            # Mark as advanced regardless
            mark_state_as_advanced(workflow_state_id)

        except Exception as e:
            logger.error(f"Error advancing item {item_id[:8]}...: {e}")
            results["errors"] += 1

    logger.info(f"Sequencer run complete: {results}")
    return results


@flow(name="dispatch_pending_items", log_prints=True)
def dispatch_pending_items(batch_size: int = 50) -> dict:
    """
    Dispatcher: Fetches PENDING workflow_states and dispatches to Modal.

    1. Fetches PENDING workflow_states
    2. Updates them to QUEUED (to prevent re-pickup)
    3. Dispatches to appropriate Modal functions
    """
    logger = get_run_logger()
    logger.info(f"Starting dispatcher run (batch_size={batch_size})")

    # 1. Fetch pending items
    pending_items = fetch_pending_items(batch_size=batch_size)

    if not pending_items:
        logger.info("No pending items found.")
        return {"processed": 0, "dispatched": 0, "failed": 0}

    # 2. Process each item
    results = {
        "processed": 0,
        "dispatched": 0,
        "queued": 0,
        "skipped": 0,
        "failed": 0
    }

    for item in pending_items:
        workflow_state_id = item["workflow_state_id"]

        # Update to QUEUED first (prevents re-pickup by concurrent runs)
        queued = update_state_to_queued(workflow_state_id)

        if not queued:
            logger.debug(f"Item {str(item['item_id'])[:8]}... already picked up, skipping")
            continue

        results["queued"] += 1

        # Dispatch to Modal
        dispatch_result = dispatch_to_modal(item)
        results["processed"] += 1

        if dispatch_result["status"] == "dispatched":
            results["dispatched"] += 1
        elif dispatch_result["status"] == "skipped":
            results["skipped"] += 1
        else:
            results["failed"] += 1

    logger.info(f"Dispatcher run complete: {results}")
    return results


@flow(name="orchestrator_main", log_prints=True)
def orchestrator_main(batch_size: int = 50):
    """
    Main orchestrator flow that runs both the sequencer and dispatcher.

    1. advance_completed_items() - Spawn next steps for completed work
    2. dispatch_pending_items() - Dispatch pending work to Modal

    This ordering ensures completed work advances before new work is dispatched.
    """
    logger = get_run_logger()
    logger.info("=" * 60)
    logger.info("Data Enrichment Orchestrator - Main Loop")
    logger.info("=" * 60)

    # Phase 1: Advance completed items to their next step
    sequencer_results = advance_completed_items(batch_size=batch_size)

    # Phase 2: Dispatch pending items to Modal
    dispatcher_results = dispatch_pending_items(batch_size=batch_size)

    # Combine results
    combined = {
        "sequencer": sequencer_results,
        "dispatcher": dispatcher_results
    }

    logger.info(f"Orchestrator complete: {combined}")
    return combined


# Backwards compatibility alias
def process_pending_items(batch_size: int = 50):
    """Alias for orchestrator_main for backwards compatibility."""
    return orchestrator_main(batch_size=batch_size)


# =============================================================================
# Local Entrypoint
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("Data Enrichment Orchestrator")
    print("=" * 60)

    # Run the main orchestrator flow
    result = orchestrator_main(batch_size=50)

    print("\nResults:")
    print("  Sequencer:")
    for key, value in result.get("sequencer", {}).items():
        print(f"    {key}: {value}")
    print("  Dispatcher:")
    for key, value in result.get("dispatcher", {}).items():
        print(f"    {key}: {value}")
