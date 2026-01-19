"""
Deals API - Modal Functions

REST API endpoints for deals/pipeline data.
CORS enabled for frontend consumption.
"""

import json
import os
from datetime import datetime, timezone

import modal
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = modal.App("deals-api")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "fastapi",
    "psycopg2-binary",
    "stripe",
)

# Create FastAPI app with CORS
web_app = FastAPI()

web_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db_connection():
    """Get database connection to outbound Supabase."""
    import psycopg2
    conn_string = os.environ.get("OUTBOUND_POSTGRES_URL")
    if not conn_string:
        raise ValueError("OUTBOUND_POSTGRES_URL not set")
    return psycopg2.connect(conn_string)


def row_to_dict(cursor, row):
    """Convert a database row to a dictionary."""
    if row is None:
        return None
    columns = [desc[0] for desc in cursor.description]
    return dict(zip(columns, row))


def rows_to_list(cursor, rows):
    """Convert multiple database rows to a list of dictionaries."""
    columns = [desc[0] for desc in cursor.description]
    return [dict(zip(columns, row)) for row in rows]


def serialize_value(val):
    """Serialize values for JSON (handle datetime, etc.)."""
    if isinstance(val, datetime):
        return val.isoformat()
    return val


def serialize_row(row_dict):
    """Serialize all values in a row dictionary."""
    return {k: serialize_value(v) for k, v in row_dict.items()}


