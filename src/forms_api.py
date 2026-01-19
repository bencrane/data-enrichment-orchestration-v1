"""
Forms API - Modal Functions

Handles form submissions for meeting outcomes and proposal generation.
Pattern: Ingest → Store raw → Spawn handler → Process
"""

import json
import os
from datetime import datetime, timezone

import modal
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

app = modal.App("forms-api")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "fastapi",
    "psycopg2-binary",
    "resend",
    "docraptor",
    "requests",
)

# FastAPI app with CORS
web_app = FastAPI()

web_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
# Pydantic Models for Request Validation
# =============================================================================

class MeetingOutcomePayload(BaseModel):
    booking_id: str
    outcome: str  # 'attended', 'no_show', 'rescheduled'
    next_step: str  # 'send_followup', 'schedule_another', 'send_proposal', 'close_won', 'close_lost'
    notes: Optional[str] = None
    followup_subject: Optional[str] = None
    followup_message: Optional[str] = None


class ProposalGenerationPayload(BaseModel):
    booking_id: str
    proposal_type: str  # 'standard', 'custom', 'enterprise'
    monthly_value: Optional[float] = None
    payment_type: str = "one_time"  # 'one_time', 'monthly', 'quarterly', 'annual'
    scope_summary: Optional[str] = None
    special_terms: Optional[str] = None


# =============================================================================
# Meeting Outcome Form
# =============================================================================

@web_app.post("/outcome")
def submit_meeting_outcome(payload: MeetingOutcomePayload):
    """
    Receive meeting outcome form submission.
    Stores raw payload and spawns handler.
    """
    import uuid
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Get deal_id from booking
            cur.execute("""
                SELECT d.id 
                FROM bookings b
                JOIN people p ON b.person_id = p.id
                JOIN deals d ON d.company_id = p.company_id AND d.status = 'active'
                WHERE b.id = %s
            """, (payload.booking_id,))
            result = cur.fetchone()
            deal_id = result[0] if result else None
            
            # Store submission
            submission_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO form_submissions (id, form_type, booking_id, deal_id, payload, submitted_at)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                submission_id,
                'meeting_outcome',
                payload.booking_id,
                deal_id,
                json.dumps(payload.model_dump()),
                datetime.now(timezone.utc),
            ))
            conn.commit()
            
        print(f"[FORM] Stored meeting outcome submission {submission_id}")
        
        # Spawn handler
        process_meeting_outcome.spawn(submission_id)
        
        return {
            "status": "received",
            "submission_id": submission_id,
            "form_type": "meeting_outcome"
        }
        
    except Exception as e:
        conn.rollback()
        print(f"[FORM] Error storing submission: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        conn.close()


@app.function(
    image=image,
    secrets=[
        modal.Secret.from_name("outbound-supabase"),
        modal.Secret.from_name("resend-api"),
    ],
)
def process_meeting_outcome(submission_id: str):
    """
    Process meeting outcome submission.
    - Updates deal based on outcome/next_step
    - Sends followup email if requested
    """
    import resend
    import time
    
    print(f"[HANDLER] Processing meeting outcome {submission_id}")
    
    resend.api_key = os.environ.get("RESEND_API_KEY")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Load submission
            cur.execute("""
                SELECT payload, booking_id, deal_id
                FROM form_submissions
                WHERE id = %s
            """, (submission_id,))
            row = cur.fetchone()
            
            if not row:
                raise ValueError(f"Submission {submission_id} not found")
            
            payload = row[0] if isinstance(row[0], dict) else json.loads(row[0])
            booking_id = row[1]
            deal_id = row[2]
            
            outcome = payload.get("outcome")
            next_step = payload.get("next_step")
            notes = payload.get("notes")
            followup_message = payload.get("followup_message")
            
            print(f"  Outcome: {outcome}, Next Step: {next_step}")
            
            # Load booking context for email
            cur.execute("""
                SELECT 
                    p.name as person_name, p.email as person_email,
                    c.name as company_name, b.title as meeting_title
                FROM bookings b
                JOIN people p ON b.person_id = p.id
                LEFT JOIN companies c ON p.company_id = c.id
                WHERE b.id = %s
            """, (booking_id,))
            context = cur.fetchone()
            person_name = context[0] if context else "there"
            person_email = context[1] if context else None
            company_name = context[2] if context else "Unknown"
            meeting_title = context[3] if context else "Meeting"
            
            # === PLACEHOLDER BUSINESS LOGIC ===
            # Update deal based on outcome
            if deal_id:
                if outcome == "attended":
                    cur.execute(
                        "UPDATE deals SET stage = 'met', updated_at = now() WHERE id = %s",
                        (deal_id,)
                    )
                    print(f"  Updated deal {deal_id} stage to 'met'")
                
                if next_step == "close_won":
                    cur.execute(
                        "UPDATE deals SET status = 'won', closed_at = now(), updated_at = now() WHERE id = %s",
                        (deal_id,)
                    )
                    print(f"  Closed deal {deal_id} as WON")
                elif next_step == "close_lost":
                    cur.execute(
                        "UPDATE deals SET status = 'lost', closed_at = now(), updated_at = now() WHERE id = %s",
                        (deal_id,)
                    )
                    print(f"  Closed deal {deal_id} as LOST")
                
                # Update notes if provided
                if notes:
                    cur.execute(
                        "UPDATE deals SET notes = %s, updated_at = now() WHERE id = %s",
                        (notes, deal_id)
                    )
            
            # Update booking attended status
            if outcome == "attended":
                cur.execute(
                    "UPDATE bookings SET attended = true, updated_at = now() WHERE id = %s",
                    (booking_id,)
                )
            elif outcome == "no_show":
                cur.execute(
                    "UPDATE bookings SET attended = false, updated_at = now() WHERE id = %s",
                    (booking_id,)
                )
            
            # Send followup email if requested
            followup_subject = payload.get("followup_subject")
            if next_step == "send_followup" and followup_message and person_email:
                print(f"  Sending followup email to {person_email}")
                
                # Use custom subject if provided, otherwise default
                email_subject = followup_subject if followup_subject else f"Following up: {meeting_title}"
                
                for attempt in range(3):
                    try:
                        response = resend.Emails.send({
                            "from": FROM_EMAIL,
                            "to": person_email,
                            "subject": email_subject,
                            "html": f"""
                                <p>Hi {person_name},</p>
                                <p>{followup_message}</p>
                                <p>Best regards</p>
                            """,
                        })
                        print(f"  Followup email sent: {response}")
                        break
                    except Exception as e:
                        print(f"  Email attempt {attempt + 1} failed: {e}")
                        if attempt < 2:
                            time.sleep(2 ** attempt)
            
            # Mark submission as processed
            cur.execute("""
                UPDATE form_submissions 
                SET processed = true, processed_at = %s 
                WHERE id = %s
            """, (datetime.now(timezone.utc), submission_id))
            
            conn.commit()
            print(f"[HANDLER] Done processing {submission_id}")
            
    except Exception as e:
        conn.rollback()
        print(f"[HANDLER] Error processing {submission_id}: {e}")
        # Record error
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE form_submissions SET error = %s WHERE id = %s",
                    (str(e), submission_id)
                )
                conn.commit()
        except:
            pass
        raise
    finally:
        conn.close()


