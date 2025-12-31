"""
Script to trigger async callbacks for testing.

Simulates the return leg of async workflows by calling the receiver functions
with mock data for pending/in-progress items.

Run: python scripts/trigger_callbacks.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
import psycopg2
import modal

load_dotenv()


def get_pending_items(step_name: str) -> list[dict]:
    """Fetch items waiting for callback."""
    conn_string = os.getenv("POSTGRES_CONNECTION_STRING")
    conn = psycopg2.connect(conn_string)

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT ws.id, ws.item_id, ws.batch_id, ws.status,
                       bi.company_name, bi.person_first_name, bi.person_last_name
                FROM workflow_states ws
                JOIN batch_items bi ON ws.item_id = bi.id
                WHERE ws.step_name = %s
                AND ws.status IN ('QUEUED', 'IN_PROGRESS')
                ORDER BY ws.updated_at ASC
                LIMIT 100
            """, (step_name,))

            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
            return [dict(zip(columns, row)) for row in rows]
    finally:
        conn.close()


def trigger_normalize_company_name_callbacks():
    """Trigger callbacks for normalize_company_name workflow."""
    step_name = "normalize_company_name"
    print(f"\n{'='*60}")
    print(f"Triggering callbacks for: {step_name}")
    print(f"{'='*60}")

    items = get_pending_items(step_name)
    print(f"Found {len(items)} items waiting for callback")

    if not items:
        print("No pending items found.")
        return

    # Load the Modal function
    try:
        fn = modal.Function.from_name("data-enrichment-workers", "receive_normalized_company_name")
        print(f"Loaded Modal function: receive_normalized_company_name")
    except Exception as e:
        print(f"Error loading Modal function: {e}")
        return

    # Process each item
    success_count = 0
    error_count = 0

    for item in items:
        item_id = str(item["item_id"])
        company_name = item.get("company_name") or "Unknown Company"

        # Create mock normalized result
        mock_result = {
            "normalized_name": f"{company_name} Inc.",
            "confidence": 0.95,
            "source": "mock_callback"
        }

        print(f"\n  Processing item {item_id[:8]}... ({company_name})")
        print(f"    Mock result: {mock_result}")

        try:
            # Call the receiver function
            result = fn.remote(item_id, mock_result)
            print(f"    ✓ Callback successful: {result}")
            success_count += 1
        except Exception as e:
            print(f"    ✗ Callback failed: {e}")
            error_count += 1

    print(f"\n{'='*60}")
    print(f"Complete: {success_count} success, {error_count} errors")
    print(f"{'='*60}")


def trigger_normalize_company_domain_callbacks():
    """Trigger callbacks for normalize_company_domain workflow."""
    step_name = "normalize_company_domain"
    print(f"\n{'='*60}")
    print(f"Triggering callbacks for: {step_name}")
    print(f"{'='*60}")

    items = get_pending_items(step_name)
    print(f"Found {len(items)} items waiting for callback")

    if not items:
        print("No pending items found.")
        return

    # Load the Modal function
    try:
        fn = modal.Function.from_name("data-enrichment-workers", "receive_normalized_company_domain")
        print(f"Loaded Modal function: receive_normalized_company_domain")
    except Exception as e:
        print(f"Error loading Modal function: {e}")
        return

    # Process each item
    success_count = 0
    error_count = 0

    for item in items:
        item_id = str(item["item_id"])
        company_name = item.get("company_name") or "unknown"

        # Create mock normalized domain
        mock_result = {
            "normalized_domain": f"{company_name.lower().replace(' ', '')}.com",
            "confidence": 0.90,
            "source": "mock_callback"
        }

        print(f"\n  Processing item {item_id[:8]}... ({company_name})")
        print(f"    Mock result: {mock_result}")

        try:
            result = fn.remote(item_id, mock_result)
            print(f"    ✓ Callback successful: {result}")
            success_count += 1
        except Exception as e:
            print(f"    ✗ Callback failed: {e}")
            error_count += 1

    print(f"\n{'='*60}")
    print(f"Complete: {success_count} success, {error_count} errors")
    print(f"{'='*60}")


def show_workflow_status():
    """Show current workflow state counts."""
    conn_string = os.getenv("POSTGRES_CONNECTION_STRING")
    conn = psycopg2.connect(conn_string)

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT step_name, status, COUNT(*) as count
                FROM workflow_states
                GROUP BY step_name, status
                ORDER BY step_name, status
            """)

            print(f"\n{'='*60}")
            print("Current Workflow Status")
            print(f"{'='*60}")

            current_step = None
            for row in cur.fetchall():
                step, status, count = row
                if step != current_step:
                    print(f"\n  {step}:")
                    current_step = step
                print(f"    {status}: {count}")
    finally:
        conn.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Trigger Async Callbacks (Test Script)")
    print("=" * 60)

    # Show current status
    show_workflow_status()

    # Trigger callbacks for normalize_company_name
    trigger_normalize_company_name_callbacks()

    # Trigger callbacks for normalize_company_domain
    trigger_normalize_company_domain_callbacks()

    # Show updated status
    show_workflow_status()
