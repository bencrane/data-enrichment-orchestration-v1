import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("DATABASE_URL not set")
    sys.exit(1)

engine = create_engine(db_url)

with engine.connect() as conn:
    result = conn.execute(text("SELECT step_name, status, COUNT(*) FROM workflow_states GROUP BY step_name, status"))
    print("\nWorkflow States Summary:")
    for row in result:
        print(f"  {row[0]}: {row[1]} = {row[2]}")
    
    pending_count = conn.execute(text("SELECT COUNT(*) FROM workflow_states WHERE status = 'PENDING'")).scalar()
    print(f"\nTotal Pending: {pending_count}")

