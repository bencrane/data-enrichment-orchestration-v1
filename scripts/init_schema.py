#!/usr/bin/env python3
"""
Database Schema Initialization Script

Creates all tables defined in src.db.models.
Run this script to initialize the database schema.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.db.utils import get_async_engine
from src.db.models import Base


async def init_schema():
    engine = get_async_engine()

    print("Connecting to database...")

    async with engine.begin() as conn:
        print("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)

    print("Schema initialization complete.")
    await engine.dispose()


async def list_tables():
    from sqlalchemy import text

    engine = get_async_engine()

    async with engine.connect() as conn:
        result = await conn.execute(
            text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """)
        )
        tables = [row[0] for row in result.fetchall()]

    await engine.dispose()
    return tables


async def main():
    await init_schema()

    print("\nVerifying created tables...")
    tables = await list_tables()

    print("\n✅ Tables in database:")
    for table in tables:
        print(f"   - {table}")


if __name__ == "__main__":
    asyncio.run(main())
