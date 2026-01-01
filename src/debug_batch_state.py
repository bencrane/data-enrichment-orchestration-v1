
import os
import sys
from dotenv import load_dotenv
import psycopg2
from datetime import datetime

# Load env vars exactly like orchestrator
load_dotenv()

def get_db_connection():
    conn_string = os.getenv("POSTGRES_CONNECTION_STRING")
    if not conn_string:
        print("ERROR: POSTGRES_CONNECTION_STRING not set")
        sys.exit(1)
    return psycopg2.connect(conn_string)

def debug_latest_batch():
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        print("="*60)
        print("DIAGNOSIS: LATEST BATCH STATE")
        print("="*60)

        # 1. Get Latest Batch
        cur.execute("""
            SELECT id, client_id, blueprint, status, created_at
            FROM batches
            ORDER BY created_at DESC
            LIMIT 1
        """)
        batch = cur.fetchone()
        
        if not batch:
            print("No batches found.")
            return

        batch_id, client_id, blueprint, batch_status, created_at = batch
        print(f"Batch ID:      {batch_id}")
        print(f"Created At:    {created_at}")
        print(f"Status:        {batch_status}")
        print(f"Blueprint:     {blueprint}")
        print("-" * 60)

        # 2. Dump Raw Workflow States
        print("\n[RAW WORKFLOW STATES]")
        cur.execute("""
            SELECT step_name, status, count(*), min(updated_at), max(updated_at)
            FROM workflow_states
            WHERE batch_id = %s
            GROUP BY step_name, status
        """, (batch_id,))
        
        states = cur.fetchall()
        if not states:
            print("  (No workflow states found for this batch!)")
        
        for step, status, count, first, last in states:
            print(f"  Step: '{step}' | Status: '{status}' | Count: {count} | Last Update: {last}")

        # 3. Simulate Orchestrator Query (The JOIN)
        print("\n[ORCHESTRATOR VIEW - JOIN CHECK]")
        print("Checking if 'step_name' matches 'enrichment_registry.slug'...")
        
        cur.execute("""
            SELECT 
                ws.step_name as ws_step,
                ws.status as ws_status,
                er.slug as registry_slug,
                er.modal_sender_fn,
                count(*)
            FROM workflow_states ws
            LEFT JOIN enrichment_registry er ON ws.step_name = er.slug
            WHERE ws.batch_id = %s
            GROUP BY ws.step_name, ws.status, er.slug, er.modal_sender_fn
        """, (batch_id,))
        
        join_results = cur.fetchall()
        
        for ws_step, ws_status, reg_slug, modal_fn, count in join_results:
            match = "MATCH" if ws_step == reg_slug else "MISMATCH/MISSING"
            fn_status = f"Fn: {modal_fn}" if modal_fn else "NO FUNCTION MAPPED"
            
            print(f"  Step: '{ws_step}' ({ws_status}) -> Registry: '{reg_slug}' [{match}] -> {fn_status}")
            
            if ws_status == 'PENDING' and not modal_fn:
                print(f"  *** CRITICAL STARTUP FAILURE: Item is PENDING but has no mapped Modal Function. Orchestrator will skip it. ***")

    finally:
        conn.close()

if __name__ == "__main__":
    debug_latest_batch()
