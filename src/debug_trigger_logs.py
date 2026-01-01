import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ Error: DATABASE_URL not found in .env")
    sys.exit(1)

def check_trigger_logs():
    print(f"Connecting to database...")
    try:
        # Create a connection (using the existing project dependency)
        # We need to ensure we are using the 'postgresql' dialect
        db_url = DATABASE_URL.replace("postgres://", "postgresql://")
        engine = create_engine(db_url)
        
        with engine.connect() as conn:
            print("\n🔍 Checking pg_net HTTP Request Logs (Last 5)...")
            # Query the net._http_response table to see the status of the trigger calls
            query = text("""
                SELECT 
                    id, 
                    created, 
                    status_code, 
                    content_type,
                    headers,
                    body,
                    error_msg
                FROM net._http_response 
                ORDER BY created DESC 
                LIMIT 5;
            """)
            
            result = conn.execute(query)
            rows = result.fetchall()
            
            if not rows:
                print("⚠️ No logs found in net._http_response.")
                print("   This implies the Trigger FAILED to fire at all, or pg_net is not enabled.")
                return

            for row in rows:
                print("-" * 60)
                print(f"Time:   {row.created}")
                print(f"Status: {row.status_code}")
                if row.error_msg:
                    print(f"Error:  {row.error_msg}")
                else:
                    try:
                        print(f"Body:   {row.body}")
                    except:
                        print(f"Body:   (Binary or Empty)")
            
            print("-" * 60)

    except Exception as e:
        print(f"\n❌ Database Verification Failed: {str(e)}")
        print("   (Ensure your IP is allowed in Supabase Network settings if running locally)")

if __name__ == "__main__":
    check_trigger_logs()
