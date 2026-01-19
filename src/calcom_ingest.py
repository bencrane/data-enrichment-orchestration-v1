"""
Cal.com Webhook Ingest - Modal Function

Receives Cal.com webhook payloads, stores raw events to database,
and spawns appropriate handlers based on event type.
"""

import json
import os
from datetime import datetime, timezone

import modal

app = modal.App("calcom-ingest")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "fastapi",
    "psycopg2-binary",
    "resend",
)

FROM_EMAIL = "team@outboundsolutions.com"


def get_db_connection():
    """Get database connection to outbound Supabase."""
    import psycopg2
    conn_string = os.environ.get("OUTBOUND_POSTGRES_URL")
    if not conn_string:
        raise ValueError("OUTBOUND_POSTGRES_URL not set")
    return psycopg2.connect(conn_string)


# =============================================================================
# Notification Functions
# =============================================================================

@app.function(
    image=image,
    secrets=[
        modal.Secret.from_name("outbound-supabase"),
        modal.Secret.from_name("resend-api"),
    ],
)
def send_booking_notification(booking_id: str, event_type: str):
    """
    Send email notification for booking events.
    
    Args:
        booking_id: UUID of the booking
        event_type: 'created', 'rescheduled', or 'cancelled'
    """
    import resend
    import time
    
    resend.api_key = os.environ.get("RESEND_API_KEY")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Load booking with person info
            cur.execute("""
                SELECT 
                    b.id, b.calcom_uid, b.title, b.start_time, b.end_time, 
                    b.location, b.video_url, b.status, b.organizer_email,
                    p.email, p.name
                FROM bookings b
                JOIN people p ON b.person_id = p.id
                WHERE b.id = %s
            """, (booking_id,))
            row = cur.fetchone()
            
            if not row:
                print(f"[NOTIFICATION] Booking {booking_id} not found")
                return
            
            (bid, calcom_uid, title, start_time, end_time, 
             location, video_url, status, organizer_email, email, name) = row
            
            # Use organizer_email as from address, fallback to default
            from_email = organizer_email or FROM_EMAIL
            
            # Format times nicely
            start_str = start_time.strftime("%A, %B %d at %I:%M %p %Z") if start_time else "TBD"
            
            # Build email content based on event type
            if event_type == "created":
                subject = f"Meeting Confirmed: {title}"
                html = f"""
                <h2>Your meeting is confirmed</h2>
                <p>Hi {name or 'there'},</p>
                <p>Your meeting has been scheduled:</p>
                <ul>
                    <li><strong>What:</strong> {title}</li>
                    <li><strong>When:</strong> {start_str}</li>
                    <li><strong>Where:</strong> {video_url or location or 'TBD'}</li>
                </ul>
                {f'<p><a href="{video_url}">Join Video Call</a></p>' if video_url else ''}
                <p>Looking forward to speaking with you.</p>
                """
            elif event_type == "rescheduled":
                subject = f"Meeting Rescheduled: {title}"
                html = f"""
                <h2>Your meeting has been rescheduled</h2>
                <p>Hi {name or 'there'},</p>
                <p>Your meeting has been moved to a new time:</p>
                <ul>
                    <li><strong>What:</strong> {title}</li>
                    <li><strong>New Time:</strong> {start_str}</li>
                    <li><strong>Where:</strong> {video_url or location or 'TBD'}</li>
                </ul>
                {f'<p><a href="{video_url}">Join Video Call</a></p>' if video_url else ''}
                <p>See you then.</p>
                """
            elif event_type == "cancelled":
                subject = f"Meeting Cancelled: {title}"
                html = f"""
                <h2>Your meeting has been cancelled</h2>
                <p>Hi {name or 'there'},</p>
                <p>The following meeting has been cancelled:</p>
                <ul>
                    <li><strong>What:</strong> {title}</li>
                    <li><strong>Was Scheduled:</strong> {start_str}</li>
                </ul>
                <p>If you'd like to reschedule, please book a new time.</p>
                """
            else:
                print(f"[NOTIFICATION] Unknown event type: {event_type}")
                return
            
            # Send with retry
            for attempt in range(3):
                try:
                    response = resend.Emails.send({
                        "from": from_email,
                        "to": email,
                        "subject": subject,
                        "html": html,
                    })
                    print(f"[NOTIFICATION] Sent {event_type} email to {email} from {from_email}: {response}")
                    
                    # Update booking with notification timestamp
                    cur.execute(
                        "UPDATE bookings SET notification_sent_at = %s WHERE id = %s",
                        (datetime.now(timezone.utc), booking_id)
                    )
                    conn.commit()
                    return
                    
                except Exception as e:
                    print(f"[NOTIFICATION] Attempt {attempt + 1} failed: {e}")
                    if attempt < 2:
                        time.sleep(2 ** attempt)  # 1s, 2s backoff
                    else:
                        print(f"[NOTIFICATION] Failed to send {event_type} email to {email} after 3 attempts")
                        raise
    finally:
        conn.close()