# =============================================================================
# Proposal Generation Form (Scaffold)
# =============================================================================

@web_app.post("/proposal")
def submit_proposal_generation(payload: ProposalGenerationPayload):
    """
    Receive proposal generation form submission.
    Stores raw payload and spawns handler.
    """
    import uuid
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Get deal_id from booking
            cur.execute("""
                SELECT d.id 
                FROM bookings b
                JOIN people p ON b.person_id = p.id
                JOIN deals d ON d.company_id = p.company_id AND d.status = 'active'
                WHERE b.id = %s
            """, (payload.booking_id,))
            result = cur.fetchone()
            deal_id = result[0] if result else None
            
            # Store submission
            submission_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO form_submissions (id, form_type, booking_id, deal_id, payload, submitted_at)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                submission_id,
                'proposal_generation',
                payload.booking_id,
                deal_id,
                json.dumps(payload.model_dump()),
                datetime.now(timezone.utc),
            ))
            conn.commit()
            
        print(f"[FORM] Stored proposal generation submission {submission_id}")
        
        # Spawn handler
        process_proposal_generation.spawn(submission_id)
        
        return {
            "status": "received",
            "submission_id": submission_id,
            "form_type": "proposal_generation"
        }
        
    except Exception as e:
        conn.rollback()
        print(f"[FORM] Error storing submission: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        conn.close()


@app.function(
    image=image,
    secrets=[
        modal.Secret.from_name("outbound-supabase"),
        modal.Secret.from_name("docraptor-api"),
        modal.Secret.from_name("documenso-prod"),
    ],
)
def process_proposal_generation(submission_id: str):
    """
    Process proposal generation submission.
    - Load context from DB
    - Generate HTML proposal
    - Convert to PDF via DocRaptor
    - Upload to Documenso for e-signature
    - Store signing token on deal
    """
    import docraptor
    import requests
    
    print(f"[HANDLER] Processing proposal generation {submission_id}")
    
    # Documenso config (production)
    DOCUMENSO_API_KEY = os.environ.get("DOCUMENSO_API_KEY")
    DOCUMENSO_URL = os.environ.get("DOCUMENSO_URL", "https://app.documenso.com/api/v1")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Load submission
            cur.execute("SELECT payload, deal_id, booking_id FROM form_submissions WHERE id = %s", (submission_id,))
            row = cur.fetchone()
            
            if not row:
                raise ValueError(f"Submission {submission_id} not found")
            
            payload = row[0] if isinstance(row[0], dict) else json.loads(row[0])
            deal_id = row[1]
            booking_id = row[2]
            
            proposal_type = payload.get('proposal_type', 'standard')
            monthly_value = payload.get('monthly_value', 0)
            payment_type = payload.get('payment_type', 'one_time')
            scope_summary = payload.get('scope_summary', '')
            special_terms = payload.get('special_terms', '')
            
            print(f"  Proposal type: {proposal_type}")
            print(f"  Monthly value: {monthly_value}")
            print(f"  Payment type: {payment_type}")
            print(f"  Deal ID: {deal_id}")
            
            # Load full context
            cur.execute("""
                SELECT 
                    c.name as company_name,
                    c.domain as company_domain,
                    p.name as person_name,
                    p.email as person_email,
                    d.stage as deal_stage
                FROM bookings b
                JOIN people p ON b.person_id = p.id
                LEFT JOIN companies c ON p.company_id = c.id
                LEFT JOIN deals d ON d.company_id = c.id AND d.status = 'active'
                WHERE b.id = %s
            """, (booking_id,))
            ctx = cur.fetchone()
            
            company_name = ctx[0] if ctx else "Client"
            company_domain = ctx[1] if ctx else ""
            person_name = ctx[2] if ctx else "Client"
            person_email = ctx[3] if ctx else ""
            
            print(f"  Company: {company_name}, Contact: {person_name}")
            
            # Update deal value and payment type
            if deal_id:
                cur.execute(
                    "UPDATE deals SET value = %s, payment_type = %s, updated_at = now() WHERE id = %s",
                    (monthly_value, payment_type, deal_id)
                )
                print(f"  Updated deal: value=${monthly_value}, payment_type={payment_type}")
            
            # Generate HTML proposal
            proposal_date = datetime.now(timezone.utc).strftime("%B %d, %Y")
            formatted_value = f"${monthly_value:,.2f}" if monthly_value else "TBD"
            
            html_content = generate_proposal_html(
                company_name=company_name,
                person_name=person_name,
                person_email=person_email,
                proposal_type=proposal_type,
                monthly_value=formatted_value,
                scope_summary=scope_summary,
                special_terms=special_terms,
                proposal_date=proposal_date,
            )
            
            print(f"  Generated HTML ({len(html_content)} chars)")
            
            # =========================================
            # Step 1: Convert to PDF via DocRaptor
            # =========================================
            doc_api = docraptor.DocApi()
            doc_api.api_client.configuration.username = os.environ.get("DOCRAPTOR_API_KEY")
            
            print("  Calling DocRaptor API...")
            pdf_bytes = doc_api.create_doc({
                "test": False,  # Production mode - no watermark
                "document_type": "pdf",
                "document_content": html_content,
                "name": f"proposal-{deal_id}.pdf",
            })
            print(f"  Generated PDF ({len(pdf_bytes)} bytes)")
            
            # =========================================
            # Step 2: Upload PDF to Documenso (v2 API)
            # =========================================
            print("  Uploading to Documenso...")
            
            # Use v2 API base (strip /v1 if present)
            documenso_base = DOCUMENSO_URL.replace("/api/v1", "").replace("/api/v2", "")
            
            # Create document with recipient and field in one call
            payload = {
                "title": f"Proposal - {company_name}",
                "recipients": [
                    {
                        "email": person_email,
                        "name": person_name,
                        "role": "SIGNER",
                        "signingOrder": 1,
                    }
                ]
            }
            
            import io
            files = {
                "file": (f"proposal-{company_name}.pdf", io.BytesIO(pdf_bytes), "application/pdf"),
            }
            
            create_resp = requests.post(
                f"{documenso_base}/api/v2/document/create",
                headers={"Authorization": DOCUMENSO_API_KEY},
                files=files,
                data={"payload": json.dumps(payload)}
            )
            
            if not create_resp.ok:
                print(f"  Documenso error: {create_resp.status_code} - {create_resp.text}")
                create_resp.raise_for_status()
            
            doc_data = create_resp.json()
            documenso_doc_id = doc_data.get("documentId") or doc_data.get("id")
            print(f"  Created Documenso document: {documenso_doc_id}")
            print(f"  Response: {json.dumps(doc_data, indent=2)[:500]}")
            
            # Get the recipient token from the response
            recipients = doc_data.get("recipients", [])
            if recipients:
                signing_token = recipients[0].get("token") or recipients[0].get("signingToken")
            else:
                # Try to get it from a separate call
                signing_token = None
            
            # If no token in response, we need to fetch it
            if not signing_token:
                print("  Fetching signing token...")
                get_resp = requests.get(
                    f"{documenso_base}/api/v1/documents/{documenso_doc_id}",
                    headers={"Authorization": f"Bearer {DOCUMENSO_API_KEY}"}
                )
                if get_resp.ok:
                    doc_detail = get_resp.json()
                    recipients = doc_detail.get("recipients", [])
                    if recipients:
                        signing_token = recipients[0].get("token") or recipients[0].get("signingToken")
            
            if signing_token:
                print(f"  Got signing token: {signing_token[:10]}...")
            else:
                print(f"  WARNING: No signing token found in response")
                signing_token = "token_not_found"
            
            # =========================================
            # Step 3: Add signature field
            # =========================================
            # Try to add field if document is still in draft
            try:
                # Get recipient ID
                recipient_id = recipients[0].get("id") if recipients else None
                if recipient_id:
                    field_resp = requests.post(
                        f"{documenso_base}/api/v1/documents/{documenso_doc_id}/fields",
                        headers={
                            "Authorization": f"Bearer {DOCUMENSO_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "type": "SIGNATURE",
                            "recipientId": recipient_id,
                            "pageNumber": 1,
                            "pageX": 100,
                            "pageY": 650,
                            "pageWidth": 200,
                            "pageHeight": 60,
                        }
                    )
                    if field_resp.ok:
                        print(f"  Added signature field")
                    else:
                        print(f"  Field add response: {field_resp.status_code} - {field_resp.text[:200]}")
            except Exception as e:
                print(f"  Could not add field: {e}")
            
            # =========================================
            # Step 4: Send document (activate, no email)
            # =========================================
            try:
                send_resp = requests.post(
                    f"{documenso_base}/api/v1/documents/{documenso_doc_id}/send",
                    headers={
                        "Authorization": f"Bearer {DOCUMENSO_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={"sendEmail": False}
                )
                if send_resp.ok:
                    print(f"  Document activated for signing")
                else:
                    print(f"  Send response: {send_resp.status_code} - {send_resp.text[:200]}")
            except Exception as e:
                print(f"  Could not send: {e}")
            
            # =========================================
            # Step 6: Update deal with Documenso info
            # =========================================
            if deal_id:
                cur.execute("""
                    UPDATE deals 
                    SET documenso_document_id = %s,
                        documenso_signing_token = %s,
                        proposal_generated_at = %s,
                        stage = 'proposal',
                        updated_at = now() 
                    WHERE id = %s
                """, (str(documenso_doc_id), signing_token, datetime.now(timezone.utc), deal_id))
                print(f"  Updated deal {deal_id} with Documenso token")
            
            # Mark processed
            cur.execute("""
                UPDATE form_submissions 
                SET processed = true, processed_at = %s 
                WHERE id = %s
            """, (datetime.now(timezone.utc), submission_id))
            
            conn.commit()
            print(f"[HANDLER] Done processing {submission_id}")
            print(f"[HANDLER] Documenso doc: {documenso_doc_id}, signing token: {signing_token[:10]}...")
            
    except Exception as e:
        conn.rollback()
        print(f"[HANDLER] Error: {e}")
        import traceback
        traceback.print_exc()
        try:
            with conn.cursor() as cur:
                cur.execute("UPDATE form_submissions SET error = %s WHERE id = %s", (str(e), submission_id))
                conn.commit()
        except:
            pass
        raise
    finally:
        conn.close()


def generate_proposal_html(
    company_name: str,
    person_name: str,
    person_email: str,
    proposal_type: str,
    monthly_value: str,
    scope_summary: str,
    special_terms: str,
    proposal_date: str,
) -> str:
    """Generate HTML for the proposal PDF."""
    
    # Clean up scope summary - convert newlines to paragraphs
    scope_paragraphs = ""
    if scope_summary:
        for para in scope_summary.split("\n"):
            if para.strip():
                scope_paragraphs += f"<p>{para.strip()}</p>"
    else:
        scope_paragraphs = "<p>Scope details to be discussed.</p>"
    
    # Terms section
    terms_html = ""
    if special_terms:
        terms_html = f"""
        <div class="section">
            <h2>Terms & Conditions</h2>
            <p>{special_terms}</p>
        </div>
        """
    
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Proposal for {company_name}</title>
    <style>
        @page {{
            size: letter;
            margin: 1in;
        }}
        
        body {{
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #1a1a1a;
        }}
        
        .header {{
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        
        .logo {{
            font-size: 24pt;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 5px;
        }}
        
        .tagline {{
            font-size: 10pt;
            color: #666;
        }}
        
        .title {{
            font-size: 28pt;
            font-weight: bold;
            color: #1a1a1a;
            margin: 40px 0 10px 0;
        }}
        
        .subtitle {{
            font-size: 14pt;
            color: #666;
            margin-bottom: 30px;
        }}
        
        .meta {{
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }}
        
        .meta-row {{
            display: flex;
            margin-bottom: 8px;
        }}
        
        .meta-label {{
            font-weight: bold;
            width: 120px;
            color: #666;
        }}
        
        .meta-value {{
            color: #1a1a1a;
        }}
        
        .section {{
            margin-bottom: 30px;
        }}
        
        .section h2 {{
            font-size: 16pt;
            color: #2563eb;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 8px;
            margin-bottom: 15px;
        }}
        
        .section p {{
            margin-bottom: 12px;
        }}
        
        .investment-box {{
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            text-align: center;
            margin: 30px 0;
        }}
        
        .investment-label {{
            font-size: 12pt;
            text-transform: uppercase;
            letter-spacing: 2px;
            opacity: 0.9;
        }}
        
        .investment-value {{
            font-size: 36pt;
            font-weight: bold;
            margin: 10px 0;
        }}
        
        .investment-period {{
            font-size: 11pt;
            opacity: 0.9;
        }}
        
        .next-steps {{
            background: #f0fdf4;
            border-left: 4px solid #22c55e;
            padding: 20px;
            margin: 30px 0;
        }}
        
        .next-steps h3 {{
            color: #166534;
            margin-bottom: 10px;
        }}
        
        .footer {{
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 10pt;
            color: #666;
        }}
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">Outbound Solutions</div>
        <div class="tagline">Data-Driven Growth</div>
    </div>
    
    <div class="title">Proposal</div>
    <div class="subtitle">Prepared for {company_name}</div>
    
    <div class="meta">
        <div class="meta-row">
            <span class="meta-label">Prepared For:</span>
            <span class="meta-value">{person_name}</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">Email:</span>
            <span class="meta-value">{person_email}</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">Date:</span>
            <span class="meta-value">{proposal_date}</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">Proposal Type:</span>
            <span class="meta-value">{proposal_type.title()}</span>
        </div>
    </div>
    
    <div class="section">
        <h2>Scope of Work</h2>
        {scope_paragraphs}
    </div>
    
    <div class="investment-box">
        <div class="investment-label">Monthly Investment</div>
        <div class="investment-value">{monthly_value}</div>
        <div class="investment-period">per month</div>
    </div>
    
    {terms_html}
    
    <div class="next-steps">
        <h3>Next Steps</h3>
        <p>To proceed with this proposal, please reply to this email or schedule a follow-up call to finalize details and begin onboarding.</p>
    </div>
    
    <div class="footer">
        <p><strong>Outbound Solutions</strong></p>
        <p>team@outboundsolutions.com</p>
    </div>
</body>
</html>
"""


# =============================================================================
# ASGI App Entry Point
# =============================================================================

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("outbound-supabase")],
    min_containers=1,  # Keep one container warm to eliminate cold start latency
)
@modal.asgi_app()
def api():
    """Serve the FastAPI app."""
    return web_app

