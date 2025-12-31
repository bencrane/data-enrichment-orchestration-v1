"""
Migration script to add missing columns to batch_items table.

This ensures the database schema matches the BatchItem model with all
company and person fields, plus original_data for raw storage.

Run: python scripts/force_batch_items_update.py
"""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
import psycopg2

load_dotenv()


def run_migration():
    """Add missing columns to batch_items table."""
    conn_string = os.getenv("POSTGRES_CONNECTION_STRING")
    if not conn_string:
        raise ValueError("POSTGRES_CONNECTION_STRING not set in environment")

    print("Connecting to database...")
    conn = psycopg2.connect(conn_string)

    try:
        with conn.cursor() as cur:
            print("Adding missing columns to batch_items table...")

            # Add all columns - IF NOT EXISTS handles idempotency
            cur.execute("""
                ALTER TABLE batch_items
                ADD COLUMN IF NOT EXISTS company_name text,
                ADD COLUMN IF NOT EXISTS company_domain text,
                ADD COLUMN IF NOT EXISTS company_linkedin_url text,
                ADD COLUMN IF NOT EXISTS company_industry text,
                ADD COLUMN IF NOT EXISTS company_city text,
                ADD COLUMN IF NOT EXISTS company_state text,
                ADD COLUMN IF NOT EXISTS company_country text,
                ADD COLUMN IF NOT EXISTS person_first_name text,
                ADD COLUMN IF NOT EXISTS person_last_name text,
                ADD COLUMN IF NOT EXISTS person_linkedin_url text,
                ADD COLUMN IF NOT EXISTS person_title text,
                ADD COLUMN IF NOT EXISTS original_data jsonb;
            """)

            conn.commit()
            print("Migration complete.")

            # Verify columns
            print("\nVerifying batch_items columns:")
            cur.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'batch_items'
                ORDER BY ordinal_position
            """)
            for row in cur.fetchall():
                print(f"  {row[0]}: {row[1]} (nullable={row[2]})")

    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Migration: Add columns to batch_items")
    print("=" * 60)
    run_migration()