@web_app.get("/deals")
def list_deals(
    status: str = Query(None, description="Filter by status: active, won, lost, cancelled"),
    stage: str = Query(None, description="Filter by stage: booked, met, proposal"),
):
    """
    List all deals with company and contact information.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = """
                SELECT 
                    d.id,
                    d.status,
                    d.stage,
                    d.notes,
                    d.created_at,
                    d.updated_at,
                    d.closed_at,
                    d.organizer_email,
                    c.id as company_id,
                    c.name as company_name,
                    c.domain as company_domain,
                    p.id as contact_id,
                    p.name as contact_name,
                    p.email as contact_email,
                    b.id as booking_id,
                    b.title as booking_title,
                    b.start_time as booking_start,
                    b.end_time as booking_end,
                    b.status as booking_status,
                    b.attended as booking_attended,
                    b.video_url as booking_video_url
                FROM deals d
                JOIN companies c ON d.company_id = c.id
                LEFT JOIN people p ON p.company_id = c.id
                LEFT JOIN bookings b ON b.person_id = p.id
                WHERE 1=1
            """
            params = []
            
            if status:
                query += " AND d.status = %s"
                params.append(status)
            
            if stage:
                query += " AND d.stage = %s"
                params.append(stage)
            
            query += " ORDER BY d.created_at DESC"
            
            cur.execute(query, params)
            rows = cur.fetchall()
            deals = rows_to_list(cur, rows)
            
            return {"deals": [serialize_row(d) for d in deals], "count": len(deals)}
    finally:
        conn.close()


@web_app.get("/deals/{deal_id}")
def get_deal(deal_id: str):
    """
    Get a specific deal by ID.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    d.id,
                    d.status,
                    d.stage,
                    d.notes,
                    d.created_at,
                    d.updated_at,
                    d.closed_at,
                    d.organizer_email,
                    c.id as company_id,
                    c.name as company_name,
                    c.domain as company_domain
                FROM deals d
                JOIN companies c ON d.company_id = c.id
                WHERE d.id = %s
            """, (deal_id,))
            row = cur.fetchone()
            
            if not row:
                return JSONResponse(status_code=404, content={"error": "Deal not found"})
            
            deal = serialize_row(row_to_dict(cur, row))
            
            # Get contacts for this company
            cur.execute("""
                SELECT id, name, email, phone
                FROM people
                WHERE company_id = %s
            """, (deal["company_id"],))
            contacts = rows_to_list(cur, cur.fetchall())
            deal["contacts"] = [serialize_row(c) for c in contacts]
            
            # Get bookings for these contacts
            if contacts:
                contact_ids = [c["id"] for c in contacts]
                placeholders = ",".join(["%s"] * len(contact_ids))
                cur.execute(f"""
                    SELECT id, calcom_uid, title, start_time, end_time, status, attended, video_url, person_id
                    FROM bookings
                    WHERE person_id IN ({placeholders})
                    ORDER BY start_time DESC
                """, contact_ids)
                bookings = rows_to_list(cur, cur.fetchall())
                deal["bookings"] = [serialize_row(b) for b in bookings]
            else:
                deal["bookings"] = []
            
            return {"deal": deal}
    finally:
        conn.close()


@web_app.get("/companies")
def list_companies():
    """
    List all companies.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, domain, created_at, updated_at
                FROM companies
                ORDER BY name
            """)
            rows = cur.fetchall()
            companies = rows_to_list(cur, rows)
            return {"companies": [serialize_row(c) for c in companies], "count": len(companies)}
    finally:
        conn.close()


@web_app.get("/people")
def list_people():
    """
    List all people/contacts.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    p.id, p.name, p.email, p.phone, p.created_at,
                    c.id as company_id, c.name as company_name
                FROM people p
                LEFT JOIN companies c ON p.company_id = c.id
                ORDER BY p.name
            """)
            rows = cur.fetchall()
            people = rows_to_list(cur, rows)
            return {"people": [serialize_row(p) for p in people], "count": len(people)}
    finally:
        conn.close()


@web_app.get("/bookings/{booking_id}")
def get_booking(booking_id: str):
    """
    Get a specific booking with full context (person, company, deal).
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    b.id, b.calcom_uid, b.title, b.event_type,
                    b.start_time, b.end_time, b.status, b.attended, 
                    b.video_url, b.location, b.created_at, b.notification_sent_at,
                    b.organizer_email, b.organizer_name, b.organizer_username,
                    p.id as person_id, p.name as person_name, p.email as person_email, p.phone as person_phone,
                    c.id as company_id, c.name as company_name, c.domain as company_domain,
                    d.id as deal_id, d.status as deal_status, d.stage as deal_stage, d.notes as deal_notes
                FROM bookings b
                JOIN people p ON b.person_id = p.id
                LEFT JOIN companies c ON p.company_id = c.id
                LEFT JOIN deals d ON d.company_id = c.id AND d.status = 'active'
                WHERE b.id = %s
            """, (booking_id,))
            row = cur.fetchone()
            
            if not row:
                return JSONResponse(status_code=404, content={"error": "Booking not found"})
            
            booking = serialize_row(row_to_dict(cur, row))
            return {"booking": booking}
    finally:
        conn.close()


@web_app.get("/bookings")
def list_bookings(
    status: str = Query(None, description="Filter by status: ACCEPTED, CANCELLED"),
    attended: bool = Query(None, description="Filter by attended status"),
):
    """
    List all bookings.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = """
                SELECT 
                    b.id, b.calcom_uid, b.title, b.event_type,
                    b.start_time, b.end_time, b.status, b.attended, b.video_url,
                    b.created_at, b.notification_sent_at,
                    b.organizer_email, b.organizer_name, b.organizer_username,
                    p.id as person_id, p.name as person_name, p.email as person_email,
                    c.id as company_id, c.name as company_name
                FROM bookings b
                JOIN people p ON b.person_id = p.id
                LEFT JOIN companies c ON p.company_id = c.id
                WHERE 1=1
            """
            params = []
            
            if status:
                query += " AND b.status = %s"
                params.append(status)
            
            if attended is not None:
                query += " AND b.attended = %s"
                params.append(attended)
            
            query += " ORDER BY b.start_time DESC"
            
            cur.execute(query, params)
            rows = cur.fetchall()
            bookings = rows_to_list(cur, rows)
            return {"bookings": [serialize_row(b) for b in bookings], "count": len(bookings)}
    finally:
        conn.close()


