#!/usr/bin/env python3
"""
Debug script to verify client_workflow_configs retrieval.
Usage: python scripts/debug_config_retrieval.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from src.db.utils import get_async_engine


async def debug_configs():
    engine = get_async_engine()

    async with engine.connect() as conn:
        # List all clients
        print("=" * 60)
        print("CLIENTS")
        print("=" * 60)
        result = await conn.execute(text("""
            SELECT id, company_name, company_domain FROM clients ORDER BY company_name
        """))
        clients = result.fetchall()
        for c in clients:
            print(f"  {c[1]} ({c[2]})")
            print(f"    ID: {c[0]}")

        print()
        print("=" * 60)
        print("CLIENT WORKFLOW CONFIGS")
        print("=" * 60)
        result = await conn.execute(text("""
            SELECT
                c.company_name as client_name,
                cwc.workflow_slug,
                cwc.config,
                cwc.updated_at
            FROM client_workflow_configs cwc
            JOIN clients c ON cwc.client_id = c.id
            ORDER BY c.company_name, cwc.workflow_slug
        """))
        configs = result.fetchall()

        if not configs:
            print("  ❌ NO CONFIGS FOUND!")
        else:
            for cfg in configs:
                print(f"\n  Client: {cfg[0]}")
                print(f"  Workflow: {cfg[1]}")
                print(f"  Config: {cfg[2]}")
                print(f"  Updated: {cfg[3]}")

        print()
        print("=" * 60)
        print("RECENT WORKFLOW STATES (IN_PROGRESS)")
        print("=" * 60)
        result = await conn.execute(text("""
            SELECT
                ws.step_name,
                ws.status,
                ws.meta,
                ws.updated_at,
                bi.company_domain,
                bi.person_linkedin_url
            FROM workflow_states ws
            JOIN batch_items bi ON ws.item_id = bi.id
            WHERE ws.status = 'IN_PROGRESS'
            ORDER BY ws.updated_at DESC
            LIMIT 10
        """))
        states = result.fetchall()

        if not states:
            print("  No IN_PROGRESS states found")
        else:
            for s in states:
                print(f"\n  Step: {s[0]} | Status: {s[1]}")
                print(f"  Meta: {s[2]}")
                print(f"  Company: {s[4]} | LinkedIn: {s[5]}")
                print(f"  Updated: {s[3]}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(debug_configs())
