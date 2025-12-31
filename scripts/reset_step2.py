import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")
engine = create_engine(db_url)

with engine.connect() as conn:
    # Reset Failed/Queued items for Step 2 back to PENDING
    result = conn.execute(text("UPDATE workflow_states SET status = 'PENDING' WHERE step_name = 'normalize_company_domain' AND status != 'COMPLETED'"))
    conn.commit()
    print(f"Reset {result.rowcount} items to PENDING")
