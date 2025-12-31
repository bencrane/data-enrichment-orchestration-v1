"""
Migration script to add 'advanced_at' column to workflow_states table.

This column is used by the orchestrator sequencer to track when a completed
workflow step has had its next step spawned, preventing duplicate spawns.

Run: python scripts/add_advanced_at_column.py
"""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
import psycopg2

load_dotenv()


def run_migration():
    """Add advanced_at column to workflow_states table."""
    conn_string = os.getenv("POSTGRES_CONNECTION_STRING")
    if not conn_string:
        raise ValueError("POSTGRES_CONNECTION_STRING not set in environment")

    print("Connecting to database...")
    conn = psycopg2.connect(conn_string)

    try:
        with conn.cursor() as cur:
            # Check if column already exists
            cur.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'workflow_states'
                AND column_name = 'advanced_at'
            """)

            if cur.fetchone():
                print("Column 'advanced_at' already exists. No migration needed.")
                return

            # Add the column
            print("Adding 'advanced_at' column to workflow_states table...")
            cur.execute("""
                ALTER TABLE workflow_states
                ADD COLUMN advanced_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
            """)

            conn.commit()
            print("Migration complete: 'advanced_at' column added successfully.")

            # Verify the column was added
            cur.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'workflow_states'
                AND column_name = 'advanced_at'
            """)
            result = cur.fetchone()
            if result:
                print(f"  Verified: {result[0]} ({result[1]}, nullable={result[2]})")

    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Migration: Add 'advanced_at' column to workflow_states")
    print("=" * 60)
    run_migration()