@web_app.get("/stats")
def get_stats():
    """
    Get pipeline statistics.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Deals by status
            cur.execute("""
                SELECT status, COUNT(*) as count
                FROM deals
                GROUP BY status
            """)
            deals_by_status = {row[0]: row[1] for row in cur.fetchall()}
            
            # Deals by stage (active only)
            cur.execute("""
                SELECT stage, COUNT(*) as count
                FROM deals
                WHERE status = 'active'
                GROUP BY stage
            """)
            deals_by_stage = {row[0]: row[1] for row in cur.fetchall()}
            
            # Upcoming bookings
            cur.execute("""
                SELECT COUNT(*) FROM bookings
                WHERE status = 'ACCEPTED' AND start_time > NOW()
            """)
            upcoming_bookings = cur.fetchone()[0]
            
            # Completed meetings (attended)
            cur.execute("""
                SELECT COUNT(*) FROM bookings WHERE attended = true
            """)
            completed_meetings = cur.fetchone()[0]
            
            return {
                "deals_by_status": deals_by_status,
                "deals_by_stage": deals_by_stage,
                "upcoming_bookings": upcoming_bookings,
                "completed_meetings": completed_meetings,
            }
    finally:
        conn.close()


@web_app.get("/proposal/{deal_id}")
def get_proposal(deal_id: str):
    """
    Get proposal data for embedded signing.
    Returns signing token and context for frontend embed.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    d.id as deal_id,
                    d.status as deal_status,
                    d.stage as deal_stage,
                    d.value,
                    d.payment_type,
                    d.documenso_document_id,
                    d.documenso_signing_token,
                    d.proposal_generated_at,
                    c.name as company_name,
                    c.domain as company_domain,
                    p.name as person_name,
                    p.email as person_email
                FROM deals d
                JOIN companies c ON d.company_id = c.id
                LEFT JOIN people p ON p.company_id = c.id
                WHERE d.id = %s
            """, (deal_id,))
            row = cur.fetchone()
            
            if not row:
                return JSONResponse(status_code=404, content={"error": "Deal not found"})
            
            data = row_to_dict(cur, row)
            
            # Check if proposal exists
            if not data.get("documenso_signing_token"):
                return JSONResponse(
                    status_code=400, 
                    content={"error": "No proposal generated for this deal"}
                )
            
            return {
                "deal_id": str(data["deal_id"]),
                "company_name": data["company_name"],
                "company_domain": data["company_domain"],
                "person_name": data["person_name"],
                "person_email": data["person_email"],
                "value": float(data["value"]) if data["value"] else None,
                "payment_type": data["payment_type"] or "one_time",
                "signing_token": data["documenso_signing_token"],
                "documenso_document_id": data["documenso_document_id"],
                "status": data["deal_status"],
                "stage": data["deal_stage"],
                "generated_at": serialize_value(data["proposal_generated_at"]),
            }
    finally:
        conn.close()


@web_app.post("/checkout/{deal_id}")
def create_checkout(deal_id: str):
    """
    Create a Stripe Checkout session for the deal.
    Returns checkout URL for redirect.
    """
    import stripe
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    d.value,
                    d.payment_type,
                    c.name as company_name,
                    c.domain as company_domain,
                    p.email as person_email
                FROM deals d
                JOIN companies c ON d.company_id = c.id
                LEFT JOIN people p ON p.company_id = c.id
                WHERE d.id = %s
            """, (deal_id,))
            row = cur.fetchone()
            
            if not row:
                return JSONResponse(status_code=404, content={"error": "Deal not found"})
            
            data = row_to_dict(cur, row)
            
            if not data.get("value"):
                return JSONResponse(status_code=400, content={"error": "Deal has no value set"})
            
            value = float(data["value"])
            payment_type = data.get("payment_type") or "one_time"
            company_name = data["company_name"]
            company_domain = data.get("company_domain") or "outboundsolutions.com"
            person_email = data.get("person_email")
            
            # Build success/cancel URLs based on company domain
            base_url = f"https://{company_domain}"
            success_url = base_url
            cancel_url = base_url
            
            # Create line item based on payment type
            if payment_type == "one_time":
                line_item = {
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": int(value * 100),  # cents
                        "product_data": {
                            "name": f"Data Enrichment Service - {company_name}",
                        },
                    },
                    "quantity": 1,
                }
                mode = "payment"
            else:
                # Subscription modes
                interval = "month"
                interval_count = 1
                
                if payment_type == "quarterly":
                    interval_count = 3
                elif payment_type == "annual":
                    interval = "year"
                
                line_item = {
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": int(value * 100),
                        "product_data": {
                            "name": f"Data Enrichment Service - {company_name}",
                        },
                        "recurring": {
                            "interval": interval,
                            "interval_count": interval_count,
                        },
                    },
                    "quantity": 1,
                }
                mode = "subscription"
            
            # Create Stripe Checkout session
            checkout_params = {
                "line_items": [line_item],
                "mode": mode,
                "success_url": success_url,
                "cancel_url": cancel_url,
                "metadata": {
                    "deal_id": deal_id,
                },
            }
            
            if person_email:
                checkout_params["customer_email"] = person_email
            
            session = stripe.checkout.Session.create(**checkout_params)
            
            return {
                "checkout_url": session.url,
                "session_id": session.id,
            }
            
    except stripe.error.StripeError as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        conn.close()


@app.function(
    image=image,
    secrets=[
        modal.Secret.from_name("outbound-supabase"),
        modal.Secret.from_name("stripe-api"),
    ],
    min_containers=1,  # Keep one container warm to eliminate cold start latency
)
@modal.asgi_app()
def api():
    """Serve the FastAPI app."""
    return web_app