def store_raw_event(payload: dict) -> str:
    """Store raw Cal.com event and return the event ID."""
    import uuid
    
    trigger_event = payload.get("triggerEvent", "UNKNOWN")
    inner_payload = payload.get("payload", {})
    calcom_uid = inner_payload.get("uid")
    calcom_booking_id = inner_payload.get("bookingId")
    
    event_id = str(uuid.uuid4())
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO calcom_events (id, trigger_event, calcom_uid, calcom_booking_id, payload, received_at)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                event_id,
                trigger_event,
                calcom_uid,
                calcom_booking_id,
                json.dumps(payload),
                datetime.now(timezone.utc),
            ))
            conn.commit()
    finally:
        conn.close()
    
    return event_id


# =============================================================================
# Handlers - spawned async based on event type
# =============================================================================

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("outbound-supabase")],
)
def handle_booking_created(event_id: str):
    """
    Handle BOOKING_CREATED event.
    - Find or create Person (by email)
    - Find or create Company (by domain)
    - Create Booking record
    """
    print(f"[BOOKING_CREATED] Processing event {event_id}")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Load the raw event
            cur.execute("SELECT payload FROM calcom_events WHERE id = %s", (event_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Event {event_id} not found")
            
            payload = row[0] if isinstance(row[0], dict) else json.loads(row[0])
            inner = payload.get("payload", {})
            
            # Extract attendee info (the person who booked)
            attendees = inner.get("attendees", [])
            if not attendees:
                raise ValueError("No attendees in payload")
            
            attendee = attendees[0]
            email = attendee.get("email")
            name = attendee.get("name")
            
            # Extract company info from responses (if provided in booking form)
            responses = inner.get("responses", {})
            company_name = None
            company_domain = None
            
            # Check for company field in responses
            for key, val in responses.items():
                if "company" in key.lower() and isinstance(val, dict):
                    company_name = val.get("value")
                elif "domain" in key.lower() and isinstance(val, dict):
                    company_domain = val.get("value")
            
            # Fallback: extract domain from email
            if not company_domain and email and "@" in email:
                domain = email.split("@")[1].lower()
                # Skip personal email domains
                personal_domains = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "me.com"}
                if domain not in personal_domains:
                    company_domain = domain
            
            # Find or create Company
            company_id = None
            if company_domain:
                cur.execute("SELECT id FROM companies WHERE domain = %s", (company_domain,))
                result = cur.fetchone()
                if result:
                    company_id = result[0]
                else:
                    import uuid
                    company_id = str(uuid.uuid4())
                    cur.execute(
                        "INSERT INTO companies (id, name, domain) VALUES (%s, %s, %s)",
                        (company_id, company_name or company_domain, company_domain)
                    )
                    print(f"  Created company: {company_domain}")
            
            # Find or create Person
            cur.execute("SELECT id FROM people WHERE email = %s", (email,))
            result = cur.fetchone()
            if result:
                person_id = result[0]
                # Update company_id if we have one and they don't
                if company_id:
                    cur.execute(
                        "UPDATE people SET company_id = %s WHERE id = %s AND company_id IS NULL",
                        (company_id, person_id)
                    )
                print(f"  Found existing person: {email}")
            else:
                import uuid
                person_id = str(uuid.uuid4())
                cur.execute(
                    "INSERT INTO people (id, email, name, company_id) VALUES (%s, %s, %s, %s)",
                    (person_id, email, name, company_id)
                )
                print(f"  Created person: {email}")
            
            # Extract organizer info
            organizer = inner.get("organizer", {})
            organizer_email = organizer.get("email")
            organizer_name = organizer.get("name")
            organizer_username = organizer.get("username")
            
            # Create Booking
            import uuid
            booking_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO bookings (
                    id, calcom_uid, calcom_booking_id, person_id, title, event_type,
                    start_time, end_time, location, video_url, status, ical_uid, raw_payload,
                    organizer_email, organizer_name, organizer_username
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (calcom_uid) DO UPDATE SET
                    status = EXCLUDED.status,
                    start_time = EXCLUDED.start_time,
                    end_time = EXCLUDED.end_time,
                    organizer_email = EXCLUDED.organizer_email,
                    organizer_name = EXCLUDED.organizer_name,
                    organizer_username = EXCLUDED.organizer_username,
                    updated_at = now()
            """, (
                booking_id,
                inner.get("uid"),
                inner.get("bookingId"),
                person_id,
                inner.get("title"),
                inner.get("type"),
                inner.get("startTime"),
                inner.get("endTime"),
                inner.get("location"),
                inner.get("videoCallData", {}).get("url"),
                inner.get("status", "ACCEPTED"),
                inner.get("iCalUID"),
                json.dumps(inner),
                organizer_email,
                organizer_name,
                organizer_username,
            ))
            print(f"  Created booking: {inner.get('uid')} (organizer: {organizer_email})")
            
            # Get the actual booking ID (in case of upsert)
            cur.execute("SELECT id FROM bookings WHERE calcom_uid = %s", (inner.get("uid"),))
            actual_booking_id = cur.fetchone()[0]
            
            # Create deal if company exists and no active deal
            if company_id:
                cur.execute(
                    "SELECT id FROM deals WHERE company_id = %s AND status = 'active'",
                    (company_id,)
                )
                existing_deal = cur.fetchone()
                if not existing_deal:
                    import uuid
                    deal_id = str(uuid.uuid4())
                    cur.execute(
                        "INSERT INTO deals (id, company_id, status, stage) VALUES (%s, %s, 'active', 'booked')",
                        (deal_id, company_id)
                    )
                    print(f"  Created deal for company {company_id}")
                else:
                    print(f"  Active deal already exists for company {company_id}")
            
            # Mark event as processed
            cur.execute(
                "UPDATE calcom_events SET processed = true, processed_at = %s WHERE id = %s",
                (datetime.now(timezone.utc), event_id)
            )
            
            conn.commit()
            print(f"[BOOKING_CREATED] Done processing event {event_id}")
            
            # Send notification
            send_booking_notification.spawn(str(actual_booking_id), "created")
            
    except Exception as e:
        conn.rollback()
        # Record error
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE calcom_events SET error = %s WHERE id = %s",
                    (str(e), event_id)
                )
                conn.commit()
        except:
            pass
        raise
    finally:
        conn.close()


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("outbound-supabase")],
)
def handle_booking_cancelled(event_id: str):
    """Handle BOOKING_CANCELLED event - update booking status."""
    print(f"[BOOKING_CANCELLED] Processing event {event_id}")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT payload FROM calcom_events WHERE id = %s", (event_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Event {event_id} not found")
            
            payload = row[0] if isinstance(row[0], dict) else json.loads(row[0])
            inner = payload.get("payload", {})
            calcom_uid = inner.get("uid")
            
            # Update booking status and get the booking ID + person's company
            cur.execute("""
                UPDATE bookings SET status = 'CANCELLED', updated_at = now() 
                WHERE calcom_uid = %s 
                RETURNING id, person_id
            """, (calcom_uid,))
            result = cur.fetchone()
            booking_id = result[0] if result else None
            person_id = result[1] if result else None
            
            # Cancel the deal for this company
            if person_id:
                cur.execute("SELECT company_id FROM people WHERE id = %s", (person_id,))
                person_row = cur.fetchone()
                company_id = person_row[0] if person_row else None
                
                if company_id:
                    cur.execute("""
                        UPDATE deals SET status = 'cancelled', updated_at = now() 
                        WHERE company_id = %s AND status = 'active'
                    """, (company_id,))
                    print(f"  Cancelled deal for company {company_id}")
            
            # Mark processed
            cur.execute(
                "UPDATE calcom_events SET processed = true, processed_at = %s WHERE id = %s",
                (datetime.now(timezone.utc), event_id)
            )
            conn.commit()
            print(f"[BOOKING_CANCELLED] Cancelled booking {calcom_uid}")
            
            # Send notification if booking was found
            if booking_id:
                send_booking_notification.spawn(str(booking_id), "cancelled")
            
    except Exception as e:
        conn.rollback()
        try:
            with conn.cursor() as cur:
                cur.execute("UPDATE calcom_events SET error = %s WHERE id = %s", (str(e), event_id))
                conn.commit()
        except:
            pass
        raise
    finally:
        conn.close()


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("outbound-supabase")],
)
def handle_booking_rescheduled(event_id: str):
    """
    Handle BOOKING_RESCHEDULED event.
    
    CRITICAL: Cal.com creates a NEW booking when rescheduling.
    - `uid` and `bookingId` are NEW identifiers
    - `rescheduleUid` and `rescheduleId` are the ORIGINAL identifiers
    - We must look up by `rescheduleUid` to find the existing booking
    """
    print(f"[BOOKING_RESCHEDULED] Processing event {event_id}")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT payload FROM calcom_events WHERE id = %s", (event_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Event {event_id} not found")
            
            payload = row[0] if isinstance(row[0], dict) else json.loads(row[0])
            inner = payload.get("payload", {})
            
            # NEW identifiers (the rescheduled booking)
            new_uid = inner.get("uid")
            new_booking_id = inner.get("bookingId")
            
            # ORIGINAL identifiers (what we need to look up)
            original_uid = inner.get("rescheduleUid")
            rescheduled_by = inner.get("rescheduledBy")
            
            if not original_uid:
                raise ValueError("No rescheduleUid in payload - cannot find original booking")
            
            # Update the existing booking with new identifiers and times
            cur.execute("""
                UPDATE bookings SET 
                    calcom_uid = %s,
                    calcom_booking_id = %s,
                    start_time = %s,
                    end_time = %s,
                    status = %s,
                    updated_at = now()
                WHERE calcom_uid = %s
                RETURNING id
            """, (
                new_uid,
                new_booking_id,
                inner.get("startTime"),
                inner.get("endTime"),
                inner.get("status", "ACCEPTED"),
                original_uid,  # Look up by ORIGINAL uid
            ))
            
            result = cur.fetchone()
            booking_id = result[0] if result else None
            
            if booking_id:
                print(f"[BOOKING_RESCHEDULED] Updated booking {original_uid} -> {new_uid}")
                print(f"  Rescheduled by: {rescheduled_by}")
            else:
                print(f"[BOOKING_RESCHEDULED] WARNING: Original booking {original_uid} not found")
            
            # Mark processed
            cur.execute(
                "UPDATE calcom_events SET processed = true, processed_at = %s WHERE id = %s",
                (datetime.now(timezone.utc), event_id)
            )
            conn.commit()
            
            # Send notification if booking was found
            if booking_id:
                send_booking_notification.spawn(str(booking_id), "rescheduled")
            
    except Exception as e:
        conn.rollback()
        try:
            with conn.cursor() as cur:
                cur.execute("UPDATE calcom_events SET error = %s WHERE id = %s", (str(e), event_id))
                conn.commit()
        except:
            pass
        raise
    finally:
        conn.close()


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("outbound-supabase")],
)
def handle_meeting_ended(event_id: str):
    """
    Handle MEETING_ENDED event.
    - Mark booking as attended
    - Advance deal stage to 'met'
    """
    print(f"[MEETING_ENDED] Processing event {event_id}")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT payload FROM calcom_events WHERE id = %s", (event_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Event {event_id} not found")
            
            payload = row[0] if isinstance(row[0], dict) else json.loads(row[0])
            inner = payload.get("payload", {})
            calcom_uid = inner.get("uid")
            
            # Mark booking as attended
            cur.execute("""
                UPDATE bookings SET attended = true, updated_at = now() 
                WHERE calcom_uid = %s
                RETURNING person_id
            """, (calcom_uid,))
            result = cur.fetchone()
            
            if result:
                person_id = result[0]
                
                # Get company_id from person
                cur.execute("SELECT company_id FROM people WHERE id = %s", (person_id,))
                person_row = cur.fetchone()
                company_id = person_row[0] if person_row else None
                
                if company_id:
                    # Advance deal stage to 'met'
                    cur.execute("""
                        UPDATE deals SET stage = 'met', updated_at = now()
                        WHERE company_id = %s AND status = 'active'
                    """, (company_id,))
                    print(f"  Advanced deal stage to 'met' for company {company_id}")
            
            # Mark processed
            cur.execute(
                "UPDATE calcom_events SET processed = true, processed_at = %s WHERE id = %s",
                (datetime.now(timezone.utc), event_id)
            )
            conn.commit()
            print(f"[MEETING_ENDED] Processed meeting {calcom_uid}")
            
    except Exception as e:
        conn.rollback()
        try:
            with conn.cursor() as cur:
                cur.execute("UPDATE calcom_events SET error = %s WHERE id = %s", (str(e), event_id))
                conn.commit()
        except:
            pass
        raise
    finally:
        conn.close()


# =============================================================================
# Main Ingest Endpoint
# =============================================================================

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("outbound-supabase")],
    min_containers=1,  # Keep one container warm to eliminate cold start latency
)
@modal.fastapi_endpoint(method="POST")
def ingest(payload: dict):
    """
    Main webhook endpoint for Cal.com.
    Stores raw event and spawns appropriate handler.
    """
    trigger_event = payload.get("triggerEvent", "UNKNOWN")
    
    print(f"\n{'='*60}")
    print(f"[INGEST] Received {trigger_event}")
    print(f"{'='*60}")
    
    # Store raw event
    event_id = store_raw_event(payload)
    print(f"[INGEST] Stored event {event_id}")
    
    # Spawn appropriate handler
    if trigger_event == "BOOKING_CREATED":
        handle_booking_created.spawn(event_id)
    elif trigger_event == "BOOKING_CANCELLED":
        handle_booking_cancelled.spawn(event_id)
    elif trigger_event == "BOOKING_RESCHEDULED":
        handle_booking_rescheduled.spawn(event_id)
    elif trigger_event == "MEETING_ENDED":
        handle_meeting_ended.spawn(event_id)
    else:
        print(f"[INGEST] Unknown event type: {trigger_event}, stored but not processed")
    
    return {
        "status": "received",
        "event_id": event_id,
        "trigger_event": trigger_event,
    }
