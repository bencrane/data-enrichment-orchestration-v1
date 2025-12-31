"""
Migration script to fix legacy constraints on batch_items table.

The 'raw_data' column has a NOT NULL constraint from the old schema,
but we now use 'original_data' instead. This script drops the constraint.

Run: python scripts/fix_legacy_constraints.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
import psycopg2

load_dotenv()


def run_migration():
    """Drop NOT NULL constraint from legacy raw_data column."""
    conn_string = os.getenv("POSTGRES_CONNECTION_STRING")
    if not conn_string:
        raise ValueError("POSTGRES_CONNECTION_STRING not set in environment")

    print("Connecting to database...")
    conn = psycopg2.connect(conn_string)

    try:
        with conn.cursor() as cur:
            print("Dropping NOT NULL constraint from raw_data column...")
            cur.execute("""
                ALTER TABLE batch_items ALTER COLUMN raw_data DROP NOT NULL;
            """)

            conn.commit()
            print("Constraint dropped successfully.")

            # Verify
            cur.execute("""
                SELECT column_name, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'batch_items' AND column_name = 'raw_data'
            """)
            row = cur.fetchone()
            if row:
                print(f"  Verified: raw_data is_nullable = {row[1]}")

    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Migration: Fix legacy constraints")
    print("=" * 60)
    run_migration()
